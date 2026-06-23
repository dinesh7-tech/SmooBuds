# Environment Setup Guide

This document details the configuration of environment variables required to run the SmooBuds Cafe system in both local development and production environments.

---

## 1. Environment Variable Reference

Create a file named `.env` at the root of the project by copying the template from `.env.example`:

| Variable Name | Description | Visibility | Required For |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xyz.supabase.co`). | Public (Client & Server) | All Database & Auth Queries |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase Anonymous API key. | Public (Client & Server) | All Database & Auth Queries |
| `SESSION_SECRET` | A secure random string (at least 32 characters) used to sign and verify table sessions. | Private (Server Only) | Table Token Verification & Session Cookie Signatures |

---

## 2. Generating the SESSION_SECRET

The `SESSION_SECRET` is used for **HMAC-SHA256** signatures to protect table session cookies from client-side tampering. It must be kept private and never exposed to the client.

You can generate a secure 32-character string using Node.js in your terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated hex string and assign it to `SESSION_SECRET` in your `.env` file.

---

## 3. Local Verification

1. Start your local development server:
   ```bash
   npm run dev
   ```
2. If environment variables are missing, a warning will be logged to the console:
   `Warning: Supabase environment variables are missing. App may fail during operations requiring database access.`
3. Ensure that your variables are correctly loaded in the console output. When variables are present, the warnings will disappear.
