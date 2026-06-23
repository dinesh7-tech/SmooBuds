-- 1. Add notes column to order_items to support kitchen customisations (Less Sugar, Extra Cheese, etc.)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Add idempotency_key to orders to prevent duplicate orders due to double-clicks or page refreshes
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key UUID UNIQUE;

-- 3. Create table_requests table to support future scalability (Waiter Calling, Bill Requests, etc.)
CREATE TABLE IF NOT EXISTS table_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number INTEGER NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('Call Waiter', 'Request Bill', 'Feedback', 'Other')),
    additional_info TEXT,
    status TEXT DEFAULT 'Pending' NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Completed')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on table_requests
ALTER TABLE table_requests ENABLE ROW LEVEL SECURITY;

-- Allow public to insert requests, admin to manage all
CREATE POLICY "Public can create table_requests" 
ON table_requests FOR INSERT 
TO public 
WITH CHECK (true);

CREATE POLICY "Admin full access to table_requests" 
ON table_requests FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Enable Realtime for table_requests so admin dashboard receives waiter calls instantly
ALTER PUBLICATION supabase_realtime ADD TABLE table_requests;
