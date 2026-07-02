# Production Testing Checklist

Run through this checklist after deploying the BizLeap Operations Portal to verify everything works correctly.

## 1. Backend Verification
- [ ] `GET /` returns `BizLeap API is running`.
- [ ] Backend successfully connects to Supabase PostgreSQL (no 500 errors).
- [ ] Prisma migration ran successfully (`npm run seed:admin` worked).
- [ ] Setup endpoint `/api/auth/setup` correctly rejects requests without the `x-setup-secret` header.
- [ ] Protected APIs correctly reject unauthorized/unauthenticated users.
- [ ] Removed/inactive users cannot login.

## 2. Frontend Verification
- [ ] Vercel frontend URL opens correctly without errors.
- [ ] Browser tab shows "BizLeap Operations Portal" and favicon loads.
- [ ] Mobile UI responsiveness works perfectly.
- [ ] Refreshing a dashboard route (e.g., `/dashboard`) does not result in a 404 page (Vercel rewrite works).
- [ ] Network requests show `VITE_API_URL` successfully targeting the Render backend.

## 3. SuperAdmin Flow
- [ ] Can login directly with credentials from `SUPER_ADMIN_EMAIL`.
- [ ] Dashboard analytics render correctly.
- [ ] Can create a new Employee successfully.
- [ ] Can assign a new Task to the created employee.
- [ ] Can view the Activity Logs globally.

## 4. Employee Flow
- [ ] Can login with newly created employee credentials.
- [ ] Cannot access Admin routes (e.g., `/employees`).
- [ ] Can see only their assigned tasks.
- [ ] **Can upload a file as proof of work** (Verify the upload progress indicator shows).
- [ ] Can submit a Daily Report with an attachment.
- [ ] Can see own notifications.

## 5. File Uploads & Persistence
- [ ] Check Supabase Storage Dashboard -> `bizleap-proofs` bucket: ensure uploaded files are actually visible.
- [ ] Clicking on a proof link in the frontend successfully opens the image/PDF.
- [ ] **Persistence Check**: Restart the Render backend service manually. Verify that you can still login and tasks/files are still present (verifying data isn't volatile).

## 6. Security
- [ ] Supabase Service Role Key is definitely not exposed to the frontend (check frontend source map).
- [ ] Attempt to delete the last remaining SuperAdmin (should fail).
- [ ] Ensure JWT token correctly invalidates or expires according to logic.
