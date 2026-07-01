-- Drop overloaded RPCs from V2.4 to avoid ambiguity
DROP FUNCTION IF EXISTS public.submit_customer_order(UUID, TEXT, UUID, UUID, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.submit_table_request(UUID, TEXT, TEXT, TEXT, TEXT);

-- Drop deprecated columns from restaurant_tables
ALTER TABLE public.restaurant_tables DROP COLUMN IF EXISTS qr_token;
ALTER TABLE public.restaurant_tables DROP COLUMN IF EXISTS previous_qr_token;
ALTER TABLE public.restaurant_tables DROP COLUMN IF EXISTS qr_version;
ALTER TABLE public.restaurant_tables DROP COLUMN IF EXISTS qr_last_rotated_at;

-- Drop deprecated columns from orders
ALTER TABLE public.orders DROP COLUMN IF EXISTS session_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS table_session_id;

-- Drop deprecated columns from table_requests
ALTER TABLE public.table_requests DROP COLUMN IF EXISTS session_id;
ALTER TABLE public.table_requests DROP COLUMN IF EXISTS table_session_id;

-- Drop deprecated tables (cascades automatically remove their policies and triggers)
DROP TABLE IF EXISTS public.customer_identity CASCADE;
DROP TABLE IF EXISTS public.dining_sessions CASCADE;
DROP TABLE IF EXISTS public.table_sessions CASCADE;

-- Ensure RLS on restaurant_tables blocks public access to token reading
DROP POLICY IF EXISTS "Public read access for restaurant_tables" ON public.restaurant_tables;
