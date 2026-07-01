-- ==========================================
-- 0017_security_hardening.sql
-- Production Security Hardening Pass
-- ==========================================

-- 1. Alter restaurant_tables to upgrade QR Token Architecture
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS qr_token TEXT;
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS qr_version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS qr_created_at TIMESTAMPTZ DEFAULT now() NOT NULL;
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS qr_last_rotated_at TIMESTAMPTZ DEFAULT now() NOT NULL;
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS qr_status TEXT DEFAULT 'Active' CHECK (qr_status IN ('Active', 'Disabled')) NOT NULL;
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

-- Populate existing rows with 256-bit (32 bytes = 64 characters hex) random tokens if they don't have it
UPDATE public.restaurant_tables 
SET qr_token = encode(gen_random_bytes(32), 'hex') 
WHERE qr_token IS NULL;

-- Make qr_token NOT NULL after populating
ALTER TABLE public.restaurant_tables ALTER COLUMN qr_token SET NOT NULL;

-- 2. Alter cafe_settings to add dynamic security settings
ALTER TABLE public.cafe_settings ADD COLUMN IF NOT EXISTS session_timeout_minutes INTEGER DEFAULT 180 NOT NULL;
ALTER TABLE public.cafe_settings ADD COLUMN IF NOT EXISTS qr_emergency_disabled BOOLEAN DEFAULT false NOT NULL;

-- 3. Create dining_sessions table
CREATE TABLE IF NOT EXISTS public.dining_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    browser_fingerprint_hash TEXT NOT NULL,
    user_agent_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL
);

-- Enable RLS on dining_sessions
ALTER TABLE public.dining_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can view sessions, public has no direct access
CREATE POLICY "Admins full access to dining_sessions" 
ON public.dining_sessions FOR ALL TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
);

-- 4. Create request_nonces table (Replay Protection)
CREATE TABLE IF NOT EXISTS public.request_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.dining_sessions(id) ON DELETE CASCADE,
    nonce TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    consumed_at TIMESTAMPTZ NULL
);

-- Enable RLS on request_nonces
ALTER TABLE public.request_nonces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view request_nonces" 
ON public.request_nonces FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
);

-- 5. Create rate_limits table (Rate Limiting)
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    hits INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_key_window ON public.rate_limits (key, window_start);

-- Enable RLS on rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view rate_limits" 
ON public.rate_limits FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
);

-- 6. Add session_id to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.dining_sessions(id) ON DELETE SET NULL;

-- 7. Define secure functions to resolve session cookies in RLS
CREATE OR REPLACE FUNCTION current_dining_session_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_cookie TEXT;
    v_parts TEXT[];
    v_session_id UUID;
    v_token TEXT;
    v_valid_id UUID;
BEGIN
    -- Retrieve request cookies from PostgREST environment
    v_cookie := current_setting('request.headers', true)::json->>'cookie';
    IF v_cookie IS NULL THEN
        RETURN NULL;
    END IF;

    -- Extract smoobuds_table_session cookie value
    v_cookie := substring(v_cookie from 'smoobuds_table_session=([^;]+)');
    IF v_cookie IS NULL THEN
        RETURN NULL;
    END IF;

    -- Split cookie: session_id:session_token:expiresAt:signature
    v_parts := string_to_array(v_cookie, ':');
    IF array_length(v_parts, 1) < 2 THEN
        RETURN NULL;
    END IF;

    BEGIN
        v_session_id := v_parts[1]::UUID;
        v_token := v_parts[2];
    EXCEPTION
        WHEN OTHERS THEN
            RETURN NULL;
    END;

    -- Verify directly in the DB that the session ID matches the secure token and is active
    SELECT id INTO v_valid_id
    FROM public.dining_sessions
    WHERE id = v_session_id
      AND session_token = v_token
      AND is_active = true
      AND expires_at > now();

    RETURN v_valid_id;
END;
$$;

