-- Fix permission denied for menu_items for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
