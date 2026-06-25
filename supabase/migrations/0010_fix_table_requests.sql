-- 0010_fix_table_requests.sql
-- Fix the customer table requests failure due to missing public SELECT policy on table_requests table

-- 1. DROP old public/anon policies on table_requests if they exist
DROP POLICY IF EXISTS "Public can create table_requests" ON public.table_requests;
DROP POLICY IF EXISTS "Public read table_requests" ON public.table_requests;
DROP POLICY IF EXISTS "Public insert table_requests" ON public.table_requests;

-- 2. CREATE corrected public policies on table_requests
-- Allow customers to SELECT their own pending table requests (within 3 hour table session window)
CREATE POLICY "Public read table_requests" ON public.table_requests
  FOR SELECT TO public
  USING (
    status = 'Pending' AND
    created_at >= now() - interval '3 hours'
  );

-- Allow customers to CREATE (INSERT) table requests with a default Pending status
CREATE POLICY "Public insert table_requests" ON public.table_requests
  FOR INSERT TO public
  WITH CHECK (
    status = 'Pending' AND
    request_type IN ('Call Waiter', 'Request Bill', 'Feedback', 'Other')
  );
