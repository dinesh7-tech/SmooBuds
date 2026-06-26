-- ==========================================
-- 0015_audit_and_sessions.sql
-- Adds session_id to login_history and RPCs for User Management
-- ==========================================

-- 1. Add session_id to login_history and Foreign Keys for relations
DO $$ 
BEGIN 
    ALTER TABLE login_history ADD COLUMN session_id UUID; 
EXCEPTION 
    WHEN duplicate_column THEN NULL; 
END $$;

DO $$
BEGIN
    ALTER TABLE login_history ADD CONSTRAINT fk_login_history_user_id FOREIGN KEY (user_id) REFERENCES user_roles(user_id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_user_id FOREIGN KEY (user_id) REFERENCES user_roles(user_id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_target_user_id FOREIGN KEY (target_user_id) REFERENCES user_roles(user_id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Update record_login_attempt to accept session_id
CREATE OR REPLACE FUNCTION record_login_attempt(
    p_email TEXT, 
    p_success BOOLEAN, 
    p_device TEXT, 
    p_browser TEXT, 
    p_ip TEXT,
    p_secret TEXT,
    p_session_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role user_roles%ROWTYPE;
    v_locked BOOLEAN := false;
BEGIN
    IF p_secret != 'smoobuds_internal_rpc_secret_2026' THEN
        RETURN jsonb_build_object('error', 'Unauthorized RPC call');
    END IF;

    SELECT * INTO v_user_role FROM user_roles WHERE email = LOWER(TRIM(p_email));
    
    IF v_user_role.id IS NULL THEN
        RETURN jsonb_build_object('error', 'User not found');
    END IF;

    IF v_user_role.locked_until > now() THEN
        v_locked := true;
    END IF;

    IF p_success THEN
        IF NOT v_locked THEN
            UPDATE user_roles 
            SET failed_attempts = 0, last_login = now() 
            WHERE id = v_user_role.id;
            
            INSERT INTO login_history (user_id, email, status, device, browser, ip_address, session_id)
            VALUES (v_user_role.user_id, LOWER(TRIM(p_email)), 'Success', p_device, p_browser, p_ip, p_session_id);
            
            RETURN jsonb_build_object('success', true);
        ELSE
            INSERT INTO login_history (user_id, email, status, device, browser, ip_address, session_id)
            VALUES (v_user_role.user_id, LOWER(TRIM(p_email)), 'Failed', p_device, p_browser, p_ip, p_session_id);
            
            RETURN jsonb_build_object('error', 'Account locked', 'locked_until', v_user_role.locked_until);
        END IF;
    ELSE
        UPDATE user_roles 
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
        WHERE id = v_user_role.id
        RETURNING * INTO v_user_role;
        
        INSERT INTO login_history (user_id, email, status, device, browser, ip_address, session_id)
        VALUES (v_user_role.user_id, LOWER(TRIM(p_email)), 'Failed', p_device, p_browser, p_ip, p_session_id);

        IF v_user_role.locked_until > now() THEN
            RETURN jsonb_build_object('error', 'Account locked', 'locked_until', v_user_role.locked_until);
        ELSE
            RETURN jsonb_build_object('error', 'Invalid credentials', 'attempts_remaining', 5 - v_user_role.failed_attempts);
        END IF;
    END IF;
END;
$$;

-- 3. Update verify_session RPC
-- This allows verifyPermission() to check if the specific session is forced out via Supabase Postgres
CREATE OR REPLACE FUNCTION verify_active_session(
    p_user_id UUID,
    p_session_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_forced BOOLEAN;
BEGIN
    -- If no session_id provided, default to valid unless ALL are forced
    IF p_session_id IS NULL THEN
        RETURN TRUE;
    END IF;

    SELECT is_forced_logout INTO v_is_forced 
    FROM login_history 
    WHERE user_id = p_user_id AND session_id = p_session_id 
    ORDER BY login_time DESC 
    LIMIT 1;

    IF v_is_forced THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- 4. Audit Log Helper
CREATE OR REPLACE FUNCTION insert_audit_log(
    p_actor_id UUID,
    p_target_user_id UUID,
    p_action TEXT,
    p_details JSONB,
    p_device TEXT,
    p_browser TEXT,
    p_ip_address TEXT,
    p_secret TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_secret != 'smoobuds_internal_rpc_secret_2026' THEN
        RAISE EXCEPTION 'Unauthorized RPC call';
    END IF;

    INSERT INTO audit_logs (user_id, target_user_id, action, table_name, record_id, old_data, new_data, device, browser, ip_address)
    VALUES (
        p_actor_id,
        p_target_user_id,
        p_action,
        p_details->>'table_name',
        (p_details->>'record_id')::UUID,
        p_details->'old_data',
        p_details->'new_data',
        p_device,
        p_browser,
        p_ip_address
    );
END;
$$;
