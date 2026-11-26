# BizLeap Operations Portal - Deployment Guide

This guide covers the step-by-step instructions for deploying the BizLeap Operations Portal to production using **Render** for the Backend, **Vercel** for the Frontend, and **Supabase** for the Database and File Storage.

---

## Step 1: Supabase Setup (Database & Storage)

1. Go to [Supabase](https://supabase.com) and create a new project.
2. Go to **Project Settings -> Database** and copy the following connection strings:
   - **Transaction string**: (used for `DATABASE_URL`)
   - **Session string**: (used for `DIRECT_URL` - port 5432)
3. Go to **Storage** and create a new bucket named exactly: `bizleap-proofs`.
   - Ensure the bucket is set to **Private**.
   - Do not use public URLs for submissions or client-visible files.
4. Go to **Project Settings -> API** and copy:
   - Project URL (`SUPABASE_URL`)
   - `service_role` secret key (`SUPABASE_SERVICE_ROLE_KEY`)

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
   - `DATABASE_URL` = Your Supabase Transaction String
   - `DIRECT_URL` = Your Supabase Session String
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
5. Click **Deploy**.
6. Once deployed, copy your live Vercel URL (e.g., `https://biztask.vercel.app`).

---

## Step 6: Finalize CORS Configuration

1. Go back to your **Render Web Service** dashboard.
2. Edit your Environment Variables.
3. Update `FRONTEND_URL` to your exact Vercel URL (e.g., `https://biztask.vercel.app` - no trailing slash).
4. Save and trigger a manual redeploy on Render so it picks up the new CORS origin.

---

## 🎉 You're Done!

You can now visit your live Vercel frontend URL, login using the `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` you provided, and start using the BizLeap Operations Portal in full production mode!
