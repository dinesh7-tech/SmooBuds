-- ==========================================
-- 0014_login_security_rpc.sql
-- Adds an RPC to safely record login attempts without RLS bypass
-- ==========================================

CREATE OR REPLACE FUNCTION record_login_attempt(
    p_email TEXT, 
    p_success BOOLEAN, 
    p_device TEXT, 
    p_browser TEXT, 
    p_ip TEXT,
    p_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role user_roles%ROWTYPE;
    v_expected_secret TEXT;
    v_locked BOOLEAN := false;
BEGIN
    -- Verify the server secret to prevent public API abuse
    -- We'll expect the Server Action to pass a specific hardcoded secret (or one from vault)
    -- For SmooBuds, we'll verify it matches a generic known key for the server
    IF p_secret != 'smoobuds_internal_rpc_secret_2026' THEN
        RETURN jsonb_build_object('error', 'Unauthorized RPC call');
    END IF;

    -- Fetch the user role
    SELECT * INTO v_user_role FROM user_roles WHERE email = LOWER(TRIM(p_email));
    
    IF v_user_role.id IS NULL THEN
        RETURN jsonb_build_object('error', 'User not found');
    END IF;

    -- Check if locked
    IF v_user_role.locked_until > now() THEN
        v_locked := true;
    END IF;

    IF p_success THEN
        -- Only record success if not locked
        IF NOT v_locked THEN
            UPDATE user_roles 
            SET failed_attempts = 0, last_login = now() 
            WHERE id = v_user_role.id;
            
            INSERT INTO login_history (user_id, email, status, device, browser, ip_address)
            VALUES (v_user_role.user_id, LOWER(TRIM(p_email)), 'Success', p_device, p_browser, p_ip);
            
            RETURN jsonb_build_object('success', true);
        ELSE
            -- Record a failed attempt because they tried while locked
            INSERT INTO login_history (user_id, email, status, device, browser, ip_address)
            VALUES (v_user_role.user_id, LOWER(TRIM(p_email)), 'Failed', p_device, p_browser, p_ip);
            
            RETURN jsonb_build_object('error', 'Account locked', 'locked_until', v_user_role.locked_until);
        END IF;
    ELSE
        -- Failed login
        UPDATE user_roles 
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
        WHERE id = v_user_role.id
        RETURNING * INTO v_user_role;
        
        INSERT INTO login_history (user_id, email, status, device, browser, ip_address)
        VALUES (v_user_role.user_id, LOWER(TRIM(p_email)), 'Failed', p_device, p_browser, p_ip);

        IF v_user_role.locked_until > now() THEN
            RETURN jsonb_build_object('error', 'Account locked', 'locked_until', v_user_role.locked_until);
        ELSE
            RETURN jsonb_build_object('error', 'Invalid credentials', 'attempts_remaining', 5 - v_user_role.failed_attempts);
        END IF;
    END IF;
END;
$$;
