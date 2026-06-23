-- Create SECURITY DEFINER function to check if a user is an Owner to bypass RLS recursion
CREATE OR REPLACE FUNCTION check_is_owner(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM user_roles 
        WHERE user_id = p_user_id 
          AND role = 'Owner'
    );
END;
$$;

-- Drop the old recursive policy
DROP POLICY IF EXISTS "Owners can manage all roles" ON user_roles;

-- Create the new non-recursive policy using the security definer function
CREATE POLICY "Owners can manage all roles" 
ON user_roles FOR ALL 
TO authenticated 
USING (check_is_owner(auth.uid()))
WITH CHECK (check_is_owner(auth.uid()));
