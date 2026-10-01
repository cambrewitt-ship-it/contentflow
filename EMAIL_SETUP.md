# Email Setup (Resend + Supabase)

All email goes out through **Resend** from your verified domain, using the
branded templates in `src/lib/emails/`.

## What gets sent

| Email | Trigger | Where |
|---|---|---|
| Confirm email | Signup | Supabase Send Email Hook → `/api/webhooks/auth-email` |
| Reset password | "Forgot password" | Send Email Hook |
| Magic link / invite / email change / reauth code | Supabase auth actions | Send Email Hook |
| Password changed, email changed, MFA etc. (security alerts) | Supabase security notifications (opt-in, step 4) | Send Email Hook |
| Welcome | First confirmed sign-in (or first checkout if confirmation is off) | `auth/callback`, Stripe webhook |
| Trial started / subscription active | `checkout.session.completed` | Stripe webhook |
| Trial ending soon | `customer.subscription.trial_will_end` (3 days before) | Stripe webhook |
| Payment failed | `invoice.payment_failed` | Stripe webhook |
| Subscription ended | `customer.subscription.deleted` | Stripe webhook |
| Account deleted | User deletes their account | `/api/user/delete-account` |
| Contact form → your inbox | `/contact` form | `/api/contact` |
| Approval requests, Content Agent updates | (existing) | `src/lib/email.ts` |

Lifecycle/billing emails are de-duplicated via the `email_log` table, so
Stripe webhook retries never double-send.

## Setup checklist

### 1. Resend — check your domain
1. Go to **resend.com → Domains**. Your domain (e.g. `content-manager.io`)
   should show **Verified**. If any record shows failed, re-add the DNS records
   Resend lists (SPF `TXT`, DKIM `TXT`, MX for the `send` subdomain).
2. Recommended: add a DMARC record if you don't have one:
   `TXT  _dmarc  v=DMARC1; p=none; rua=mailto:you@content-manager.io`
3. **API Keys → Create API key** with *Sending access* restricted to your domain.

### 2. Environment variables (Vercel → Settings → Environment Variables)

| Variable | Example | Notes |
|---|---|---|
| `RESEND_API_KEY` | `re_...` | From step 1 |
| `RESEND_FROM_EMAIL` | `Content Manager <hello@content-manager.io>` | Must be on the verified domain |
| `RESEND_REPLY_TO` | `support@content-manager.io` | Optional; where customer replies go |
| `SUPPORT_EMAIL` | `support@content-manager.io` | Receives contact form messages |
| `SEND_EMAIL_HOOK_SECRET` | `v1,whsec_...` | From step 4 |
| `NEXT_PUBLIC_APP_URL` | `https://content-manager.io` | Used for links + logo in emails |

Redeploy after adding them.

### 3. Run the SQL
In **Supabase → SQL Editor**, run `migrations/030-email-log.sql`.
(Emails still send without it, just without duplicate protection.)

### 4. Supabase — route auth emails through the app
1. **Authentication → Hooks → Add hook → Send Email hook**
   - Type: **HTTPS**
   - URL: `https://content-manager.io/api/webhooks/auth-email`
   - Click **Generate secret**, copy it into `SEND_EMAIL_HOOK_SECRET` (step 2), save, enable.
   - Deploy the env var *before* enabling the hook — while the hook is on and the
     secret is missing, signup/reset emails fail.
2. **Authentication → URL Configuration**
   - Site URL: `https://content-manager.io`
   - Redirect URLs: include `https://content-manager.io/**` (and `https://www.content-manager.io/**`
     if you serve www).
3. *(Optional, recommended)* **Authentication → Emails → Security notifications**:
   enable "Password changed" and "Email address changed". They go out via the hook
   with our templates.
4. *(Optional fallback)* **Authentication → Emails → SMTP Settings**: enable custom
   SMTP with host `smtp.resend.com`, port `465`, user `resend`, password = your
   Resend API key, sender = your from address. Supabase only uses this if the
   hook is turned off, but it also lifts Supabase's built-in 2-emails/hour limit
   in that case.

With the hook enabled, the templates under Authentication → Emails → Templates
(and `email-templates/password-reset-email.html`) are no longer used.

### 5. Stripe — make sure the webhook gets these events
**Developers → Webhooks → your endpoint → Events**, include:
`checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`customer.subscription.trial_will_end`, `invoice.paid`, `invoice.payment_failed`.

Payment receipts: turn on **Settings → Customer emails → Successful payments** in
Stripe — Stripe's receipts are better than anything we'd build.

### 6. Test
1. Sign up with a fresh address → confirm email arrives from your domain → click it → welcome email.
2. Log out → Forgot password → reset email → link lands on `/auth/reset-password`.
3. Stripe CLI: `stripe trigger customer.subscription.trial_will_end` / `invoice.payment_failed`.
4. Check **Resend → Emails** for delivery status, and `select * from email_log order by created_at desc;`.

## Editing emails
- Copy lives in `src/lib/emails/templates.ts`.
- Shared look (logo, button, footer) is in `src/lib/emails/layout.ts`.
- Add a new email: write a template function, then a sender in `src/lib/emails/index.ts`
  (use `sendEmailOnce` with a stable `dedupeKey` if the trigger can repeat).
