-- =============================================
-- UNIFIED SUBSCRIPTION SCHEMA
-- Manager Lokka — Admin Panel + Electron OMS
-- Supabase Project: vfmpgdxydzmddypizhpt
-- =============================================
--
-- ⚠️  IMPORTANT: This schema replaces BOTH:
--     1. The old "Subscription Management Schema" (OMS RPC functions)
--     2. The old "Subscription Admin Panel Schema" (admin dashboard tables)
--
-- It unifies them into ONE schema. Run this ONCE in Supabase SQL Editor.
--
-- BACKUP FIRST:
--   - Old schema backed up to: supabase-subscription-schema-BACKUP.sql
--   - Old admin schema backed up to: admin-panel/supabase-schema-BACKUP.sql
-- =============================================

-- =============================================
-- STEP 1: DROP OLD TABLES (order matters for FK)
-- =============================================
DROP TABLE IF EXISTS visitor_events CASCADE;
DROP TABLE IF EXISTS admin_actions CASCADE;
DROP TABLE IF EXISTS processed_order_events CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS usage_cycles CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS plan_config CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;

-- Drop old RPC functions
DROP FUNCTION IF EXISTS activate_subscription(TEXT, TEXT);
DROP FUNCTION IF EXISTS validate_subscription(TEXT, TEXT);
DROP FUNCTION IF EXISTS increment_order_usage(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS start_trial(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_paid_subscription(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS renew_subscription(TEXT, INT);
DROP FUNCTION IF EXISTS reset_device_binding(TEXT);

-- =============================================
-- STEP 2: CREATE TABLES (Admin Panel structure)
-- =============================================

-- 1. Admin Users (passwords hashed with bcrypt)
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Plan Configuration (dynamic limits & pricing)
CREATE TABLE plan_config (
    plan TEXT PRIMARY KEY CHECK (plan IN ('starter','pro','enterprise','lifetime')),
    order_limit INT NOT NULL,
    extra_order_price NUMERIC(10,2) DEFAULT 0,
    monthly_price NUMERIC(10,2) NOT NULL,
    yearly_price NUMERIC(10,2),
    two_year_price NUMERIC(10,2),
    hard_stop BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO plan_config (plan, order_limit, extra_order_price, monthly_price, yearly_price, two_year_price, hard_stop) VALUES
    ('starter', 250, 0, 1250, 12500, 25000, true),
    ('pro', 600, 0, 1950, 19500, 39000, true),
    ('enterprise', 3000, 5, 3450, 34500, 69000, false),
    ('lifetime', 3000, 0, 24500, NULL, NULL, true);

-- 3. Customers (normalized — single source of truth for customer data)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Subscriptions (core table — references customers)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    subscription_key TEXT UNIQUE NOT NULL,
    plan TEXT DEFAULT 'trial' CHECK (plan IN ('trial','starter','pro','enterprise','lifetime')),
    billing_term TEXT DEFAULT 'monthly' CHECK (billing_term IN ('monthly','yearly','two_year','lifetime')),
    status TEXT DEFAULT 'trial' CHECK (status IN ('trial','active','expired','suspended','cancelled')),
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    billing_start TIMESTAMPTZ,
    billing_end TIMESTAMPTZ,
    device_id TEXT,
    device_bound_at TIMESTAMPTZ,
    last_validation_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    device_reset_count INT DEFAULT 0,
    last_device_reset_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Usage Cycles
CREATE TABLE usage_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    cycle_start TIMESTAMPTZ NOT NULL,
    cycle_end TIMESTAMPTZ NOT NULL,
    orders_used INT DEFAULT 0,
    extra_orders INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Processed Order Events (duplicate protection — separate table for scalability)
CREATE TABLE processed_order_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    usage_cycle_id UUID NOT NULL REFERENCES usage_cycles(id) ON DELETE CASCADE,
    local_order_id TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subscription_id, local_order_id)
);

-- 7. Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    cycle_start TIMESTAMPTZ,
    cycle_end TIMESTAMPTZ,
    plan_price NUMERIC(10,2) DEFAULT 0,
    extra_order_count INT DEFAULT 0,
    extra_order_price NUMERIC(10,2) DEFAULT 0,
    total_due NUMERIC(10,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','overdue')),
    billing_date TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Admin Actions Log
CREATE TABLE admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES admin_users(id),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    action_note TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Visitor/Lead Tracking
CREATE TABLE visitor_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    source TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Admin Messages (announcements to subscribers)
CREATE TABLE admin_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_plans TEXT[] DEFAULT '{all}',
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal','important','urgent')),
    sent_by UUID REFERENCES admin_users(id),
    sent_by_name TEXT,
    recipient_count INT DEFAULT 0,
    status TEXT DEFAULT 'sent',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- STEP 3: INDEXES
-- =============================================
CREATE INDEX idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_key ON subscriptions(subscription_key);
CREATE INDEX idx_subscriptions_device ON subscriptions(device_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_usage_cycles_sub ON usage_cycles(subscription_id);
CREATE INDEX idx_usage_cycles_dates ON usage_cycles(cycle_start, cycle_end);
CREATE INDEX idx_processed_events_sub ON processed_order_events(subscription_id, local_order_id);
CREATE INDEX idx_payments_subscription ON payments(subscription_id);
CREATE INDEX idx_actions_admin ON admin_actions(admin_user_id);
CREATE INDEX idx_actions_created ON admin_actions(created_at DESC);
CREATE INDEX idx_visitor_source ON visitor_events(source);
CREATE INDEX idx_messages_created ON admin_messages(created_at DESC);

-- =============================================
-- STEP 4: ROW LEVEL SECURITY
-- =============================================
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

-- Anon can read plan_config (for pricing display)
CREATE POLICY "Anyone can read plan config" ON plan_config FOR SELECT USING (true);

-- Block direct table access for anon (OMS app uses RPC functions instead)
CREATE POLICY "No direct anon access" ON subscriptions FOR ALL USING (false);
CREATE POLICY "No direct anon access" ON usage_cycles FOR ALL USING (false);
CREATE POLICY "No direct anon access" ON processed_order_events FOR ALL USING (false);
CREATE POLICY "No direct anon access" ON payments FOR ALL USING (false);
CREATE POLICY "No direct anon access" ON customers FOR ALL USING (false);
CREATE POLICY "No direct anon access" ON admin_actions FOR ALL USING (false);
CREATE POLICY "No direct anon access" ON visitor_events FOR ALL USING (false);
CREATE POLICY "No direct anon access" ON admin_users FOR ALL USING (false);
CREATE POLICY "Anon can read messages" ON admin_messages FOR SELECT USING (true);
CREATE POLICY "No direct anon write" ON admin_messages FOR INSERT USING (false);
CREATE POLICY "No direct anon update" ON admin_messages FOR UPDATE USING (false);
CREATE POLICY "No direct anon delete" ON admin_messages FOR DELETE USING (false);

-- Service role bypasses RLS automatically (used by admin panel API routes)

-- =============================================
-- STEP 5: RPC FUNCTIONS (for Electron OMS app)
-- All use SECURITY DEFINER to bypass RLS
-- =============================================

-- =============================================
-- RPC: activate_subscription
-- Called when user enters subscription key in OMS app
-- =============================================
CREATE OR REPLACE FUNCTION activate_subscription(
    p_subscription_key TEXT,
    p_device_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub RECORD;
    v_customer RECORD;
    v_cycle RECORD;
    v_plan_limit INT;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- Find subscription with customer data
    SELECT s.*, c.full_name, c.email, c.phone
    INTO v_sub
    FROM subscriptions s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.subscription_key = p_subscription_key;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid subscription key');
    END IF;

    -- Check status
    IF v_sub.status = 'suspended' THEN
        RETURN jsonb_build_object('success', false, 'error', 'This subscription has been suspended. Contact support.');
    END IF;

    -- Check device binding
    IF v_sub.device_id IS NOT NULL AND v_sub.device_id != p_device_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This subscription is already activated on another computer.',
            'code', 'DEVICE_MISMATCH'
        );
    END IF;

    -- Check if trial expired
    IF v_sub.status = 'trial' AND v_sub.trial_end IS NOT NULL AND v_sub.trial_end < v_now THEN
        UPDATE subscriptions SET status = 'expired', updated_at = v_now WHERE id = v_sub.id;
        RETURN jsonb_build_object('success', false, 'error', 'Trial period has expired. Please purchase a subscription.', 'code', 'TRIAL_EXPIRED');
    END IF;

    -- Check if billing expired (skip for lifetime — billing_end is NULL)
    IF v_sub.status = 'active' AND v_sub.billing_end IS NOT NULL AND v_sub.billing_end < v_now THEN
        UPDATE subscriptions SET status = 'expired', updated_at = v_now WHERE id = v_sub.id;
        RETURN jsonb_build_object('success', false, 'error', 'Subscription has expired. Please renew.', 'code', 'SUBSCRIPTION_EXPIRED');
    END IF;

    -- Bind device if not yet bound
    IF v_sub.device_id IS NULL THEN
        UPDATE subscriptions
        SET device_id = p_device_id, device_bound_at = v_now,
            last_validation_at = v_now, last_seen_at = v_now, updated_at = v_now
        WHERE id = v_sub.id;
    ELSE
        UPDATE subscriptions
        SET last_validation_at = v_now, last_seen_at = v_now, updated_at = v_now
        WHERE id = v_sub.id;
    END IF;

    -- Refresh
    SELECT s.*, c.full_name, c.email
    INTO v_sub
    FROM subscriptions s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.id = v_sub.id;

    -- Get current usage cycle
    SELECT * INTO v_cycle FROM usage_cycles
    WHERE subscription_id = v_sub.id
      AND cycle_start <= v_now AND cycle_end > v_now
    ORDER BY cycle_start DESC LIMIT 1;

    -- Plan limit from config or fallback
    SELECT order_limit INTO v_plan_limit FROM plan_config WHERE plan = v_sub.plan;
    IF v_plan_limit IS NULL THEN
        v_plan_limit := CASE v_sub.plan
            WHEN 'starter' THEN 250 WHEN 'pro' THEN 600
            WHEN 'enterprise' THEN 3000 WHEN 'lifetime' THEN 3000 WHEN 'trial' THEN 50 ELSE 0
        END;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'subscription_id', v_sub.id,
        'plan', v_sub.plan,
        'billing_term', v_sub.billing_term,
        'status', v_sub.status,
        'trial_start', v_sub.trial_start,
        'trial_end', v_sub.trial_end,
        'billing_start', v_sub.billing_start,
        'billing_end', v_sub.billing_end,
        'device_id', v_sub.device_id,
        'device_bound_at', v_sub.device_bound_at,
        'last_validation_at', v_sub.last_validation_at,
        'orders_used', COALESCE(v_cycle.orders_used, 0),
        'extra_orders', COALESCE(v_cycle.extra_orders, 0),
        'order_limit', v_plan_limit,
        'cycle_start', v_cycle.cycle_start,
        'cycle_end', v_cycle.cycle_end,
        'customer_name', v_sub.full_name,
        'customer_email', v_sub.email
    );
END;
$$;

-- =============================================
-- RPC: validate_subscription
-- Called on app startup and periodically
-- =============================================
CREATE OR REPLACE FUNCTION validate_subscription(
    p_subscription_key TEXT,
    p_device_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub RECORD;
    v_cycle RECORD;
    v_plan_limit INT;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT s.*, c.full_name, c.email
    INTO v_sub
    FROM subscriptions s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.subscription_key = p_subscription_key;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid subscription key');
    END IF;

    -- Device check
    IF v_sub.device_id IS NOT NULL AND v_sub.device_id != p_device_id THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Device mismatch.', 'code', 'DEVICE_MISMATCH');
    END IF;

    IF v_sub.status = 'suspended' THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Subscription suspended.', 'code', 'SUSPENDED');
    END IF;

    -- Trial expiry
    IF v_sub.status = 'trial' AND v_sub.trial_end IS NOT NULL AND v_sub.trial_end < v_now THEN
        UPDATE subscriptions SET status = 'expired', updated_at = v_now WHERE id = v_sub.id;
        RETURN jsonb_build_object('valid', false, 'error', 'Trial expired.', 'code', 'TRIAL_EXPIRED', 'status', 'expired');
    END IF;

    -- Billing expiry (skip for lifetime — billing_end is NULL = always active)
    IF v_sub.status = 'active' AND v_sub.billing_end IS NOT NULL AND v_sub.billing_end < v_now THEN
        UPDATE subscriptions SET status = 'expired', updated_at = v_now WHERE id = v_sub.id;
        RETURN jsonb_build_object('valid', false, 'error', 'Subscription expired.', 'code', 'SUBSCRIPTION_EXPIRED', 'status', 'expired');
    END IF;

    -- Update last seen
    UPDATE subscriptions
    SET last_validation_at = v_now, last_seen_at = v_now, updated_at = v_now
    WHERE id = v_sub.id;

    -- Current usage cycle
    SELECT * INTO v_cycle FROM usage_cycles
    WHERE subscription_id = v_sub.id
      AND cycle_start <= v_now AND cycle_end > v_now
    ORDER BY cycle_start DESC LIMIT 1;

    SELECT order_limit INTO v_plan_limit FROM plan_config WHERE plan = v_sub.plan;
    IF v_plan_limit IS NULL THEN
        v_plan_limit := CASE v_sub.plan
            WHEN 'starter' THEN 250 WHEN 'pro' THEN 600
            WHEN 'enterprise' THEN 3000 WHEN 'lifetime' THEN 3000 WHEN 'trial' THEN 50 ELSE 0
        END;
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'subscription_id', v_sub.id,
        'plan', v_sub.plan,
        'billing_term', v_sub.billing_term,
        'status', v_sub.status,
        'trial_start', v_sub.trial_start,
        'trial_end', v_sub.trial_end,
        'billing_start', v_sub.billing_start,
        'billing_end', v_sub.billing_end,
        'device_id', v_sub.device_id,
        'last_validation_at', v_now,
        'orders_used', COALESCE(v_cycle.orders_used, 0),
        'extra_orders', COALESCE(v_cycle.extra_orders, 0),
        'order_limit', v_plan_limit,
        'cycle_start', v_cycle.cycle_start,
        'cycle_end', v_cycle.cycle_end
    );
END;
$$;

-- =============================================
-- RPC: increment_order_usage
-- Called every time a new order is created locally
-- Prevents duplicate counting via processed_order_events
-- =============================================
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
        -- Auto-create cycle
        IF v_sub.billing_start IS NOT NULL THEN
            INSERT INTO usage_cycles (subscription_id, cycle_start, cycle_end)
            VALUES (v_sub.id, v_sub.billing_start, COALESCE(v_sub.billing_end, v_sub.billing_start + INTERVAL '30 days'))
            RETURNING * INTO v_cycle;
        ELSIF v_sub.trial_start IS NOT NULL THEN
            INSERT INTO usage_cycles (subscription_id, cycle_start, cycle_end)
            VALUES (v_sub.id, v_sub.trial_start, v_sub.trial_end)
            RETURNING * INTO v_cycle;
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'No active billing cycle');
        END IF;
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

    -- Check hard-stop limit (starter, pro, lifetime, trial = hard stop; enterprise = soft stop with extra charges)
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

-- =============================================
-- RPC: start_trial
-- Called when user starts trial from OMS app
-- Creates customer + subscription + usage cycle
-- =============================================
CREATE OR REPLACE FUNCTION start_trial(
    p_email TEXT,
    p_full_name TEXT,
    p_device_id TEXT
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
        INSERT INTO customers (full_name, email)
        VALUES (p_full_name, p_email)
        RETURNING * INTO v_customer;
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
            'Trial started for ' || p_email || ' on device ' || substr(p_device_id, 1, 16) || '...');

    -- Track visitor event
    INSERT INTO visitor_events (event_type, customer_id, metadata)
    VALUES ('trial_signup', v_customer.id, jsonb_build_object('device_id', substr(p_device_id, 1, 16)));

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

-- =============================================
-- RPC: create_paid_subscription (Admin only)
-- Accepts billing_term: monthly, yearly, two_year, lifetime
-- =============================================
CREATE OR REPLACE FUNCTION create_paid_subscription(
    p_email TEXT,
    p_full_name TEXT,
    p_phone TEXT,
    p_plan TEXT,
    p_billing_term TEXT DEFAULT 'monthly'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub RECORD;
    v_customer RECORD;
    v_key TEXT;
    v_plan_prefix TEXT;
    v_now TIMESTAMPTZ := now();
    v_billing_end TIMESTAMPTZ;
    v_billing_term TEXT;
    v_cycle_end TIMESTAMPTZ;
BEGIN
    IF p_plan NOT IN ('starter', 'pro', 'enterprise', 'lifetime') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid plan. Must be starter, pro, enterprise, or lifetime.');
    END IF;

    -- Enforce lifetime plan must use lifetime billing_term
    IF p_plan = 'lifetime' THEN
        v_billing_term := 'lifetime';
    ELSE
        v_billing_term := COALESCE(p_billing_term, 'monthly');
        IF v_billing_term NOT IN ('monthly', 'yearly', 'two_year') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Invalid billing term. Must be monthly, yearly, or two_year.');
        END IF;
    END IF;

    -- Calculate billing_end based on term
    v_billing_end := CASE v_billing_term
        WHEN 'monthly' THEN v_now + INTERVAL '1 month'
        WHEN 'yearly' THEN v_now + INTERVAL '12 months'
        WHEN 'two_year' THEN v_now + INTERVAL '24 months'
        WHEN 'lifetime' THEN NULL  -- Lifetime never expires
    END;

    -- Create or find customer
    SELECT * INTO v_customer FROM customers WHERE email = p_email;
    IF NOT FOUND THEN
        INSERT INTO customers (full_name, email, phone)
        VALUES (p_full_name, p_email, p_phone)
        RETURNING * INTO v_customer;
    ELSE
        UPDATE customers SET full_name = p_full_name, phone = p_phone, updated_at = v_now
        WHERE id = v_customer.id;
    END IF;

    -- Generate key
    v_plan_prefix := CASE p_plan
        WHEN 'starter' THEN 'STR' WHEN 'pro' THEN 'PRO'
        WHEN 'enterprise' THEN 'ENT' WHEN 'lifetime' THEN 'LTM'
    END;
    v_key := 'MLK-' || v_plan_prefix || '-' ||
             upper(substr(md5(random()::text), 1, 4)) || '-' ||
             upper(substr(md5(random()::text), 1, 4));

    -- Create subscription
    INSERT INTO subscriptions (
        customer_id, subscription_key, plan, billing_term, status,
        billing_start, billing_end, last_validation_at
    ) VALUES (
        v_customer.id, v_key, p_plan, v_billing_term, 'active',
        v_now, v_billing_end, v_now
    ) RETURNING * INTO v_sub;

    -- Create usage cycle (monthly cycle for all plans — resets every 30 days)
    v_cycle_end := CASE
        WHEN v_billing_end IS NULL THEN v_now + INTERVAL '30 days'  -- Lifetime: monthly cycles
        WHEN v_billing_term = 'monthly' THEN v_billing_end
        ELSE v_now + INTERVAL '30 days'  -- Yearly/two_year: still monthly usage cycles
    END;

    INSERT INTO usage_cycles (subscription_id, cycle_start, cycle_end)
    VALUES (v_sub.id, v_now, v_cycle_end);

    -- Log
    INSERT INTO admin_actions (subscription_id, customer_id, action_type, action_note)
    VALUES (v_sub.id, v_customer.id, 'subscription_created',
            'Created ' || p_plan || ' (' || v_billing_term || ') subscription for ' || p_email);

    RETURN jsonb_build_object(
        'success', true,
        'subscription_key', v_key,
        'subscription_id', v_sub.id,
        'plan', p_plan,
        'billing_term', v_billing_term,
        'status', 'active',
        'billing_start', v_now,
        'billing_end', v_billing_end,
        'email', p_email
    );
END;
$$;

-- =============================================
-- RPC: renew_subscription (Admin only)
-- Renews based on subscription's billing_term
-- =============================================
CREATE OR REPLACE FUNCTION renew_subscription(
    p_subscription_key TEXT,
    p_months INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub RECORD;
    v_now TIMESTAMPTZ := now();
    v_new_start TIMESTAMPTZ;
    v_new_end TIMESTAMPTZ;
    v_months INT;
    v_cycle_end TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_sub FROM subscriptions WHERE subscription_key = p_subscription_key;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
    END IF;

    -- Lifetime cannot be renewed
    IF v_sub.plan = 'lifetime' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lifetime subscriptions do not need renewal.');
    END IF;

    -- Calculate months based on billing_term (or use override)
    IF p_months IS NOT NULL THEN
        v_months := p_months;
    ELSE
        v_months := CASE v_sub.billing_term
            WHEN 'yearly' THEN 12
            WHEN 'two_year' THEN 24
            ELSE 1  -- monthly
        END;
    END IF;

    IF v_sub.billing_end IS NOT NULL AND v_sub.billing_end > v_now THEN
        v_new_start := v_sub.billing_end;
    ELSE
        v_new_start := v_now;
    END IF;

    v_new_end := v_new_start + (v_months || ' months')::INTERVAL;

    UPDATE subscriptions
    SET billing_start = v_new_start, billing_end = v_new_end,
        status = 'active', updated_at = v_now
    WHERE id = v_sub.id;

    -- Create usage cycle (monthly reset for all plans)
    v_cycle_end := CASE
        WHEN v_sub.billing_term = 'monthly' THEN v_new_end
        ELSE v_new_start + INTERVAL '30 days'
    END;

    INSERT INTO usage_cycles (subscription_id, cycle_start, cycle_end)
    VALUES (v_sub.id, v_new_start, v_cycle_end);

    INSERT INTO admin_actions (subscription_id, customer_id, action_type, action_note)
    VALUES (v_sub.id, v_sub.customer_id, 'subscription_renewed',
            'Renewed (' || COALESCE(v_sub.billing_term, 'monthly') || ') for ' || v_months || ' month(s). New end: ' || v_new_end);

    RETURN jsonb_build_object(
        'success', true,
        'billing_start', v_new_start,
        'billing_end', v_new_end,
        'billing_term', v_sub.billing_term,
        'status', 'active'
    );
END;
$$;

-- =============================================
-- RPC: reset_device_binding (Admin only)
-- =============================================
CREATE OR REPLACE FUNCTION reset_device_binding(
    p_subscription_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub RECORD;
BEGIN
    SELECT * INTO v_sub FROM subscriptions WHERE subscription_key = p_subscription_key;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
    END IF;

    UPDATE subscriptions
    SET device_id = NULL, device_bound_at = NULL,
        device_reset_count = device_reset_count + 1,
        last_device_reset_at = now(), updated_at = now()
    WHERE id = v_sub.id;

    INSERT INTO admin_actions (subscription_id, customer_id, action_type, action_note)
    VALUES (v_sub.id, v_sub.customer_id, 'device_reset',
            'Device binding reset. Count: ' || (v_sub.device_reset_count + 1));

    RETURN jsonb_build_object('success', true, 'reset_count', v_sub.device_reset_count + 1);
END;
$$;

-- =============================================
-- STEP 6: GRANT RPC ACCESS TO ANON ROLE
-- (so Electron app can call with anon key)
-- =============================================
GRANT EXECUTE ON FUNCTION activate_subscription(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_subscription(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION increment_order_usage(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION start_trial(TEXT, TEXT, TEXT) TO anon;
-- Admin-only functions (service_role only, NOT granted to anon):
-- create_paid_subscription, renew_subscription, reset_device_binding

-- =============================================
-- DONE! Unified schema is ready.
-- Next steps:
--   1. Insert first admin user (see admin-panel Settings page)
--   2. Set SUPABASE_SERVICE_ROLE_KEY in admin-panel/.env.local
--   3. Run admin panel: cd admin-panel && npm run dev
-- =============================================
