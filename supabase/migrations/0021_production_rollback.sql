-- 1. Drop Foreign Keys referencing sessions
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_session_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_table_session_id_fkey;
ALTER TABLE public.table_requests DROP CONSTRAINT IF EXISTS table_requests_session_id_fkey;
ALTER TABLE public.table_requests DROP CONSTRAINT IF EXISTS table_requests_table_session_id_fkey;

-- 2. Drop the session tables entirely (this automatically removes their data and policies)
DROP TABLE IF EXISTS public.dining_sessions CASCADE;
DROP TABLE IF EXISTS public.table_sessions CASCADE;

-- 3. Modify request_nonces to drop session_id and use token instead, or just make it standalone
-- Since a nonce is just a unique string tied to a request, we can just remove session_id and keep nonce.
ALTER TABLE public.request_nonces DROP CONSTRAINT IF EXISTS request_nonces_session_id_fkey;
ALTER TABLE public.request_nonces DROP COLUMN IF EXISTS session_id;

-- 4. Recreate get_nonce RPC to not require session_id
CREATE OR REPLACE FUNCTION get_nonce()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_nonce TEXT;
BEGIN
    v_nonce := encode(gen_random_bytes(32), 'hex');
    INSERT INTO public.request_nonces (nonce)
    VALUES (v_nonce);
    RETURN v_nonce;
END;
$$;

-- 5. Recreate submit_customer_order RPC
CREATE OR REPLACE FUNCTION submit_customer_order(
    p_table_number INT,
    p_table_token TEXT,
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
    v_table_id UUID;
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
    -- 1. Validate Table and Token
    SELECT id INTO v_table_id 
    FROM public.restaurant_tables 
    WHERE table_number = p_table_number AND token = p_table_token AND is_active = true AND qr_status = 'Active';
    
    IF v_table_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Invalid table QR code or table is inactive');
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
    WHERE nonce = p_nonce AND consumed_at IS NULL;
    
    IF v_nonce_record.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Security token (nonce) has already been consumed or is invalid');
    END IF;

    UPDATE public.request_nonces SET consumed_at = now() WHERE id = v_nonce_record.id;

    -- 5. Validate and Calculate Items price
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

    -- 6. Validate Promotion if provided
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

    -- 7. Insert Order
    INSERT INTO public.orders (table_number, total_amount, status, idempotency_key, applied_promotion_id)
    VALUES (p_table_number, v_total_amount, 'Pending', p_idempotency_key, p_applied_promotion_id)
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


-- 6. Recreate submit_table_request RPC
CREATE OR REPLACE FUNCTION submit_table_request(
    p_table_number INT,
    p_table_token TEXT,
    p_request_type TEXT,
    p_additional_info TEXT,
    p_nonce TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_table_id UUID;
    v_request_id UUID;
    v_nonce_record public.request_nonces%ROWTYPE;
BEGIN
    -- 1. Validate Table and Token
    SELECT id INTO v_table_id 
    FROM public.restaurant_tables 
    WHERE table_number = p_table_number AND token = p_table_token AND is_active = true AND qr_status = 'Active';
    
    IF v_table_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Invalid table QR code or table is inactive');
    END IF;

    -- 2. Validate and Consume Nonce
    SELECT * INTO v_nonce_record 
    FROM public.request_nonces 
    WHERE nonce = p_nonce AND consumed_at IS NULL;
    
    IF v_nonce_record.id IS NULL THEN
        RETURN jsonb_build_object('error', 'Security token (nonce) has already been consumed or is invalid');
    END IF;

    UPDATE public.request_nonces SET consumed_at = now() WHERE id = v_nonce_record.id;

    -- 3. Insert Request
    INSERT INTO public.table_requests (table_number, request_type, additional_info, status)
    VALUES (p_table_number, p_request_type, p_additional_info, 'Pending')
    RETURNING id INTO v_request_id;

    RETURN jsonb_build_object('success', true, 'requestId', v_request_id, 'status', 'Pending');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
