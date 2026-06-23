-- 1. Create user_roles table for role-based access control (RBAC)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID PRIMARY KEY, -- Maps to auth.users.id
    role TEXT NOT NULL CHECK (role IN ('Owner', 'Manager', 'Staff')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policies for user_roles
CREATE POLICY "Users can view their own role" 
ON user_roles FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Owners can manage all roles" 
ON user_roles FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'Owner'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'Owner'
    )
);

-- 2. Create audit_logs table to track critical modifications
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- References auth.users(id)
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only Owners and Managers can view audit logs, only system can insert
CREATE POLICY "Admins can view audit logs" 
ON audit_logs FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
);

-- 3. Create cafe_settings table (Single row enforced)
CREATE TABLE IF NOT EXISTS cafe_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    cafe_name TEXT NOT NULL DEFAULT 'SmooBuds Cafe',
    about_section TEXT DEFAULT 'Handcrafted desserts, premium ice creams and signature shakes.',
    address TEXT DEFAULT 'Main Road, Kakinada, Andhra Pradesh, India',
    phone_number TEXT DEFAULT '+91 98765 43210',
    whatsapp_number TEXT DEFAULT '+91 98765 43210',
    email TEXT DEFAULT 'contact@smoobuds.com',
    opening_hours TEXT DEFAULT '11:00 AM - 11:00 PM',
    instagram_link TEXT DEFAULT 'https://instagram.com/smoobuds',
    facebook_link TEXT DEFAULT 'https://facebook.com/smoobuds',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on cafe_settings
ALTER TABLE cafe_settings ENABLE ROW LEVEL SECURITY;

-- Public can read settings, Owners/Managers can edit
CREATE POLICY "Public read cafe_settings" 
ON cafe_settings FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Admins edit cafe_settings" 
ON cafe_settings FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
);

-- Insert default settings row if not exists
INSERT INTO cafe_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 4. Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    banner_url TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on promotions
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Public can view active promotions, Owners/Managers can manage
CREATE POLICY "Public view active promotions" 
ON promotions FOR SELECT 
TO public 
USING (
    is_active = true AND 
    (start_date IS NULL OR start_date <= now()) AND 
    (end_date IS NULL OR end_date >= now())
);

CREATE POLICY "Admins manage promotions" 
ON promotions FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('Owner', 'Manager')
    )
);

-- Enable Realtime on table_requests, orders, and promotions
ALTER PUBLICATION supabase_realtime ADD TABLE promotions;
