-- =============================================
-- FIX: increment_order_usage — Auto-Create Usage Cycles
-- Run this in Supabase SQL Editor
-- 
-- Problem: After the initial 30-day cycle expires, no new cycle
-- is auto-created. This causes order counting to silently fail
-- (shows 0 forever), especially for lifetime plans.
--
-- Fix: When no active cycle is found, automatically create a
-- new 30-day cycle from the current time.
-- =============================================

-- Drop and recreate the function
CREATE OR REPLACE FUNCTION increment_order_usage(
    p_subscription_key TEXT,
    p_device_id TEXT,
    p_local_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub RECORD;
    v_cycle RECORD;
    v_plan_limit INT;
    v_extra_price NUMERIC;
    v_now TIMESTAMPTZ := now();
    v_already_processed BOOLEAN;
BEGIN
    SELECT * INTO v_sub FROM subscriptions WHERE subscription_key = p_subscription_key;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid subscription key');
    END IF;

    IF v_sub.device_id IS NOT NULL AND v_sub.device_id != p_device_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Device mismatch', 'code', 'DEVICE_MISMATCH');
    END IF;

    IF v_sub.status NOT IN ('active', 'trial') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Subscription not active', 'code', 'NOT_ACTIVE');
    END IF;

    -- Get current usage cycle
    SELECT * INTO v_cycle FROM usage_cycles
    WHERE subscription_id = v_sub.id
      AND cycle_start <= v_now AND cycle_end > v_now
    ORDER BY cycle_start DESC LIMIT 1;

    IF NOT FOUND THEN
        -- =============================================
        -- AUTO-CREATE NEW CYCLE (THE FIX)
        -- When no active cycle exists, create a fresh 30-day cycle.
        -- This handles:
        --   1. Lifetime plans where the initial 30-day cycle expired
        --   2. Renewed subscriptions where no cycle was created
        --   3. Any gap between cycles
        -- =============================================
        IF v_sub.status = 'trial' AND v_sub.trial_start IS NOT NULL THEN
            -- Trial: cycle from now to trial_end (or now + 4 days)
            INSERT INTO usage_cycles (subscription_id, cycle_start, cycle_end)
            VALUES (v_sub.id, v_now, COALESCE(v_sub.trial_end, v_now + INTERVAL '4 days'))
            RETURNING * INTO v_cycle;
        ELSIF v_sub.billing_start IS NOT NULL THEN
            -- Active subscription: create a 30-day cycle from now
            INSERT INTO usage_cycles (subscription_id, cycle_start, cycle_end)
            VALUES (v_sub.id, v_now, v_now + INTERVAL '30 days')
            RETURNING * INTO v_cycle;
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'No active billing cycle and cannot auto-create');
        END IF;

        RAISE NOTICE '[Usage] Auto-created new cycle for subscription %', v_sub.id;
    END IF;

    -- Check duplicate
    SELECT EXISTS(
        SELECT 1 FROM processed_order_events
        WHERE subscription_id = v_sub.id AND local_order_id = p_local_order_id
    ) INTO v_already_processed;

    -- Get plan config
    SELECT order_limit, extra_order_price INTO v_plan_limit, v_extra_price
    FROM plan_config WHERE plan = v_sub.plan;

    IF v_plan_limit IS NULL THEN
        v_plan_limit := CASE v_sub.plan
            WHEN 'starter' THEN 250 WHEN 'pro' THEN 600
            WHEN 'enterprise' THEN 3000 WHEN 'lifetime' THEN 3000 WHEN 'trial' THEN 50 ELSE 0
        END;
        v_extra_price := CASE WHEN v_sub.plan = 'enterprise' THEN 5 ELSE 0 END;
    END IF;

    IF v_already_processed THEN
        RETURN jsonb_build_object(
            'success', true, 'duplicate', true,
            'orders_used', v_cycle.orders_used,
            'extra_orders', v_cycle.extra_orders,
            'order_limit', v_plan_limit,
            'limit_reached', (v_sub.plan IN ('starter', 'pro', 'lifetime', 'trial') AND v_cycle.orders_used >= v_plan_limit)
        );
    END IF;

    -- Check hard-stop limit
    IF v_sub.plan IN ('starter', 'pro', 'lifetime', 'trial') AND v_cycle.orders_used >= v_plan_limit THEN
        RETURN jsonb_build_object(
            'success', false, 'error', 'Order limit reached for this cycle', 'code', 'LIMIT_REACHED',
            'orders_used', v_cycle.orders_used, 'order_limit', v_plan_limit, 'plan', v_sub.plan
        );
    END IF;

    -- Increment usage
    IF v_sub.plan = 'enterprise' AND v_cycle.orders_used >= v_plan_limit THEN
        UPDATE usage_cycles
        SET orders_used = orders_used + 1, extra_orders = extra_orders + 1, updated_at = v_now
        WHERE id = v_cycle.id RETURNING * INTO v_cycle;
    ELSE
        UPDATE usage_cycles
        SET orders_used = orders_used + 1, updated_at = v_now
        WHERE id = v_cycle.id RETURNING * INTO v_cycle;
    END IF;

    -- Record processed event
    INSERT INTO processed_order_events (subscription_id, usage_cycle_id, local_order_id)
    VALUES (v_sub.id, v_cycle.id, p_local_order_id);

    -- Update last seen
    UPDATE subscriptions SET last_seen_at = v_now, updated_at = v_now WHERE id = v_sub.id;

    RETURN jsonb_build_object(
        'success', true, 'duplicate', false,
        'orders_used', v_cycle.orders_used,
        'extra_orders', v_cycle.extra_orders,
        'order_limit', v_plan_limit,
        'limit_reached', (v_sub.plan IN ('starter', 'pro', 'lifetime', 'trial') AND v_cycle.orders_used >= v_plan_limit),
        'extra_charge_per_order', COALESCE(v_extra_price, 0),
        'extra_charge_total', CASE WHEN v_sub.plan = 'enterprise' THEN v_cycle.extra_orders * COALESCE(v_extra_price, 5) ELSE 0 END
    );
END;
$$;

-- Re-grant access (just in case)
GRANT EXECUTE ON FUNCTION increment_order_usage(TEXT, TEXT, TEXT) TO anon;
