-- Drop old promotions table
DROP TABLE IF EXISTS public.promotions CASCADE;

-- Create promotions table
CREATE TABLE public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    image_url TEXT,
    banner_url TEXT,
    cta_text TEXT DEFAULT 'Order Now',
    cta_url TEXT DEFAULT '/menu',
    display_type TEXT[] NOT NULL, -- popup_modal, top_banner, bottom_sticky_banner, floating_card, full_screen, homepage_hero, menu_banner, checkout_banner
    animation_type TEXT DEFAULT 'fade', -- fade, zoom, scale, slide_up, slide_down, bounce, flip, rotate, blur_in, spring
    animation_duration TEXT DEFAULT '0.5s', -- 0.3s, 0.5s, 1s, 1.5s
    start_date DATE,
    end_date DATE,
    start_time TIME,
    end_time TIME,
    timezone TEXT DEFAULT 'UTC',
    targeting JSONB DEFAULT '{}'::jsonb,
    display_rules JSONB DEFAULT '{}'::jsonb,
    offer_type TEXT DEFAULT 'custom',
    status TEXT NOT NULL DEFAULT 'Draft', -- Draft, Scheduled, Active, Paused, Expired, Archived
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create promotion_views table
CREATE TABLE public.promotion_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
    user_id UUID,
    device_fingerprint TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create promotion_clicks table
CREATE TABLE public.promotion_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
    user_id UUID,
    device_fingerprint TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create promotion_analytics table (daily rolled-up analytics)
CREATE TABLE public.promotion_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0 NOT NULL,
    unique_views INTEGER DEFAULT 0 NOT NULL,
    clicks INTEGER DEFAULT 0 NOT NULL,
    orders_count INTEGER DEFAULT 0 NOT NULL,
    revenue NUMERIC DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (promotion_id, date)
);

-- Add applied_promotion_id to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS applied_promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL;

-- Enable Row Level Security (RLS) on new tables
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_analytics ENABLE ROW LEVEL SECURITY;

-- Security helper check_is_admin (Owner or Manager) if not exists
CREATE OR REPLACE FUNCTION check_is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_roles 
        WHERE user_id = p_user_id 
          AND role IN ('Owner', 'Manager')
    );
END;
$$;

-- Security helper check_is_staff_member if not exists
CREATE OR REPLACE FUNCTION check_is_staff_member(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_roles 
        WHERE user_id = p_user_id 
          AND role = 'Staff'
    );
END;
$$;

-- Table Grants (explicit privileges to fix "permission denied" error)
GRANT SELECT ON public.promotions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;

GRANT INSERT ON public.promotion_views TO anon;
GRANT SELECT, INSERT ON public.promotion_views TO authenticated;
GRANT ALL ON public.promotion_views TO service_role;

GRANT INSERT ON public.promotion_clicks TO anon;
GRANT SELECT, INSERT ON public.promotion_clicks TO authenticated;
GRANT ALL ON public.promotion_clicks TO service_role;

GRANT SELECT ON public.promotion_analytics TO authenticated;
GRANT ALL ON public.promotion_analytics TO service_role;

-- RLS Policies for promotions
DROP POLICY IF EXISTS "Public view active promotions" ON public.promotions;
DROP POLICY IF EXISTS "Staff view all promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admin manage promotions" ON public.promotions;

CREATE POLICY "Public view active promotions" ON public.promotions
    FOR SELECT TO public
    USING (
        status = 'Active' 
        AND (start_date IS NULL OR start_date <= CURRENT_DATE) 
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    );

CREATE POLICY "Staff view all promotions" ON public.promotions
    FOR SELECT TO authenticated
    USING (check_is_staff_member(auth.uid()));

CREATE POLICY "Admin manage promotions" ON public.promotions
    FOR ALL TO authenticated
    USING (check_is_admin(auth.uid()))
    WITH CHECK (check_is_admin(auth.uid()));

-- RLS Policies for promotion_views
DROP POLICY IF EXISTS "Public insert promotion_views" ON public.promotion_views;
DROP POLICY IF EXISTS "Admin view promotion_views" ON public.promotion_views;

