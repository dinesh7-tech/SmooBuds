-- ==========================================
-- 0013b_production_rbac_recovery.sql
-- Recovery script for partially applied RBAC migration.
-- Makes all schema changes idempotent and safely adds missing columns.
-- ==========================================

DO $$ 
DECLARE
    v_has_id BOOLEAN;
    pkey_name TEXT;
BEGIN
    -- 1. Check if 'id' column exists in user_roles
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_roles' AND column_name = 'id'
    ) INTO v_has_id;

    -- If 'id' doesn't exist, we must convert the primary key and add 'id'
    IF NOT v_has_id THEN
        -- Find the exact name of the existing primary key constraint dynamically
        SELECT constraint_name INTO pkey_name
        FROM information_schema.table_constraints
        WHERE table_name = 'user_roles' AND constraint_type = 'PRIMARY KEY';

        -- Drop the primary key safely, whatever its name might be
        IF pkey_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS %I', pkey_name);
        END IF;

        -- Add surrogate primary key
        ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
        
        -- Make user_id nullable but unique
        ALTER TABLE user_roles ALTER COLUMN user_id DROP NOT NULL;
        
        -- Ensure unique constraint exists for user_id
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_type = 'UNIQUE' 
            AND table_name = 'user_roles' 
            AND constraint_name = 'user_roles_user_id_key'
        ) THEN
            ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
        END IF;
    END IF;
END $$;

-- 2. Add missing columns safely to user_roles
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Active', 'Inactive', 'Locked', 'Suspended'));
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- 3. Soft deletes for other tables
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- 4. Ensure login_history exists and its RLS policy is safe
CREATE TABLE IF NOT EXISTS login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    email TEXT NOT NULL,
    login_time TIMESTAMPTZ DEFAULT now() NOT NULL,
    logout_time TIMESTAMPTZ,
    last_activity TIMESTAMPTZ DEFAULT now(),
    device TEXT,
    browser TEXT,
    ip_address TEXT,
    status TEXT NOT NULL CHECK (status IN ('Success', 'Failed')),
    is_forced_logout BOOLEAN DEFAULT false
);

ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;

-- 5. Fix the policy safely using DROP POLICY IF EXISTS before CREATE POLICY
DROP POLICY IF EXISTS "Admins can view login history" ON login_history;
CREATE POLICY "Admins can view login history" 
ON login_history FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
);

-- 6. Expand audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_user_id UUID;

-- 7. Triggers for User Roles
CREATE OR REPLACE FUNCTION normalize_user_email()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email = LOWER(TRIM(NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_normalize_email ON user_roles;
CREATE TRIGGER trigger_normalize_email
    BEFORE INSERT OR UPDATE OF email ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION normalize_user_email();

CREATE OR REPLACE FUNCTION protect_last_owner()
RETURNS TRIGGER AS $$
DECLARE
    active_owners INT;
BEGIN
    IF (TG_OP = 'DELETE' AND OLD.role = 'Owner') OR
       (TG_OP = 'UPDATE' AND OLD.role = 'Owner' AND 
        (NEW.role != 'Owner' OR NEW.status != 'Active' OR NEW.deleted_at IS NOT NULL)) THEN
        
        SELECT COUNT(*) INTO active_owners 
        FROM user_roles 
        WHERE role = 'Owner' AND status = 'Active' AND deleted_at IS NULL AND id != OLD.id;

        IF active_owners < 1 THEN
            RAISE EXCEPTION 'Cannot perform action: The system must always have at least one active Owner.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_protect_owner ON user_roles;
CREATE TRIGGER trigger_protect_owner
    BEFORE UPDATE OR DELETE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION protect_last_owner();

CREATE OR REPLACE FUNCTION handle_email_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email THEN
        NEW.user_id = NULL;
        NEW.status = 'Pending';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_email_change ON user_roles;
CREATE TRIGGER trigger_email_change
    BEFORE UPDATE OF email ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION handle_email_change();

-- 8. RPC for secure account linking
CREATE OR REPLACE FUNCTION link_user_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
    v_role_id UUID;
    v_total_users INT;
BEGIN
    v_user_id := auth.uid();
    v_email := LOWER(TRIM(current_setting('request.jwt.claims', true)::json->>'email'));
    
    IF v_user_id IS NULL OR v_email IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT COUNT(*) INTO v_total_users FROM user_roles;
    IF v_total_users = 0 THEN
        INSERT INTO user_roles (user_id, email, role, status)
        VALUES (v_user_id, v_email, 'Owner', 'Active');
        RETURN TRUE;
    END IF;

    SELECT id INTO v_role_id 
    FROM user_roles 
    WHERE email = v_email AND (user_id IS NULL OR user_id = v_user_id);

    IF v_role_id IS NOT NULL THEN
        UPDATE user_roles 
        SET user_id = v_user_id, 
            status = CASE WHEN status = 'Pending' THEN 'Active' ELSE status END
        WHERE id = v_role_id;
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;
