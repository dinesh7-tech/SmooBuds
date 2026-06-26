-- Fix permission denied error for fetching roles by granting privileges
GRANT SELECT ON public.user_roles TO anon;
GRANT SELECT ON public.user_roles TO authenticated;

-- Ensure consistency of legacy role data to match the CHECK constraint in case it was bypassed
UPDATE public.user_roles SET role = 'Staff' WHERE lower(role) IN ('staff', 'employee');
UPDATE public.user_roles SET role = 'Owner' WHERE lower(role) = 'owner';
UPDATE public.user_roles SET role = 'Manager' WHERE lower(role) = 'manager';