-- 8. Revise public RLS policies for orders & order_items
DROP POLICY IF EXISTS "Public read orders" ON public.orders;
DROP POLICY IF EXISTS "Public insert orders" ON public.orders;
DROP POLICY IF EXISTS "Public read order_items" ON public.order_items;
DROP POLICY IF EXISTS "Public insert order_items" ON public.order_items;
DROP POLICY IF EXISTS "Public can create table_requests" ON public.table_requests;
DROP POLICY IF EXISTS "Public read table_requests" ON public.table_requests;
DROP POLICY IF EXISTS "Public insert table_requests" ON public.table_requests;

-- Enable SELECT on orders strictly to the customer's active session
CREATE POLICY "Public read orders" ON public.orders
    FOR SELECT TO public
    USING (session_id = current_dining_session_id());

-- Enable SELECT on order_items only if they belong to accessible orders
CREATE POLICY "Public read order_items" ON public.order_items
    FOR SELECT TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
        )
    );

-- 9. Create Rate Limiting Helper RPC
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT, 
    p_limit INT, 
    p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_hits INT;
    v_window_start TIMESTAMPTZ;
BEGIN
    v_window_start := date_trunc('minute', v_now);
    
    -- Cleanup limits older than 1 hour to keep table small
    DELETE FROM public.rate_limits 
    WHERE window_start < v_now - interval '1 hour';

    -- Record hit
    INSERT INTO public.rate_limits (key, hits, window_start)
    VALUES (p_key, 1, v_window_start)
    ON CONFLICT (key, window_start) 
    DO UPDATE SET hits = public.rate_limits.hits + 1;

    -- Calculate total hits in the window
    SELECT COALESCE(SUM(hits), 0) INTO v_hits 
    FROM public.rate_limits 
    WHERE key = p_key 
      AND window_start >= v_now - (p_window_seconds || ' seconds')::interval;

    IF v_hits > p_limit THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- 10. Create Nonce Generation RPC
