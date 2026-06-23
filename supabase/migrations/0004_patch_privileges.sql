-- Grant base table privileges to anon and authenticated roles
GRANT SELECT, INSERT, DELETE ON public.orders TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.order_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_requests TO anon, authenticated;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Public read orders" ON public.orders;
DROP POLICY IF EXISTS "Public insert orders" ON public.orders;
DROP POLICY IF EXISTS "Public read order_items" ON public.order_items;
DROP POLICY IF EXISTS "Public insert order_items" ON public.order_items;

-- Create SELECT policy for public on orders
CREATE POLICY "Public read orders" ON public.orders 
  FOR SELECT TO public USING (true);

-- Create INSERT policy for public on orders
CREATE POLICY "Public insert orders" ON public.orders 
  FOR INSERT TO public WITH CHECK (true);

-- Create SELECT policy for public on order_items
CREATE POLICY "Public read order_items" ON public.order_items 
  FOR SELECT TO public USING (true);

-- Create INSERT policy for public on order_items
CREATE POLICY "Public insert order_items" ON public.order_items 
  FOR INSERT TO public WITH CHECK (true);
