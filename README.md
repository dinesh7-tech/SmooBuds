# SmooBuds Cafe — QR Dine-In Ordering System & Admin Dashboard

An elegant, dine-in ordering solution integrated into the SmooBuds Cafe web application. Built on React 19, Vite, and TanStack Start, this system validates digital table tokens server-side, manages persistent cart customizations, and provides staff with real-time dashboards for order tracking, kitchen prep, table services, and business analytics.

---

## 1. Key Features

### QR Customer Experience
* **Secure Entry**: Scans `/menu?table=1&token=abc123` to establish a cryptographically signed, secure `httpOnly` table session cookie (valid for 3 hours).
* **Automatic Token Hiding**: Instantly strips table tokens from the browser URL upon verification to protect against link sharing and referer leakage.
* **Persistent Cart**: Local storage cart state, isolated by table number, surviving browser refreshes and automatically clearing upon order success.
* **Item Customizations**: Structured item notes (e.g. *Less Sugar*, *Extra Cheese*) and custom instructions saved directly on order tickets.
* **Real-time Order Status**: Instantly updates order status badges (Pending, Accepted, Preparing, Ready, Served) via Supabase Realtime listeners.
* **Service Triggers**: Floor assistance hooks ("Call Waiter", "Request Bill") reporting directly to the admin notifications list.

### Admin Dashboard & Control Room (`/admin`)
* **Role-Based Access Control (RBAC)**: Distinct permissions for `Owner` (Full access), `Manager` (Menu CRUD, Settings, Analytics), and `Staff` (Live Orders and Kitchen Board only).
* **Live Orders Screen**: Real-time ticket management with single-click workflow updates. Includes toggleable beep alerts for incoming orders.
* **Live Kitchen Queue**: Tablet-optimized layout displaying preparing orders with elapsed preparation times.
* **Menu Management**: CRUD interface for menu items, pricing, categories, and stock availability.
* **Tables & QR Generator**: Create tables, preview/download QR codes, and regenerate table tokens.
* **Analytics & CSV Backups**: Visual charts detailing revenue, peak order hours, top-selling items, and data export downloads.

---

## 2. Technical Stack

* **Frontend**: React 19, TypeScript, Framer Motion, Lucide React, Sonner.
* **Framework**: TanStack Start (Vite + Nitro server engine).
* **Styling**: Tailwind CSS v4, custom glassmorphism, brand-harmony palette (Sage + Gold + Cream).
* **Backend**: Supabase (Database, Auth, Storage, Realtime).
* **Validation**: Zod (Input schemas and cookie payload checks).

---

## 3. Directory Layout

```
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql          # Base tables, verify RPC, and storage bucket
│       ├── 0002_order_enhancements.sql # Notes, unique idempotency keys, and table requests
│       └── 0003_admin_features.sql # RBAC roles, settings, promotions, and audit logs
├── seed.sql                       # Sample menu items and table records
├── DEPLOYMENT.md                  # Detailed deployment steps
├── ENVIRONMENT_SETUP.md           # Environment variables configuration
└── src/
    ├── lib/
    │   ├── supabase.ts            # Client initializer
    │   ├── verifyTable.ts         # HMAC-SHA256 signature, cookie setup, Zod & Rate limits
    │   ├── orderActions.ts        # Server actions for placing orders & floor requests
    │   └── adminActions.ts        # Server actions for status, menu CRUD, and table token resets
    └── routes/
        ├── menu.tsx               # QR Entry route (Read-only vs Table-ordering views)
        ├── admin.tsx              # Sidebar layout, real-time alerts, and auth gates
        └── admin/
            ├── login.tsx          # Credentials signup & verification
            ├── index.tsx          # Redirects admin root
            ├── kitchen.tsx        # Kitchen card queue
            ├── menu.tsx           # Product catalog CRUD
            ├── tables.tsx         # Floor registration & QR downloads
            ├── analytics.tsx      # Charts & CSV exports
            ├── settings.tsx       # Profile config editor
            └── orders/
                ├── live.tsx       # Active tickets advancement
                └── index.tsx      # History data table list
```

---

## 4. Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment template and fill placeholders:
   ```bash
   cp .env.example .env
   ```
3. Boot the development server:
   ```bash
   npm run dev
   ```
4. Access the web app locally at `http://localhost:3000`.

---

## 5. Guides

* See [ENVIRONMENT_SETUP.md](file:///c:/Users/Dinesh/OneDrive/Desktop/SmooBuds%20-%20EXPERIMENTT/ENVIRONMENT_SETUP.md) for details on setting up variables.
* See [DEPLOYMENT.md](file:///c:/Users/Dinesh/OneDrive/Desktop/SmooBuds%20-%20EXPERIMENTT/DEPLOYMENT.md) for step-by-step instructions on setting up Supabase and Vercel.