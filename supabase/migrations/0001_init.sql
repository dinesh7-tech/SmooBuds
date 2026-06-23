-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create restaurant_tables table
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number INTEGER UNIQUE NOT NULL,
    token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL CHECK (price >= 0),
    category TEXT NOT NULL CHECK (category IN ('Coffee', 'Mocktails', 'Shakes', 'Starters', 'Main Course', 'Desserts')),
    image_url TEXT,
    is_available BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number INTEGER NOT NULL,
    total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),
    status TEXT DEFAULT 'Pending' NOT NULL CHECK (status IN ('Pending', 'Accepted', 'Preparing', 'Ready', 'Served', 'Cancelled')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    item_price NUMERIC NOT NULL CHECK (item_price >= 0)
);

-- Enable RLS on all tables
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- restaurant_tables: Admin-only access (No select for public to prevent token leakage)
CREATE POLICY "Admin full access to restaurant_tables" 
ON restaurant_tables FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- menu_items: Public read-only for available items, admin full access
CREATE POLICY "Public read available menu_items" 
ON menu_items FOR SELECT 
TO public 
USING (is_available = true);

CREATE POLICY "Admin full access to menu_items" 
ON menu_items FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- orders: Public can select to see their live status, insert is handled by server-side Route Handler
CREATE POLICY "Public read orders" 
ON orders FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Admin full access to orders" 
ON orders FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- order_items: Public read items, admin full access
CREATE POLICY "Public read order_items" 
ON order_items FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Admin full access to order_items" 
ON order_items FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 6. RPC function to verify table token (SECURITY DEFINER allows bypassing RLS for verification)
CREATE OR REPLACE FUNCTION verify_table_token(p_table_number INTEGER, p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM restaurant_tables 
        WHERE table_number = p_table_number 
          AND token = p_token 
          AND is_active = true
    );
END;
$$;

-- 7. Enable Realtime on orders and order_items
-- Check if supabase_realtime publication exists, otherwise create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- 8. Create Storage Bucket (menu-images) if storage schema exists
-- We do this inside a block in case it is run on a setup without storage extension yet
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('menu-images', 'menu-images', true)
        ON CONFLICT (id) DO NOTHING;

        -- Bucket policies
        CREATE POLICY "Allow public read access to menu-images"
        ON storage.objects FOR SELECT TO public
        USING (bucket_id = 'menu-images');

        CREATE POLICY "Allow admin full access to menu-images"
        ON storage.objects FOR ALL TO authenticated
        USING (bucket_id = 'menu-images')
        WITH CHECK (bucket_id = 'menu-images');
    END IF;
END $$;
