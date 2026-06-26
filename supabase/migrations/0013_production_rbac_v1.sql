-- ==========================================
-- 0013_production_rbac_v1.sql
-- Production User Management & RBAC V1
-- Safely modifies schema without dropping data.
-- ==========================================

DO $$ 
BEGIN
    -- Only proceed if the schema matches our audit expectations
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'PRIMARY KEY' 
        AND table_name = 'user_roles' 
        AND constraint_name = 'user_roles_pkey'
    ) THEN
        RAISE EXCEPTION 'Schema mismatch: user_roles_pkey not found. Aborting migration.';
    END IF;

    -- Drop primary key safely
    ALTER TABLE user_roles DROP CONSTRAINT user_roles_pkey;

    -- Add surrogate primary key
    ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
    
    -- Make user_id nullable but unique
    ALTER TABLE user_roles ALTER COLUMN user_id DROP NOT NULL;
    
    -- Ensure unique constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'UNIQUE' 
        AND table_name = 'user_roles' 
        AND constraint_name = 'user_roles_user_id_key'
    ) THEN
        ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- Add new columns safely to user_roles
DO $$ BEGIN ALTER TABLE user_roles ADD COLUMN email TEXT UNIQUE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE user_roles ADD COLUMN name TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE user_roles ADD COLUMN status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Active', 'Inactive', 'Locked', 'Suspended')); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE user_roles ADD COLUMN failed_attempts INT DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE user_roles ADD COLUMN locked_until TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE user_roles ADD COLUMN deleted_at TIMESTAMPTZ NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE user_roles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now(); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE user_roles ADD COLUMN last_login TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Soft deletes for other tables
DO $$ BEGIN ALTER TABLE promotions ADD COLUMN deleted_at TIMESTAMPTZ NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE menu_items ADD COLUMN deleted_at TIMESTAMPTZ NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Create login_history table
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
CREATE POLICY "Admins can view login history" 
ON login_history FOR SELECT 
TO authenticated 
USING (check_is_owner(auth.uid()));

-- Expand audit_logs
DO $$ BEGIN ALTER TABLE audit_logs ADD COLUMN device TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE audit_logs ADD COLUMN browser TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE audit_logs ADD COLUMN ip_address TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE audit_logs ADD COLUMN target_user_id UUID; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Triggers for User Roles
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
    -- If deleting an owner, or changing an owner's role/status/deleted_at
    IF (TG_OP = 'DELETE' AND OLD.role = 'Owner') OR
       (TG_OP = 'UPDATE' AND OLD.role = 'Owner' AND 
        (NEW.role != 'Owner' OR NEW.status != 'Active' OR NEW.deleted_at IS NOT NULL)) THEN
        
        -- Count how many other active owners exist
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

-- RPC for secure account linking
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

    -- Handle the very first user (Owner setup)
    SELECT COUNT(*) INTO v_total_users FROM user_roles;
    IF v_total_users = 0 THEN
        INSERT INTO user_roles (user_id, email, role, status)
        VALUES (v_user_id, v_email, 'Owner', 'Active');
        RETURN TRUE;
    END IF;

    -- Find the pre-authorized row for this email
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
