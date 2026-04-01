-- =============================================
-- MIGRATION: Update start_trial to accept phone number
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop old function first
DROP FUNCTION IF EXISTS start_trial(TEXT, TEXT, TEXT);

-- Recreate with phone parameter
CREATE OR REPLACE FUNCTION start_trial(
    p_email TEXT,
    p_full_name TEXT,
    p_device_id TEXT,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub RECORD;
    v_customer RECORD;
    v_key TEXT;
    v_now TIMESTAMPTZ := now();
    v_trial_end TIMESTAMPTZ := now() + INTERVAL '4 days';
    v_existing RECORD;
BEGIN
    -- Check if device already has a trial
    SELECT s.*, c.email as customer_email INTO v_existing
    FROM subscriptions s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.device_id = p_device_id AND s.plan = 'trial';

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'A trial has already been started on this computer.',
            'code', 'TRIAL_EXISTS',
            'trial_end', v_existing.trial_end,
            'subscription_key', v_existing.subscription_key
        );
    END IF;

    -- Check by email
    SELECT s.*, c.email as customer_email INTO v_existing
    FROM subscriptions s
    JOIN customers c ON c.id = s.customer_id
    WHERE c.email = p_email AND s.plan = 'trial';

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'A trial already exists for this email.',
            'code', 'TRIAL_EXISTS',
            'trial_end', v_existing.trial_end,
            'subscription_key', v_existing.subscription_key
        );
    END IF;

    -- Create or find customer
    SELECT * INTO v_customer FROM customers WHERE email = p_email;
    IF NOT FOUND THEN
        INSERT INTO customers (full_name, email, phone)
        VALUES (p_full_name, p_email, p_phone)
        RETURNING * INTO v_customer;
    ELSE
        -- Update phone if provided and customer exists
        IF p_phone IS NOT NULL AND (v_customer.phone IS NULL OR v_customer.phone = '') THEN
            UPDATE customers SET phone = p_phone, updated_at = v_now WHERE id = v_customer.id;
        END IF;
    END IF;

    -- Generate trial key
    v_key := 'MLK-TRL-' || upper(substr(md5(random()::text), 1, 4)) || '-' ||
             upper(substr(md5(random()::text), 1, 4));

    -- Create subscription
    INSERT INTO subscriptions (
        customer_id, subscription_key, plan, status,
        trial_start, trial_end,
        device_id, device_bound_at,
        last_validation_at, last_seen_at
    ) VALUES (
        v_customer.id, v_key, 'trial', 'trial',
        v_now, v_trial_end,
        p_device_id, v_now,
        v_now, v_now
    ) RETURNING * INTO v_sub;

    -- Create usage cycle
    INSERT INTO usage_cycles (subscription_id, cycle_start, cycle_end)
    VALUES (v_sub.id, v_now, v_trial_end);

    -- Log action
    INSERT INTO admin_actions (subscription_id, customer_id, action_type, action_note)
    VALUES (v_sub.id, v_customer.id, 'trial_started',
            'Trial started for ' || p_email || ' (Phone: ' || COALESCE(p_phone, 'N/A') || ') on device ' || substr(p_device_id, 1, 16) || '...');

    -- Track visitor event
    INSERT INTO visitor_events (event_type, customer_id, metadata)
    VALUES ('trial_signup', v_customer.id, jsonb_build_object('device_id', substr(p_device_id, 1, 16), 'phone', p_phone));

    RETURN jsonb_build_object(
        'success', true,
        'subscription_key', v_key,
        'subscription_id', v_sub.id,
        'plan', 'trial',
        'status', 'trial',
        'trial_start', v_now,
        'trial_end', v_trial_end,
        'device_id', p_device_id,
        'order_limit', 50,
        'orders_used', 0
    );
END;
$$;

-- Re-grant execute permission to anon role
GRANT EXECUTE ON FUNCTION start_trial(TEXT, TEXT, TEXT, TEXT) TO anon;
