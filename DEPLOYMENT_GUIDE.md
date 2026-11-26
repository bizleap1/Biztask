# BizLeap Operations Portal - Deployment Guide

This guide covers deploying the BizLeap Operations Portal with **Render** for the backend, **Vercel** for the frontend, **Neon** for Postgres and Realtime, and **Supabase Storage** for uploaded files.

---

## Step 1: Neon Postgres and Supabase Storage

1. Authenticate the Neon CLI with `neon login`, then link this repository to the intended Neon project and production branch. This repository's `neon.ts` declares Realtime; run `neon deploy` to apply the configuration and pull the branch environment variables.
2. Use Neon's pooled connection string for `DATABASE_URL` (application traffic) and its direct connection string for `DIRECT_URL` (Prisma migrations).
3. Keep `NEON_REALTIME_SECRET` on the backend only. `NEON_REALTIME_URL` is the public WebSocket URL used by the frontend to subscribe to authorized live task queries.
4. In Supabase **Storage**, create a bucket named exactly `bizleap-proofs`.
   - Ensure the bucket is set to **Private**.
   - Do not use public URLs for submissions or client-visible files.
5. In Supabase **Project Settings -> API**, copy:
   - Project URL (`SUPABASE_URL`)
   - `service_role` secret key (`SUPABASE_SERVICE_ROLE_KEY`)

Do not commit `.env`, `.env.local`, or provider credentials to source control.

---

## Step 2: Push Code to GitHub

Ensure all your latest code is pushed to your GitHub repository:
```bash
git add .
git commit -m "Production deployment setup"
git push origin main
```

---

## Step 3: Backend Deployment (Render)

1. Go to [Render](https://render.com) and create a new **Web Service**.
2. Connect your GitHub repository.
3. Configure the service:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npx prisma migrate deploy`
   - **Start Command**: `npm start`
4. Expand **Environment Variables** and add the exact keys from your `backend/.env.example`:
   - `DATABASE_URL` = Neon pooled Postgres connection string
   - `DIRECT_URL` = Neon direct Postgres connection string
   - `NEON_REALTIME_URL` = Neon Realtime WebSocket URL
   - `NEON_REALTIME_SECRET` = Neon Realtime secret (backend only)
   - `JWT_SECRET` = A long, random secure string
   - `SUPABASE_URL` = Your Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = Your Supabase Service Role Key
   - `SUPABASE_STORAGE_BUCKET` = `bizleap-proofs`
   - `SUPER_ADMIN_NAME` = "Your Admin Name"
   - `SUPER_ADMIN_EMAIL` = "admin@yourcompany.com"
   - `SUPER_ADMIN_PASSWORD` = "A_Secure_Password!"
   - `SETUP_SECRET` = "A_Secure_Setup_Key"
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = Keep this blank for now, you will update it in Step 5.
5. Click **Create Web Service** and wait for the deployment to finish.
6. **IMPORTANT**: Copy the live Render URL (e.g., `https://bizleap-backend.onrender.com`).

---

## Step 4: Seed SuperAdmin Account

Once the Render backend is live, you need to create the initial SuperAdmin account.
Go to the Render dashboard for your Web Service, click on the **Shell** tab, and run:
```bash
npm run seed:admin
```
You should see: `SuperAdmin created successfully.`

---

## Step 5: Frontend Deployment (Vercel)

1. Go to [Vercel](https://vercel.com) and click **Add New -> Project**.
2. Import your GitHub repository.
3. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
4. Expand **Environment Variables** and add:
   - `VITE_API_URL` = `https://your-render-backend-url.onrender.com/api` (The URL you copied in Step 3, with `/api` at the end).
   - `NEON_REALTIME_URL` = The public Neon Realtime WebSocket URL. The Vite config exposes only this URL to the browser; never add `NEON_REALTIME_SECRET` to Vercel.
5. In the Neon Console, add the exact Vercel site origin to the production branch's Realtime allowed origins. The current configuration allows local development origins only.
6. Click **Deploy**.
7. Once deployed, copy your live Vercel URL (e.g., `https://biztask.vercel.app`).

---

## Step 6: Finalize CORS Configuration

1. Go back to your **Render Web Service** dashboard.
2. Edit your Environment Variables.
3. Update `FRONTEND_URL` to your exact Vercel URL (e.g., `https://biztask.vercel.app` - no trailing slash).
4. Save and trigger a manual redeploy on Render so it picks up the new CORS origin.

---

## 🎉 You're Done!

You can now visit your live Vercel frontend URL, login using the `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` you provided, and start using the BizLeap Operations Portal in full production mode!
