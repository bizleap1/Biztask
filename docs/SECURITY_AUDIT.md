# BizTask Security Audit & Gap Analysis

> **Audit Date:** 2026-11-25  
> **Risk Rating:** **CRITICAL — NOT PRODUCTION READY**

---

## 1. Executive Summary

The existing BizTask codebase contains **critical authentication, authorization, data-integrity, and secret-management vulnerabilities** that must be remediated before adding new features or exposing the platform to clients. In addition, **all 31-feature client isolation controls (F26–F31) are absent**.

---

## 2. Critical & High Severity Vulnerabilities

| ID | Severity | Category | Location | Finding & Impact | Remediation |
|----|----------|----------|----------|------------------|-------------|
| **SEC-01** | **CRITICAL** | Broken Authentication | `backend/controllers/authController.ts` (`executePasswordReset`, `requestPasswordReset`) | `POST /api/auth/execute-reset` is **unauthenticated** and requires **no reset token/OTP**. Once a SuperAdmin sets `canResetPassword = true`, any attacker knowing the user's email can overwrite their password and take over the account. Worse, `requestPasswordReset` leaks `{ alreadyGranted: true }`. | Replace with cryptographically random, single-use, time-limited (15–30 min) reset tokens stored hashed in DB and delivered out-of-band (email), or require admin-generated one-time temporary passwords with `mustChangePassword: true`. |
| **SEC-02** | **CRITICAL** | Mass Data Destruction | `taskController.ts`, `submissionController.ts`, `dailyReportController.ts`, `activityLogController.ts` (`bulkDelete*`) | In all 4 `bulkDelete*` handlers, if `req.body.ids` is omitted or empty `[]`, `whereClause.id` is never set. For `SuperAdmin`/`Manager`, `whereClause` is `{}` and **soft-deletes every record in the table**. | Validate `ids` with Zod/Joi as a non-empty array of positive integers (`min(1)`), returning `400 Bad Request` otherwise. |
| **SEC-03** | **CRITICAL** | Workflow / Privilege Bypass | `backend/controllers/taskController.ts` (`updateTask`) | `PUT /api/tasks/:id` allows `DevEmployee`/`MediaEmployee` (if `assignedById === req.user.id`) to pass `status: 'Approved'` directly in `req.body`, bypassing submission & manager review. | Restrict `status` updates in `updateTask` to `SuperAdmin`/`Manager` (or remove `status` from `updateTask` entirely and enforce state machine transitions in `updateTaskStatus`). |
| **SEC-04** | **CRITICAL** | Audit Trail Tampering | `backend/controllers/activityLogController.ts` (`deleteActivityLog`, `bulkDeleteActivityLogs`) | Employees and Managers can soft-delete `ActivityLog` records (including `LOGIN`, `PASSWORD_CHANGED`, and `SuperAdmin` logs). `Viewer` sees Delete buttons in `ActivityLogs.tsx`. Violates SRS F09 & NFR-03. | Remove all delete endpoints and UI buttons for `ActivityLog`. Audit logs must be **append-only / immutable**. |
| **SEC-05** | **CRITICAL** | Insecure File Storage | `backend/utils/supabaseStorage.ts`, `DEPLOYMENT_GUIDE.md` | Bucket `bizleap-proofs` is configured as **Public** and `getPublicUrl` is returned. Anyone with or guessing a URL (`{timestamp}-{filename}`) can download sensitive task proofs and daily report attachments without authentication. | Switch Supabase bucket (or Cloudinary) to **Private** and serve files via short-lived signed URLs after server-side resource authorization checks. |
| **SEC-06** | **HIGH** | Hardcoded JWT Fallback Secret | `backend/controllers/authController.ts:11`, `backend/middleware/authMiddleware.ts:15` | `process.env.JWT_SECRET || 'fallback_secret'` allows an attacker to forge valid JWTs for any user ID (including SuperAdmin) if `JWT_SECRET` is unset. | Fail fast on server startup if `JWT_SECRET` is missing or `< 32` characters. |
| **SEC-07** | **HIGH** | Privilege Escalation | `backend/controllers/userController.ts` (`updateUser`) | `PUT /api/users/:id` allows `Manager` to update `role` (e.g., promote an employee to `Manager` or alter own role) and `isActive` (bypassing `SuperAdmin`-only `/deactivate` and `/activate`). | Restrict `role` and `isActive` modifications in `updateUser` strictly to `SuperAdmin`, and prevent self-role modification. |
| **SEC-08** | **HIGH** | Secrets & Credentials in Repo | `backend/fixPassword.ts`, `backend/dumpUsers.ts`, `backend/dev.db`, `backend/prisma/dev.db`, `backend/dist/` | `fixPassword.ts` hardcodes `'admin@bizleap.com'` / `'password123'`; `dumpUsers.ts` prints bcrypt hashes; SQLite `dev.db` files and stale `dist/` JS are tracked in Git. | Delete `fixPassword.ts`, `dumpUsers.ts`, `fixUsers.ts`, `dev.db`; add `dist/` and `*.db` to `.gitignore`; purge from git history if needed. |

