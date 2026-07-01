-- ==========================================
-- 0019_shared_table_sessions.sql
-- Shared Table Sessions & Customer Identity Upgrade
-- ==========================================

-- 1. Alter public.cafe_settings to support V2.4 configurations
ALTER TABLE public.cafe_settings ADD COLUMN IF NOT EXISTS auto_table_closure_minutes INTEGER DEFAULT 10 NOT NULL;
ALTER TABLE public.cafe_settings ADD COLUMN IF NOT EXISTS enable_customer_aliases BOOLEAN DEFAULT true NOT NULL;

-- 2. Create table_sessions table
CREATE TABLE IF NOT EXISTS public.table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_by TEXT NULL, -- Optional tracking
    ended_by TEXT NULL,   -- Optional tracking
    total_devices INTEGER DEFAULT 0 NOT NULL,
    total_orders INTEGER DEFAULT 0 NOT NULL
);

-- Enable RLS on table_sessions
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to table_sessions" ON public.table_sessions
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
);

-- Enforce one active shared session per table
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_table_session ON public.table_sessions(table_id) WHERE (is_active = true);

-- 3. Prepare migration for existing data
-- Deactivate all currently active sessions to safely apply schema changes without conflicting constraints
UPDATE public.dining_sessions SET is_active = false WHERE is_active = true;

-- 4. Alter dining_sessions (Now represents Device Sessions)
ALTER TABLE public.dining_sessions ADD COLUMN IF NOT EXISTS table_session_id UUID REFERENCES public.table_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.dining_sessions ADD COLUMN IF NOT EXISTS customer_alias TEXT DEFAULT 'Guest' NOT NULL;
ALTER TABLE public.dining_sessions ADD COLUMN IF NOT EXISTS seat_number INTEGER NULL;

-- Drop the old unique constraint that prevented multiple active devices per table
DROP INDEX IF EXISTS public.idx_unique_active_session_per_table;

-- 5. Alter orders and table_requests to track BOTH table and device session
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS table_session_id UUID REFERENCES public.table_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.table_requests ADD COLUMN IF NOT EXISTS table_session_id UUID REFERENCES public.table_sessions(id) ON DELETE SET NULL;

-- Create Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_orders_table_session ON public.orders(table_session_id);
CREATE INDEX IF NOT EXISTS idx_dining_sessions_table_session ON public.dining_sessions(table_session_id);

