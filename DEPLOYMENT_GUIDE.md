# Deployment Guide

Follow these steps to deploy the BizLeap Operations Portal to production using Render (Backend) and Vercel (Frontend).

## 1. Database Setup
1. Create a PostgreSQL database on Neon, Supabase, or AWS RDS.
2. Obtain the database connection string.

## 2. Backend Deployment (Render)
1. Push your repository to GitHub.
2. Log into Render and create a new **Web Service**.
3. Connect your GitHub repository.
4. Set the following build and start commands:
   - **Build Command**: `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
   - **Start Command**: `npm start`
5. Add the following Environment Variables in Render:
   - `DATABASE_URL`: Your PostgreSQL connection string.
   - `JWT_SECRET`: A strong, random string (e.g., generated via `openssl rand -base64 32`).
   - `FRONTEND_URL`: The URL where your frontend will be deployed (e.g., `https://bizleap-portal.vercel.app`).
   - `PORT`: `5000`
6. Deploy the service.

## 3. Frontend Deployment (Vercel)
1. Log into Vercel and **Add New Project**.
2. Connect your GitHub repository.
3. Select the `frontend` directory as the Root Directory.
4. Vercel will automatically detect Vite. Set the Environment Variable:
   - `VITE_API_URL`: The URL of your deployed Render backend (e.g., `https://bizleap-backend.onrender.com/api`).
5. Deploy the project.

## 4. Initial Setup
1. Once both services are live, the app will have no users.
2. Send a POST request (using Postman or curl) to `https://<YOUR_RENDER_URL>/api/auth/setup` with:
   ```json
   {
     "name": "Super Admin",
     "email": "admin@yourcompany.com",
     "password": "SecurePassword123!"
   }
   ```
3. Login using these credentials on your Vercel frontend. The `/api/auth/setup` route will automatically lock out further requests now that a SuperAdmin exists.