CREATE OR REPLACE FUNCTION generate_session_nonce(
    p_session_id UUID,
    p_session_token TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_nonce TEXT;
    v_valid BOOLEAN;
BEGIN
    -- Validate session matches token
    SELECT EXISTS (
        SELECT 1 FROM public.dining_sessions 
        WHERE id = p_session_id AND session_token = p_session_token AND is_active = true AND expires_at > now()
    ) INTO v_valid;

    IF NOT v_valid THEN
        RAISE EXCEPTION 'Invalid session credentials';
    END IF;

    -- Generate random 32-char hex nonce
    v_nonce := encode(gen_random_bytes(16), 'hex');

    INSERT INTO public.request_nonces (session_id, nonce)
    VALUES (p_session_id, v_nonce);

    RETURN v_nonce;
END;
$$;

-- 11. Create Secure Order Submission RPC
CREATE OR REPLACE FUNCTION submit_customer_order(
    p_session_id UUID,
    p_session_token TEXT,
    p_idempotency_key UUID,
    p_applied_promotion_id UUID,
    p_items JSONB, -- [{"id": "item_uuid", "quantity": 2, "notes": "No onion"}]
    p_nonce TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session public.dining_sessions%ROWTYPE;
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
    -- 1. Validate Session
    SELECT * INTO v_session 
    FROM public.dining_sessions 
    WHERE id = p_session_id AND session_token = p_session_token AND is_active = true AND expires_at > now();
    
    IF v_session.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Invalid or expired dining session');
    END IF;

    -- Get Table Info
    SELECT table_number INTO v_table_number 
    FROM public.restaurant_tables 
    WHERE id = v_session.table_id AND is_active = true AND qr_status = 'Active';
    
    IF v_table_number IS NULL THEN
        RETURN jsonb_build_object('error', 'This table QR code is currently disabled or inactive');
    END IF;

    -- 2. Validate Cafe Settings
    SELECT * INTO v_cafe_settings FROM public.cafe_settings WHERE id = 1;
    IF v_cafe_settings.ordering_enabled = false OR v_cafe_settings.accept_new_orders = false OR v_cafe_settings.qr_emergency_disabled = true THEN
        RETURN jsonb_build_object('error', 'Ordering is currently disabled by the cafe');
    END IF;

    -- 3. Check Idempotency Key
    SELECT id, status INTO v_existing_order_id, v_existing_order_status 
    FROM public.orders 
    WHERE idempotency_key = p_idempotency_key;
    
    IF v_existing_order_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'orderId', v_existing_order_id, 'status', v_existing_order_status, 'isDuplicate', true);
    END IF;

    -- 4. Validate and Consume Nonce
    SELECT * INTO v_nonce_record 
    FROM public.request_nonces 
    WHERE session_id = p_session_id AND nonce = p_nonce AND consumed_at IS NULL;
    
    IF v_nonce_record.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Security token (nonce) has already been consumed or is invalid');
    END IF;

    -- Mark nonce as consumed
    UPDATE public.request_nonces 
    SET consumed_at = now() 
    WHERE id = v_nonce_record.id;

    -- 5. Validate and Calculate Items price
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id UUID, quantity INT, notes TEXT) LOOP
        -- Fetch item from DB
        SELECT * INTO v_db_item 
        FROM public.menu_items 
        WHERE id = v_item.id AND is_available = true AND deleted_at IS NULL;
        
        IF v_db_item.id IS NULL THEN
            RAISE EXCEPTION 'Menu item not found or currently unavailable';
        END IF;

        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Invalid quantity specified';
        END IF;

        v_item_total := v_db_item.price * v_item.quantity;
        v_total_amount := v_total_amount + v_item_total;
    END LOOP;

    -- 6. Validate Promotion if provided
    IF p_applied_promotion_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.promotions 
            WHERE id = p_applied_promotion_id 
              AND status = 'Active' 
              AND (start_date IS NULL OR start_date <= CURRENT_DATE) 
              AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        ) THEN
            RAISE EXCEPTION 'Invalid or inactive promotion applied';
        END IF;
    END IF;

    -- 7. Insert Order
    INSERT INTO public.orders (table_number, total_amount, status, idempotency_key, applied_promotion_id, session_id)
    VALUES (v_table_number, v_total_amount, 'Pending', p_idempotency_key, p_applied_promotion_id, p_session_id)
    RETURNING id INTO v_order_id;

    -- 8. Insert Order Items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id UUID, quantity INT, notes TEXT) LOOP
        SELECT * INTO v_db_item FROM public.menu_items WHERE id = v_item.id;
        
        INSERT INTO public.order_items (order_id, item_name, quantity, item_price, notes)
        VALUES (v_order_id, v_db_item.name, v_item.quantity, v_db_item.price, v_item.notes);
    END LOOP;

    RETURN jsonb_build_object('success', true, 'orderId', v_order_id, 'status', 'Pending', 'isDuplicate', false);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- 12. Create Secure Table Request RPC
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
    v_session public.dining_sessions%ROWTYPE;
    v_table_number INT;
    v_request_id UUID;
    v_nonce_record public.request_nonces%ROWTYPE;
BEGIN
    -- 1. Validate Session
    SELECT * INTO v_session 
    FROM public.dining_sessions 
    WHERE id = p_session_id AND session_token = p_session_token AND is_active = true AND expires_at > now();
    
    IF v_session.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Invalid or expired dining session');
    END IF;

    -- Get Table Info
    SELECT table_number INTO v_table_number 
    FROM public.restaurant_tables 
    WHERE id = v_session.table_id AND is_active = true AND qr_status = 'Active';
    
    IF v_table_number IS NULL THEN
        RETURN jsonb_build_object('error', 'This table QR code is currently disabled or inactive');
    END IF;

    -- 2. Validate and Consume Nonce
    SELECT * INTO v_nonce_record 
    FROM public.request_nonces 
    WHERE session_id = p_session_id AND nonce = p_nonce AND consumed_at IS NULL;
    
    IF v_nonce_record.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Security token (nonce) has already been consumed or is invalid');
    END IF;

    -- Mark nonce as consumed
    UPDATE public.request_nonces 
    SET consumed_at = now() 
    WHERE id = v_nonce_record.id;

    -- 3. Insert Table Request
    INSERT INTO public.table_requests (table_number, request_type, additional_info, status)
    VALUES (v_table_number, p_request_type, p_additional_info, 'Pending')
    RETURNING id INTO v_request_id;

    RETURN jsonb_build_object('success', true, 'requestId', v_request_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Explicit Table Grants for RPC functions
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_session_nonce(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_customer_order(UUID, TEXT, UUID, UUID, JSONB, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_table_request(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