-- 6. Update PostgreSQL Session Revocation RPCs (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.revoke_dining_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() AND role IN ('Owner', 'Manager')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Eviction requires elevated privileges';
    END IF;

    UPDATE public.dining_sessions
    SET is_active = false
    WHERE id = p_session_id;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_table_sessions(p_table_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() AND role IN ('Owner', 'Manager')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Eviction requires elevated privileges';
    END IF;

    -- Deactivate the table session
    UPDATE public.table_sessions
    SET is_active = false, closed_at = now()
    WHERE table_id = p_table_id AND is_active = true;

    -- Deactivate all linked dining sessions
    UPDATE public.dining_sessions
    SET is_active = false
    WHERE table_id = p_table_id;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_all_dining_sessions()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() AND role IN ('Owner', 'Manager')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Eviction requires elevated privileges';
    END IF;

    UPDATE public.table_sessions SET is_active = false, closed_at = now();
    UPDATE public.dining_sessions SET is_active = false;

    RETURN true;
END;
$$;

-- 7. Automated Retention & Security Cleanup Task Update
CREATE OR REPLACE FUNCTION public.perform_security_cleanup()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_retention_days INTEGER;
BEGIN
    SELECT threat_log_retention_days INTO v_retention_days FROM public.cafe_settings LIMIT 1;
    IF v_retention_days IS NULL THEN
        v_retention_days := 90;
    END IF;

    DELETE FROM public.security_threat_logs WHERE created_at < (now() - (v_retention_days || ' days')::INTERVAL);
    DELETE FROM public.rate_limits WHERE window_start < (now() - INTERVAL '24 hours');
    DELETE FROM public.request_nonces WHERE created_at < (now() - INTERVAL '2 hours');
    
    -- Cleanup deactivated sessions
    DELETE FROM public.dining_sessions WHERE is_active = false AND created_at < (now() - INTERVAL '3 days');
    DELETE FROM public.table_sessions WHERE is_active = false AND created_at < (now() - INTERVAL '3 days');
    
    -- Auto-close table sessions where all devices are inactive and the grace period has expired
    -- Note: Since Next.js manages the actual timer, we ensure abandoned sessions naturally expire.
    UPDATE public.table_sessions
    SET is_active = false, closed_at = now()
    WHERE is_active = true AND expires_at < now();
END;
$$;

-- 8. Create Secure Order Submission RPC Update
CREATE OR REPLACE FUNCTION submit_customer_order(
    p_session_id UUID,
    p_session_token TEXT,
    p_idempotency_key UUID,
    p_applied_promotion_id UUID,
    p_items JSONB,
    p_nonce TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_device_session public.dining_sessions%ROWTYPE;
    v_table_session public.table_sessions%ROWTYPE;
    v_table_number INT;
    v_cafe_settings public.cafe_settings%ROWTYPE;
    v_order_id UUID;
    v_total_amount NUMERIC := 0;
    v_item RECORD;
    v_db_item public.menu_items%ROWTYPE;
    v_item_total NUMERIC;
    v_nonce_record public.request_nonces%ROWTYPE;
    v_existing_order_id UUID;
    v_existing_order_status TEXT;
BEGIN
    -- 1. Validate Device Session
    SELECT * INTO v_device_session 
    FROM public.dining_sessions 
    WHERE id = p_session_id AND session_token = p_session_token AND is_active = true AND expires_at > now();
    
    IF v_device_session.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Invalid or expired dining session');
    END IF;

    -- 2. Validate Table Session
    SELECT * INTO v_table_session
    FROM public.table_sessions
    WHERE id = v_device_session.table_session_id AND is_active = true AND expires_at > now();

    IF v_table_session.id IS NULL THEN
        RETURN jsonb_build_object('error', 'The table session has ended. Please scan the QR code again.');
    END IF;

    -- Get Table Info
    SELECT table_number INTO v_table_number 
    FROM public.restaurant_tables 
    WHERE id = v_device_session.table_id AND is_active = true AND qr_status = 'Active';
    
    IF v_table_number IS NULL THEN
        RETURN jsonb_build_object('error', 'This table QR code is currently disabled or inactive');
    END IF;

    -- 3. Validate Cafe Settings
    SELECT * INTO v_cafe_settings FROM public.cafe_settings WHERE id = 1;
    IF v_cafe_settings.ordering_enabled = false OR v_cafe_settings.accept_new_orders = false OR v_cafe_settings.qr_emergency_disabled = true THEN
        RETURN jsonb_build_object('error', 'Ordering is currently disabled by the cafe');
    END IF;

    -- 4. Check Idempotency Key
    SELECT id, status INTO v_existing_order_id, v_existing_order_status 
    FROM public.orders 
    WHERE idempotency_key = p_idempotency_key;
    
    IF v_existing_order_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'orderId', v_existing_order_id, 'status', v_existing_order_status, 'isDuplicate', true);
    END IF;

    -- 5. Validate and Consume Nonce
    SELECT * INTO v_nonce_record 
    FROM public.request_nonces 
    WHERE session_id = p_session_id AND nonce = p_nonce AND consumed_at IS NULL;
    
    IF v_nonce_record.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Security token (nonce) has already been consumed or is invalid');
    END IF;

    UPDATE public.request_nonces SET consumed_at = now() WHERE id = v_nonce_record.id;

    -- 6. Validate and Calculate Items price
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id UUID, quantity INT, notes TEXT) LOOP
        SELECT * INTO v_db_item FROM public.menu_items WHERE id = v_item.id AND is_available = true AND deleted_at IS NULL;
        IF v_db_item.id IS NULL THEN
            RAISE EXCEPTION 'Menu item not found or currently unavailable';
        END IF;
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Invalid quantity specified';
        END IF;
        v_total_amount := v_total_amount + (v_db_item.price * v_item.quantity);
    END LOOP;

    -- 7. Validate Promotion if provided
    IF p_applied_promotion_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.promotions 
            WHERE id = p_applied_promotion_id AND status = 'Active' 
              AND (start_date IS NULL OR start_date <= CURRENT_DATE) 
              AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        ) THEN
            RAISE EXCEPTION 'Invalid or inactive promotion applied';
        END IF;
    END IF;

    -- 8. Insert Order (Linking BOTH Table Session and Device Session)
    INSERT INTO public.orders (table_number, total_amount, status, idempotency_key, applied_promotion_id, session_id, table_session_id)
    VALUES (v_table_number, v_total_amount, 'Pending', p_idempotency_key, p_applied_promotion_id, p_session_id, v_table_session.id)
    RETURNING id INTO v_order_id;

    -- 9. Insert Order Items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id UUID, quantity INT, notes TEXT) LOOP
        SELECT * INTO v_db_item FROM public.menu_items WHERE id = v_item.id;
        INSERT INTO public.order_items (order_id, item_name, quantity, item_price, notes)
        VALUES (v_order_id, v_db_item.name, v_item.quantity, v_db_item.price, v_item.notes);
    END LOOP;

    -- Update total orders on table session
    UPDATE public.table_sessions SET total_orders = total_orders + 1 WHERE id = v_table_session.id;

    RETURN jsonb_build_object('success', true, 'orderId', v_order_id, 'status', 'Pending', 'isDuplicate', false);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- 9. Create Secure Table Request RPC Update
