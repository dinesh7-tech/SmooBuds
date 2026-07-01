-- ==========================================
-- 0020_customer_identity.sql
-- Customer Name Identification Upgrade
-- ==========================================

-- 1. Rename columns to support broader identity system
ALTER TABLE public.cafe_settings RENAME COLUMN enable_customer_aliases TO require_customer_name;
ALTER TABLE public.dining_sessions RENAME COLUMN customer_alias TO display_name;

-- 2. Add is_name_set to track if the user has explicitly entered their name
ALTER TABLE public.dining_sessions ADD COLUMN IF NOT EXISTS is_name_set BOOLEAN DEFAULT false NOT NULL;
UPDATE public.dining_sessions SET is_name_set = true WHERE display_name NOT LIKE 'Guest %';

-- 3. Add customer_name to orders and table_requests for historical immutability
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT NULL;
ALTER TABLE public.table_requests ADD COLUMN IF NOT EXISTS customer_name TEXT NULL;

-- 4. Update Secure Order Submission RPC to insert customer_name
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

    -- 8. Insert Order (Linking BOTH Table Session and Device Session, plus storing immutable display_name)
    INSERT INTO public.orders (table_number, total_amount, status, idempotency_key, applied_promotion_id, session_id, table_session_id, customer_name)
    VALUES (v_table_number, v_total_amount, 'Pending', p_idempotency_key, p_applied_promotion_id, p_session_id, v_table_session.id, v_device_session.display_name)
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

-- 5. Update Secure Table Request RPC Update to insert customer_name
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
    INSERT INTO public.table_requests (table_number, request_type, additional_info, status, table_session_id, customer_name)
    VALUES (v_table_number, p_request_type, p_additional_info, 'Pending', v_table_session.id, v_device_session.display_name)
    RETURNING id INTO v_request_id;

    RETURN jsonb_build_object('success', true, 'requestId', v_request_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- 6. Create RPC to set customer name safely
CREATE OR REPLACE FUNCTION set_customer_name(
    p_session_id UUID,
    p_session_token TEXT,
    p_name TEXT,
    p_force_append BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_device_session public.dining_sessions%ROWTYPE;
    v_existing_count INT;
    v_final_name TEXT;
BEGIN
    -- 1. Validate Session
    SELECT * INTO v_device_session 
    FROM public.dining_sessions 
    WHERE id = p_session_id AND session_token = p_session_token AND is_active = true AND expires_at > now();
    
    IF v_device_session.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Invalid or expired dining session');
    END IF;

    v_final_name := p_name;

    -- 2. Check for duplicates in the same table session
    IF p_force_append = false THEN
        SELECT COUNT(*) INTO v_existing_count
        FROM public.dining_sessions
        WHERE table_session_id = v_device_session.table_session_id
          AND is_active = true
          AND id != p_session_id
          AND (display_name = p_name OR display_name LIKE p_name || ' (%)');

        IF v_existing_count > 0 THEN
            RETURN jsonb_build_object('success', false, 'isDuplicate', true, 'suggestedName', p_name || ' (' || (v_existing_count + 1) || ')');
        END IF;
    END IF;

    -- 3. Update Name
    UPDATE public.dining_sessions
    SET display_name = v_final_name, is_name_set = true
    WHERE id = p_session_id;

    RETURN jsonb_build_object('success', true, 'displayName', v_final_name);
END;
$$;
