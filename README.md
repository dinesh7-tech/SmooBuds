# SmooBuds Cafe: QR Dine-In Ordering System & Admin Dashboard

> **Off Campus code: HM27U3**

A real-time, dine-in ordering platform for SmooBuds Cafe. Customers scan a table QR code, order from their phone and track the order live. Staff manage everything from an admin control room with live orders, a kitchen queue, menu management and analytics.

Built solo by [Dinesh Akula](https://github.com/dinesh7-tech) with React 19, Vite, TanStack Start and Supabase.

---

## Key Features

### Customer Experience (QR)
- **Secure entry:** scanning `/menu?table=1&token=abc123` creates a signed, `httpOnly` table session cookie (valid for 3 hours).
- **Token hiding:** the table token is stripped from the URL after verification, which prevents link sharing and referer leakage.
- **Persistent cart:** stored locally per table, survives refreshes and clears after a successful order.
- **Item customizations:** structured notes (for example *Less Sugar*, *Extra Cheese*) and custom instructions on the order ticket.
- **Live order status:** Pending, Accepted, Preparing, Ready and Served update instantly through Supabase Realtime.
- **Service requests:** "Call Waiter" and "Request Bill" go straight to the admin notifications.

### Admin Dashboard (`/admin`)
- **Role-based access control:** `Owner` (full access), `Manager` (menu, settings, analytics) and `Staff` (live orders and kitchen board only).
- **Live orders:** real-time tickets with one-click status updates and optional beep alerts.
- **Kitchen queue:** tablet-friendly view of orders being prepared, with elapsed prep time.
- **Menu management:** CRUD for items, pricing, categories and stock availability.
- **Tables and QR generator:** create tables, preview and download QR codes, regenerate table tokens.
- **Analytics and CSV export:** revenue, peak hours and top-selling items, plus data downloads.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Framer Motion, Lucide React, Sonner |
| Framework | TanStack Start (Vite + Nitro server engine) |
| Styling | Tailwind CSS v4, glassmorphism, Sage + Gold + Cream palette |
| Backend | Supabase (Database, Auth, Storage, Realtime) |
| Validation | Zod (input schemas and cookie payload checks) |

---

## Project Structure

```
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql                # Base tables, verify RPC, storage bucket
│       ├── 0002_order_enhancements.sql  # Notes, idempotency keys, table requests
│       └── 0003_admin_features.sql      # RBAC roles, settings, promotions, audit logs
├── seed.sql                             # Sample menu items and tables
├── DEPLOYMENT.md                        # Deployment steps
├── ENVIRONMENT_SETUP.md                 # Environment variables
└── src/
    ├── lib/
    │   ├── supabase.ts                  # Client initializer
    │   ├── verifyTable.ts               # HMAC-SHA256 signature, cookie setup, Zod, rate limits
    │   ├── orderActions.ts              # Place orders and floor requests
    │   └── adminActions.ts              # Status updates, menu CRUD, token resets
    └── routes/
        ├── menu.tsx                     # QR entry (read-only vs table-ordering views)
        ├── admin.tsx                    # Sidebar layout, real-time alerts, auth gates
        └── admin/
            ├── login.tsx
            ├── index.tsx
            ├── kitchen.tsx
            ├── menu.tsx
            ├── tables.tsx
            ├── analytics.tsx
            ├── settings.tsx
            └── orders/
                ├── live.tsx
                └── index.tsx
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy the environment template and fill in your values
cp .env.example .env

# 3. Start the dev server
npm run dev
```

Open `http://localhost:3000`.

---

## Guides

- [Environment setup](./ENVIRONMENT_SETUP.md)
- [Deployment (Supabase + Vercel)](./DEPLOYMENT.md)

---

## Author

**Dinesh Akula**: [GitHub](https://github.com/dinesh7-tech) · [LinkedIn](https://www.linkedin.com/in/akuladinesh/) · [Portfolio](https://dineshdigital.vercel.app/)
