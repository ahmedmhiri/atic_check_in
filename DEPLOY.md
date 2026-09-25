# Deployment Guide — Supabase + GitHub + Vercel

Everything is code-ready: the app builds cleanly and Git is initialized with a first commit.
You only need to do the account-authenticated steps below.

---

## 1. Create the Supabase database

1. Go to https://supabase.com → sign in → **New project**.
2. Pick a name, a strong **database password** (save it), and a region close to you.
3. Wait ~2 minutes for it to provision.
4. Get the two connection strings: **Project → Connect** (top bar) → **ORMs / Prisma** tab
   (or **Connection string**). You need:
   - **Transaction pooler** (port **6543**, has `pgbouncer=true`) → this is `DATABASE_URL`
   - **Session/Direct** (port **5432**) → this is `DIRECT_URL`
   - Replace `[YOUR-PASSWORD]` in both with the DB password from step 2.

Example shape:
```
DATABASE_URL="postgresql://postgres.abcd:PASS@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.abcd:PASS@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
```

## 2. Link locally + create tables

Paste those two values into your local `.env` (replace the placeholders), then:

```powershell
npm run db:push      # creates all tables in Supabase
npm run db:seed      # creates admin + 4 tracks + 4 time slots + sessions
```

Login credentials come from `.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).
**Change these to something secure before seeding a real event.**

## 3. Push to GitHub

1. Create an empty repo at https://github.com/new (no README/gitignore — repo must be empty).
2. Back in this folder:

```powershell
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

(First push will prompt you to authenticate to GitHub in a browser.)

## 4. Deploy on Vercel

1. Go to https://vercel.com → sign in with GitHub → **Add New… → Project** → import your repo.
2. Framework is auto-detected as **Next.js**. Leave build settings default
   (build command `npm run build` already runs `prisma generate`).
3. Add **Environment Variables** (Settings → Environment Variables), for all environments:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Supabase pooled URL (6543, `pgbouncer=true`) |
   | `DIRECT_URL` | Supabase direct URL (5432) |
   | `NEXTAUTH_SECRET` | a long random string (see below) |
   | `NEXTAUTH_URL` | your final URL, e.g. `https://<project>.vercel.app` |
   | `RESEND_API_KEY` | from https://resend.com (or leave unset until needed) |
   | `EMAIL_FROM` | e.g. `Event Team <certificates@yourdomain.com>` (verified in Resend) |
   | `ELIGIBILITY_THRESHOLD` | `70` |

   Generate a secret:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

4. Click **Deploy**.
5. After the first deploy, set `NEXTAUTH_URL` to the real deployed URL (or your custom domain)
   and **redeploy** so auth callbacks use the correct origin.

## 5. Post-deploy checklist

- Tables already exist (step 2 created them against the same Supabase DB Vercel now uses).
- Visit the site → log in with your seeded admin.
- **Resend**: verify a sending domain (or use `onboarding@resend.dev` for testing) before running Finalize.
- **Scanners need HTTPS + camera permission** — Vercel serves HTTPS, so `html5-qrcode` works on phones.

## Notes / gotchas

- Supabase requires the **pooled** URL at runtime (serverless) and the **direct** URL for
  migrations — both are already wired via `datasource.url` / `directUrl` in `prisma/schema.prisma`.
- If you later change the schema: `npm run db:push` (or set up `prisma migrate`) against Supabase,
  then push to GitHub — Vercel redeploys automatically.
- The `RESEND_API_KEY` is read lazily; the app builds and runs fine without it (only Finalize needs it).
