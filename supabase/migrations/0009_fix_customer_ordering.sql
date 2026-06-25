-- 0009_fix_customer_ordering.sql
-- Fix the customer order placement failure due to missing public SELECT policy on orders table
-- and secure public order_items access to only referenceable orders.

-- 1. DROP old public/anon policies on orders if they exist
DROP POLICY IF EXISTS "Public read orders" ON public.orders;
DROP POLICY IF EXISTS "Public insert orders" ON public.orders;

-- 2. CREATE corrected public policies on orders
-- Allow customers to SELECT recent orders from their table (within 3 hour table session)
CREATE POLICY "Public read orders" ON public.orders
  FOR SELECT TO public
  USING (created_at >= now() - interval '3 hours');

-- Allow customers to CREATE (INSERT) orders with a default Pending status
CREATE POLICY "Public insert orders" ON public.orders
  FOR INSERT TO public
  WITH CHECK (status = 'Pending');


-- 3. DROP old public/anon policies on order_items if they exist
DROP POLICY IF EXISTS "Public read order_items" ON public.order_items;
DROP POLICY IF EXISTS "Public insert order_items" ON public.order_items;

-- 4. CREATE corrected public policies on order_items
-- Allow customers to SELECT order_items only for orders they have access to read
CREATE POLICY "Public read order_items" ON public.order_items
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
    )
  );

-- Allow customers to CREATE (INSERT) order_items only for active/Pending orders
CREATE POLICY "Public insert order_items" ON public.order_items
  FOR INSERT TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id AND orders.status = 'Pending'
    )
  );
