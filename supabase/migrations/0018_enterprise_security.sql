-- ==========================================
-- 0018_enterprise_security.sql
-- Enterprise Security Hardening & Scalability Pass
-- ==========================================

-- 1. Create Threat Intelligence logs table
CREATE TABLE IF NOT EXISTS public.security_threat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_category TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    hashed_client_ip TEXT NOT NULL,
    hashed_browser_fingerprint TEXT NOT NULL,
    action_taken TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on threat logs
ALTER TABLE public.security_threat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to threat logs" ON public.security_threat_logs
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
);

-- 2. Alter public.cafe_settings to support V2.2 configurations
ALTER TABLE public.cafe_settings ADD COLUMN IF NOT EXISTS qr_token_strength TEXT DEFAULT '256-bit' CHECK (qr_token_strength IN ('128-bit', '256-bit', '512-bit')) NOT NULL;
ALTER TABLE public.cafe_settings ADD COLUMN IF NOT EXISTS lockdown_level INTEGER DEFAULT 0 CHECK (lockdown_level BETWEEN 0 AND 3) NOT NULL;
ALTER TABLE public.cafe_settings ADD COLUMN IF NOT EXISTS qr_rotation_schedule TEXT DEFAULT 'Manual only' CHECK (qr_rotation_schedule IN ('Daily', 'Weekly', 'Monthly', 'Manual only')) NOT NULL;
ALTER TABLE public.cafe_settings ADD COLUMN IF NOT EXISTS qr_rotation_grace_period_mins INTEGER DEFAULT 15 NOT NULL;
ALTER TABLE public.cafe_settings ADD COLUMN IF NOT EXISTS disable_legacy_qr BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE public.cafe_settings ADD COLUMN IF NOT EXISTS threat_log_retention_days INTEGER DEFAULT 90 NOT NULL;

-- 3. Alter public.restaurant_tables to support dynamic rotations and grace periods
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS previous_qr_token TEXT NULL;
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ NULL;

-- 4. Alter public.dining_sessions to support subnets, IP hashing, and trust scores
ALTER TABLE public.dining_sessions ADD COLUMN IF NOT EXISTS client_ip_hash TEXT NULL;
ALTER TABLE public.dining_sessions ADD COLUMN IF NOT EXISTS ip_subnet TEXT NULL;
ALTER TABLE public.dining_sessions ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 100 NOT NULL;

-- Deactivate existing sessions to prevent unique index conflicts on tables/devices
UPDATE public.dining_sessions SET is_active = false WHERE is_active = true;

-- 5. Database Performance and Integrity Indexes
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_qr_token ON public.restaurant_tables(qr_token);
CREATE INDEX IF NOT EXISTS idx_dining_sessions_token ON public.dining_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_dining_sessions_trust ON public.dining_sessions(trust_score);
CREATE INDEX IF NOT EXISTS idx_request_nonces_nonce ON public.request_nonces(nonce);
CREATE INDEX IF NOT EXISTS idx_threat_logs_created ON public.security_threat_logs(created_at);

-- Partial unique indexes: Enforce one active session per table, and one active session per device
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_session_per_table ON public.dining_sessions(table_id) WHERE (is_active = true);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_session_per_device ON public.dining_sessions(browser_fingerprint_hash) WHERE (is_active = true);

-- Active QR token uniqueness across tables
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_qr_token ON public.restaurant_tables(qr_token) WHERE (qr_status = 'Active');

-- 6. PostgreSQL Session Revocation RPCs (SECURITY DEFINER)
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

    UPDATE public.dining_sessions
    SET is_active = false;

    RETURN true;
END;
$$;

-- 7. Automated Retention & Security Cleanup Task
CREATE OR REPLACE FUNCTION public.perform_security_cleanup()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_retention_days INTEGER;
BEGIN
    -- Read retention setting
    SELECT threat_log_retention_days INTO v_retention_days FROM public.cafe_settings LIMIT 1;
    IF v_retention_days IS NULL THEN
        v_retention_days := 90;
    END IF;

    -- 1. Clean old threat logs
    DELETE FROM public.security_threat_logs WHERE created_at < (now() - (v_retention_days || ' days')::INTERVAL);

    -- 2. Clean old consumed rate limits (older than 24 hours)
    DELETE FROM public.rate_limits WHERE window_start < (now() - INTERVAL '24 hours');

    -- 3. Clean old consumed/expired nonces (older than 2 hours)
    DELETE FROM public.request_nonces WHERE created_at < (now() - INTERVAL '2 hours');

    -- 4. Clean deactivated dining sessions (older than 3 days)
    DELETE FROM public.dining_sessions WHERE is_active = false AND created_at < (now() - INTERVAL '3 days');
END;
$$;