CREATE POLICY "Public insert promotion_views" ON public.promotion_views
    FOR INSERT TO public
    WITH CHECK (true);

CREATE POLICY "Admin view promotion_views" ON public.promotion_views
    FOR SELECT TO authenticated
    USING (check_is_admin(auth.uid()) OR check_is_staff_member(auth.uid()));

-- RLS Policies for promotion_clicks
DROP POLICY IF EXISTS "Public insert promotion_clicks" ON public.promotion_clicks;
DROP POLICY IF EXISTS "Admin view promotion_clicks" ON public.promotion_clicks;

CREATE POLICY "Public insert promotion_clicks" ON public.promotion_clicks
    FOR INSERT TO public
    WITH CHECK (true);

CREATE POLICY "Admin view promotion_clicks" ON public.promotion_clicks
    FOR SELECT TO authenticated
    USING (check_is_admin(auth.uid()) OR check_is_staff_member(auth.uid()));

-- RLS Policies for promotion_analytics
DROP POLICY IF EXISTS "Admin view promotion_analytics" ON public.promotion_analytics;

CREATE POLICY "Admin view promotion_analytics" ON public.promotion_analytics
    FOR SELECT TO authenticated
    USING (check_is_admin(auth.uid()) OR check_is_staff_member(auth.uid()));

-- Create Storage Bucket "promotion-assets" if storage schema exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'promotion-assets', 
            'promotion-assets', 
            true, 
            5242880, -- 5MB
            ARRAY['image/jpeg', 'image/png', 'image/webp']
        )
        ON CONFLICT (id) DO NOTHING;

        -- Drop existing policies if they exist to avoid conflict
        EXECUTE 'DROP POLICY IF EXISTS "Allow public read access to promotion-assets" ON storage.objects';
        EXECUTE 'DROP POLICY IF EXISTS "Allow admin full access to promotion-assets" ON storage.objects';
        EXECUTE 'DROP POLICY IF EXISTS "Allow Owner/Manager upload to promotion-assets" ON storage.objects';
        EXECUTE 'DROP POLICY IF EXISTS "Allow Owner delete to promotion-assets" ON storage.objects';
        EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated update to promotion-assets" ON storage.objects';

        -- Create policies
        -- 1. Public read
        EXECUTE 'CREATE POLICY "Allow public read access to promotion-assets" ON storage.objects
            FOR SELECT TO public
            USING (bucket_id = ''promotion-assets'')';

        -- 2. Owner/Manager upload
        EXECUTE 'CREATE POLICY "Allow Owner/Manager upload to promotion-assets" ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (bucket_id = ''promotion-assets'' AND check_is_admin(auth.uid()))';

        -- 3. Owner delete
        EXECUTE 'CREATE POLICY "Allow Owner delete to promotion-assets" ON storage.objects
            FOR DELETE TO authenticated
            USING (bucket_id = ''promotion-assets'' AND check_is_owner(auth.uid()))';

        -- 4. Authenticated update
        EXECUTE 'CREATE POLICY "Allow authenticated update to promotion-assets" ON storage.objects
            FOR UPDATE TO authenticated
            USING (bucket_id = ''promotion-assets'')
            WITH CHECK (bucket_id = ''promotion-assets'')';
    END IF;
END $$;

-- Triggers for real-time aggregation in promotion_analytics
-- Trigger 1: View Log
CREATE OR REPLACE FUNCTION log_promotion_view()
RETURNS TRIGGER AS $$
DECLARE
    v_date DATE := NEW.created_at::DATE;
    v_is_unique BOOLEAN;
BEGIN
    -- Check if unique view today
    IF NEW.device_fingerprint IS NOT NULL THEN
        SELECT NOT EXISTS (
            SELECT 1 FROM public.promotion_views 
            WHERE promotion_id = NEW.promotion_id 
              AND created_at::DATE = v_date 
              AND device_fingerprint = NEW.device_fingerprint
              AND id <> NEW.id
        ) INTO v_is_unique;
    ELSE
        v_is_unique := TRUE;
    END IF;

    INSERT INTO public.promotion_analytics (promotion_id, date, views, unique_views)
    VALUES (
        NEW.promotion_id, 
        v_date, 
        1, 
        CASE WHEN v_is_unique THEN 1 ELSE 0 END
    )
    ON CONFLICT (promotion_id, date) DO UPDATE 
    SET views = promotion_analytics.views + 1,
        unique_views = promotion_analytics.unique_views + CASE WHEN v_is_unique THEN 1 ELSE 0 END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_promotion_view
