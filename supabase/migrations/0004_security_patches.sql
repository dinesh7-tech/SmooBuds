-- 0004_security_patches.sql
-- Drop insecure "USING (true)" policies for authenticated users
DROP POLICY IF EXISTS "Admin full access to restaurant_tables" ON restaurant_tables;
DROP POLICY IF EXISTS "Admin full access to menu_items" ON menu_items;
DROP POLICY IF EXISTS "Admin full access to orders" ON orders;
DROP POLICY IF EXISTS "Admin full access to order_items" ON order_items;
DROP POLICY IF EXISTS "Admin full access to table_requests" ON table_requests;
DROP POLICY IF EXISTS "Public read orders" ON orders;

-- restaurant_tables: Only Owners can manage tables
CREATE POLICY "Owner access to restaurant_tables"
ON restaurant_tables FOR ALL
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

-- menu_items: Owners and Managers can manage
CREATE POLICY "Admin manage menu_items"
ON menu_items FOR ALL
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

-- orders & order_items: Owners, Managers, and Staff can manage
CREATE POLICY "Admin manage orders"
ON orders FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('Owner', 'Manager', 'Staff')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('Owner', 'Manager', 'Staff')
    )
);

CREATE POLICY "Admin manage order_items"
ON order_items FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('Owner', 'Manager', 'Staff')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('Owner', 'Manager', 'Staff')
    )
);

-- table_requests: Owners, Managers, and Staff can manage
CREATE POLICY "Admin manage table_requests"
ON table_requests FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('Owner', 'Manager', 'Staff')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('Owner', 'Manager', 'Staff')
    )
);

-- audit_logs: Fix missing INSERT policy for system logging
-- System server actions will use authenticated client to insert logs
CREATE POLICY "Admin insert audit_logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('Owner', 'Manager', 'Staff')
    )
);
