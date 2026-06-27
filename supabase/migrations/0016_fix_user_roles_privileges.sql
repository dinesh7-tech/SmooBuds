-- ==========================================
-- 0016_fix_user_roles_privileges.sql
-- Grants UPDATE, INSERT, and DELETE privileges to authenticated users on user_roles
-- ==========================================

GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