---

## 3. Medium & Low Severity Gaps

| ID | Severity | Category | Location | Finding & Remediation |
|----|----------|----------|----------|-----------------------|
| **SEC-09** | **MEDIUM** | `mustChangePassword` Bypass | `authMiddleware.ts` | `protect` does not check `user.mustChangePassword`. Users with temporary passwords can call any API directly via curl/Postman without changing their password. |
| **SEC-10** | **MEDIUM** | No Token Revocation / Long Expiry | `authController.ts`, `authMiddleware.ts` | 30-day JWTs cannot be invalidated on password change, deactivation (except DB check), or logout (for Bearer tokens). Store `tokenVersion` on `User` or use short-lived access + refresh tokens. |
| **SEC-11** | **MEDIUM** | Dual Token Storage (XSS Exposure) | `authController.ts`, `Login.tsx`, `api.ts` | Token is sent in both `httpOnly` cookie AND JSON body (stored in `sessionStorage`), negating `httpOnly` XSS protection. Rely exclusively on `httpOnly`, `Secure`, `SameSite` cookies + CSRF protection. |
| **SEC-12** | **MEDIUM** | Over-broad `getUsers` Access | `userRoutes.ts`, `userController.ts` | `DevEmployee` & `MediaEmployee` can call `GET /api/users` and receive `email`, `resetPasswordRequested`, and `canResetPassword` flags for all staff. Restrict sensitive fields to `SuperAdmin`/`Manager`. |
| **SEC-13** | **MEDIUM** | Unrestricted AI Upload (DoS) | `aiRoutes.ts` | `multer({ storage: multer.memoryStorage() })` has no `fileSize` limit and no `fileFilter`, and is open to `Viewer`. Add 10MB limit, audio MIME filter, and role check. |
| **SEC-14** | **MEDIUM** | No Rate Limiting or Helmet | `backend/index.ts` | No `express-rate-limit` on `/api/auth/login` or `/api/auth/request-reset`; no `helmet` security headers. |
| **SEC-15** | **MEDIUM** | Missing Input Validation | All controllers | No schema validation (`zod`/`joi`/`class-validator`). Missing fields cause `NaN` / Prisma `500` errors. |
| **SEC-16** | **LOW** | Error Message Leakage | `systemController.ts`, `aiController.ts` | Raw `error.message` returned to client in `500` responses. |
| **SEC-17** | **LOW** | Frontend Route Guard Gap | `frontend/src/App.tsx:77` | `/settings` route lacks `<AuthGuard allowedRoles={['SuperAdmin']}>`. |

---

## 4. Client Isolation & RBAC Readiness (SRS Features 26–31)

| Requirement | Current State | Risk if Unaddressed |
|-------------|---------------|---------------------|
| 5-Role RBAC (`SuperAdmin`, `Manager`, `TeamLead`, `Employee`, `ClientUser`) | ❌ Only `SuperAdmin`, `Manager`, `DevEmployee`, `MediaEmployee`, `Viewer` exist | Cannot support Team Leads or Client portal users. |
| Resource-level authorization & membership tables | ❌ No `TeamMembership` or `ClientMembership` tables | Managers see all departments/data (`getManagerDashboard` is not scoped). |
| Strict Client Separation (`clientId` scoping) | ❌ `clientName` is a free-text string on `Task` | Client A vs Client B isolation is impossible without a `Client` entity and mandatory query scoping. |
| Staff Sharing Controls (`INTERNAL` default) | ❌ No `visibility` column on tasks, reports, or files | Risk of exposing internal comments/drafts to clients once portal is built. |