AFTER INSERT ON public.promotion_views
FOR EACH ROW EXECUTE FUNCTION log_promotion_view();

-- Trigger 2: Click Log
CREATE OR REPLACE FUNCTION log_promotion_click()
RETURNS TRIGGER AS $$
DECLARE
    v_date DATE := NEW.created_at::DATE;
BEGIN
    INSERT INTO public.promotion_analytics (promotion_id, date, clicks)
    VALUES (NEW.promotion_id, v_date, 1)
    ON CONFLICT (promotion_id, date) DO UPDATE 
    SET clicks = promotion_analytics.clicks + 1;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_promotion_click
AFTER INSERT ON public.promotion_clicks
FOR EACH ROW EXECUTE FUNCTION log_promotion_click();

-- Trigger 3: Order Log
CREATE OR REPLACE FUNCTION log_promotion_order()
RETURNS TRIGGER AS $$
DECLARE
    v_date DATE := NEW.created_at::DATE;
BEGIN
    -- Handle Insert
    IF TG_OP = 'INSERT' AND NEW.applied_promotion_id IS NOT NULL THEN
        INSERT INTO public.promotion_analytics (promotion_id, date, orders_count, revenue)
        VALUES (NEW.applied_promotion_id, v_date, 1, NEW.total_amount)
        ON CONFLICT (promotion_id, date) DO UPDATE 
        SET orders_count = promotion_analytics.orders_count + 1,
            revenue = promotion_analytics.revenue + NEW.total_amount;
    END IF;

    -- Handle Update
    IF TG_OP = 'UPDATE' THEN
        -- If promotion was added
        IF OLD.applied_promotion_id IS NULL AND NEW.applied_promotion_id IS NOT NULL THEN
            INSERT INTO public.promotion_analytics (promotion_id, date, orders_count, revenue)
            VALUES (NEW.applied_promotion_id, v_date, 1, NEW.total_amount)
            ON CONFLICT (promotion_id, date) DO UPDATE 
            SET orders_count = promotion_analytics.orders_count + 1,
                revenue = promotion_analytics.revenue + NEW.total_amount;
        -- If promotion was removed
        ELSIF OLD.applied_promotion_id IS NOT NULL AND NEW.applied_promotion_id IS NULL THEN
            UPDATE public.promotion_analytics
            SET orders_count = GREATEST(0, orders_count - 1),
                revenue = GREATEST(0, revenue - OLD.total_amount)
            WHERE promotion_id = OLD.applied_promotion_id AND date = OLD.created_at::DATE;
        -- If promotion changed
        ELSIF OLD.applied_promotion_id <> NEW.applied_promotion_id THEN
            -- Decrement old
            UPDATE public.promotion_analytics
            SET orders_count = GREATEST(0, orders_count - 1),
                revenue = GREATEST(0, revenue - OLD.total_amount)
            WHERE promotion_id = OLD.applied_promotion_id AND date = OLD.created_at::DATE;
            -- Increment new
            INSERT INTO public.promotion_analytics (promotion_id, date, orders_count, revenue)
            VALUES (NEW.applied_promotion_id, v_date, 1, NEW.total_amount)
            ON CONFLICT (promotion_id, date) DO UPDATE 
            SET orders_count = promotion_analytics.orders_count + 1,
                revenue = promotion_analytics.revenue + NEW.total_amount;
        -- If amount changed and promotion remained the same
        ELSIF OLD.applied_promotion_id IS NOT NULL AND OLD.total_amount <> NEW.total_amount THEN
            UPDATE public.promotion_analytics
            SET revenue = GREATEST(0, revenue - OLD.total_amount + NEW.total_amount)
            WHERE promotion_id = NEW.applied_promotion_id AND date = NEW.created_at::DATE;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_log_promotion_order
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION log_promotion_order();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.promotions;
