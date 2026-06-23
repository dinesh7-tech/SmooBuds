-- Add new columns to cafe_settings table
ALTER TABLE cafe_settings ADD COLUMN IF NOT EXISTS closing_hours TEXT DEFAULT '11:00 PM';
ALTER TABLE cafe_settings ADD COLUMN IF NOT EXISTS ordering_enabled BOOLEAN DEFAULT true;
ALTER TABLE cafe_settings ADD COLUMN IF NOT EXISTS accept_new_orders BOOLEAN DEFAULT true;
ALTER TABLE cafe_settings ADD COLUMN IF NOT EXISTS auto_refresh_interval INTEGER DEFAULT 30;
ALTER TABLE cafe_settings ADD COLUMN IF NOT EXISTS qr_table_count INTEGER DEFAULT 10;
ALTER TABLE cafe_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE cafe_settings ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#4A5D23';

-- Ensure bucket exists for cafe assets if we use 'cafe-assets'. Let's reuse 'menu-images' or create 'cafe-assets'.
-- We will create 'cafe-assets' just in case.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('cafe-assets', 'cafe-assets', true)
        ON CONFLICT (id) DO NOTHING;

        -- Bucket policies
        CREATE POLICY "Allow public read access to cafe-assets"
        ON storage.objects FOR SELECT TO public
        USING (bucket_id = 'cafe-assets');

        CREATE POLICY "Allow admin insert access to cafe-assets"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'cafe-assets');

        CREATE POLICY "Allow admin update access to cafe-assets"
        ON storage.objects FOR UPDATE TO authenticated
        USING (bucket_id = 'cafe-assets');

        CREATE POLICY "Allow admin delete access to cafe-assets"
        ON storage.objects FOR DELETE TO authenticated
        USING (bucket_id = 'cafe-assets');
    END IF;
END $$;
