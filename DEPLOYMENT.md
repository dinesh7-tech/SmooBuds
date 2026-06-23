# Deployment Guide

Follow this guide to deploy the SmooBuds Cafe QR Ordering System & Admin Dashboard to production using **Supabase** and **Vercel**.

---

## 1. Supabase Project Setup

1. Create a new project at [database.supabase.com](https://database.supabase.com).
2. Note your **API URL** and **Anon Key** from the Project Settings -> API.
3. Open the **SQL Editor** in your Supabase dashboard.

---

## 2. SQL Migration & Seed Execution Order

Execute the SQL scripts in the following exact order inside the SQL Editor:

### Step 1: Core Database Schema
Run the contents of [0001_init.sql](file:///c:/Users/Dinesh/OneDrive/Desktop/SmooBuds%20-%20EXPERIMENTT/supabase/migrations/0001_init.sql). This will:
* Set up tables: `restaurant_tables`, `menu_items`, `orders`, and `order_items`.
* Enable Row-Level Security (RLS) policies.
* Create the `verify_table_token` RPC function.
* Enable Realtime replication.
* Initialize the `menu-images` Storage bucket.

### Step 2: System Enhancements
Run the contents of [0002_order_enhancements.sql](file:///c:/Users/Dinesh/OneDrive/Desktop/SmooBuds%20-%20EXPERIMENTT/supabase/migrations/0002_order_enhancements.sql). This will:
* Add kitchen customization notes to items.
* Apply unique constraints to idempotency keys.
* Create the `table_requests` register.

### Step 3: Admin & RBAC Schemas
Run the contents of [0003_admin_features.sql](file:///c:/Users/Dinesh/OneDrive/Desktop/SmooBuds%20-%20EXPERIMENTT/supabase/migrations/0003_admin_features.sql). This will:
* Set up roles (`user_roles`) and audit logging (`audit_logs`).
* Initialize cafe profiles (`cafe_settings`) and active promotions (`promotions`).

### Step 4: Seed Data
Run the contents of [seed.sql](file:///c:/Users/Dinesh/OneDrive/Desktop/SmooBuds%20-%20EXPERIMENTT/seed.sql). This will:
* Populate default active tables 1 through 5.
* Seed the premium cafe menu items across all 6 categories.

---

## 3. Storage Bucket Setup

1. Navigate to **Storage** in the Supabase Sidebar.
2. Confirm the bucket `menu-images` has been created.
3. Verify that the bucket is configured as **Public** (allowing anonymous read access to URLs).
4. Verify RLS policies are set:
   * Public Select allowed.
   * Authenticated full access allowed (for admin panel uploads).

---

## 4. Authentication Configuration

1. Navigate to **Authentication** -> **Providers** in Supabase.
2. Ensure **Email / Password** authentication is enabled.
3. Toggle "Confirm Email" **OFF** if you want to allow instant staff sign-up without verification email cycles during local testing, or keep it **ON** for production.

---

## 5. Vercel Environment Variables

Deploy the project to Vercel by importing the repository:
1. Link your branch to Vercel.
2. Configure the following environment variables in Vercel project settings:
   * `VITE_SUPABASE_URL` = `<your-supabase-url>`
   * `VITE_SUPABASE_PUBLISHABLE_KEY` = `<your-supabase-anon-key>`
   * `SESSION_SECRET` = `<your-32-character-hmac-secret>`
3. Click **Deploy**.

---

## 6. First Owner Account Setup

1. Once deployed, navigate to the `/admin/login` page of your deployed URL.
2. Click **Create Account**.
3. Input the administrator's email and password.
4. Click **Create Crew Account**.
5. The first registered account is automatically promoted to the **Owner** role. Any subsequent staff registrations will default to the **Staff** role (which the Owner can elevate in the database).

---

## 7. QR Code Generation & Downloading

1. Log in to the Admin Dashboard and go to the **Tables & QR** screen.
2. Click **QR Code** on Table 1.
3. A modal will display a live preview of the QR code pointing to the secure verification URL.
4. Click **Download PNG** to save the QR code image. Print and place this QR code on Table 1.
5. *(Optional)* Click the **Regenerate (Refresh)** icon next to Table 1 to invalidate the current token and print a new QR code. Old codes will immediately fail to order.