CREATE OR REPLACE FUNCTION submit_table_request(
    p_session_id UUID,
    p_session_token TEXT,
    p_request_type TEXT,
    p_additional_info TEXT,
    p_nonce TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_device_session public.dining_sessions%ROWTYPE;
    v_table_session public.table_sessions%ROWTYPE;
    v_table_number INT;
    v_request_id UUID;
    v_nonce_record public.request_nonces%ROWTYPE;
BEGIN
    -- 1. Validate Session
    SELECT * INTO v_device_session 
    FROM public.dining_sessions 
    WHERE id = p_session_id AND session_token = p_session_token AND is_active = true AND expires_at > now();
    
    IF v_device_session.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Invalid or expired dining session');
    END IF;

    -- 2. Validate Table Session
    SELECT * INTO v_table_session
    FROM public.table_sessions
    WHERE id = v_device_session.table_session_id AND is_active = true AND expires_at > now();

    IF v_table_session.id IS NULL THEN
        RETURN jsonb_build_object('error', 'The table session has ended. Please scan the QR code again.');
    END IF;

    -- Get Table Info
    SELECT table_number INTO v_table_number 
    FROM public.restaurant_tables 
    WHERE id = v_device_session.table_id AND is_active = true AND qr_status = 'Active';
    
    IF v_table_number IS NULL THEN
        RETURN jsonb_build_object('error', 'This table QR code is currently disabled or inactive');
    END IF;

    -- 3. Validate and Consume Nonce
    SELECT * INTO v_nonce_record 
    FROM public.request_nonces 
    WHERE session_id = p_session_id AND nonce = p_nonce AND consumed_at IS NULL;
    
    IF v_nonce_record.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Security token (nonce) has already been consumed or is invalid');
    END IF;

    UPDATE public.request_nonces SET consumed_at = now() WHERE id = v_nonce_record.id;

    -- 4. Insert Table Request
    INSERT INTO public.table_requests (table_number, request_type, additional_info, status, table_session_id)
    VALUES (v_table_number, p_request_type, p_additional_info, 'Pending', v_table_session.id)
    RETURNING id INTO v_request_id;

    RETURN jsonb_build_object('success', true, 'requestId', v_request_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
