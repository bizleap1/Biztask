# BizTask API Documentation

> **Last Updated:** 2026-11-25  
> **Base URL:** `{BACKEND_URL}/api`

---

## 1. API Overview

| Module | Routes | Status |
|--------|--------|--------|
| Auth | 6 | Implemented |
| Users | 9 | Implemented |
| Tasks | 8 | Implemented |
| Submissions | 6 | Implemented |
| Daily Reports | 9 | Implemented |
| Dashboard | 4 | Implemented |
| Notifications | 6 | Implemented |
| Activity Logs | 4 | Implemented |
| Upload | 1 | Implemented |
| System | 2 | Implemented |
| AI | 1 | Implemented |
| **Clients** | 0 | ❌ NOT STARTED |
| **Meetings** | 0 | ❌ NOT STARTED |
| **Invoices** | 0 | ❌ NOT STARTED |
| **Attendance** | 0 | ❌ NOT STARTED |
| **Leads/CRM** | 0 | ❌ NOT STARTED |
| **Settings** | 0 | ❌ NOT STARTED |
| **Portal** | 0 | ❌ NOT STARTED |

**Total implemented:** ~56 endpoints  
**Total required by spec:** ~200+ endpoints

---

## 2. Authentication

All protected endpoints require a JWT token sent via:
- **Cookie:** `token` (httpOnly, set on login)
- **Header:** `Authorization: Bearer {token}`

Token expiry: 30 days. No refresh token mechanism.

---

## 3. Complete Route Table

### Auth Routes (`/api/auth`)

| Method | Path | Auth | Roles | Handler | Description |
|--------|------|------|-------|---------|-------------|
| POST | `/login` | No | — | `login` | Email/password login, returns JWT |
| POST | `/setup` | Secret | — | `setup` | One-time SuperAdmin creation |
| POST | `/logout` | No | — | `logout` | Clear auth cookie |
| POST | `/change-password` | Yes | Any | `changePassword` | Change current user's password |
| POST | `/request-reset` | No | — | `requestPasswordReset` | Request admin-approved reset |
| POST | `/execute-reset` | No | — | `executePasswordReset` | Reset password (if approved) |

### User Routes (`/api/users`)

| Method | Path | Auth | Roles | Handler | Description |
|--------|------|------|-------|---------|-------------|
| GET | `/departments` | Yes | Any | `getDepartments` | List all departments |
| GET | `/` | Yes | SA, M, DE, ME | `getUsers` | List non-SuperAdmin users |
| POST | `/` | Yes | SA, M | `createUser` | Create employee account |
| GET | `/:id` | Yes | SA, M, self | `getUserById` | Get user profile |
| PUT | `/:id` | Yes | SA, M | `updateUser` | Update user details |
| DELETE | `/:id` | Yes | SA | `deleteUser` | Hard delete user (cascade) |
| PATCH | `/:id/deactivate` | Yes | SA | `deactivateUser` | Deactivate user |
| PATCH | `/:id/activate` | Yes | SA | `activateUser` | Activate user |
| PATCH | `/:id/grant-reset` | Yes | SA | `grantPasswordReset` | Approve password reset |

### Task Routes (`/api/tasks`)

| Method | Path | Auth | Roles | Handler | Description |
|--------|------|------|-------|---------|-------------|
| GET | `/my` | Yes | Any | `getMyTasks` | Tasks assigned to current user |
| GET | `/` | Yes | Any | `getTasks` | All tasks (filtered by role) |
| POST | `/` | Yes | SA, M, DE, ME | `createTask` | Create a new task |
| DELETE | `/bulk` | Yes | Any | `bulkDeleteTasks` | Bulk soft-delete ⚠️ |
| GET | `/:id` | Yes | Any* | `getTaskById` | Task with submissions & comments |
| PUT | `/:id` | Yes | SA, M, DE, ME | `updateTask` | Update task details ⚠️ |
| DELETE | `/:id` | Yes | SA, M, DE, ME | `deleteTask` | Soft-delete task |
| PATCH | `/:id/status` | Yes | Any* | `updateTaskStatus` | Update task status |
| POST | `/:id/submit` | Yes | Assignee | `submitTask` | Submit work for review |

### Submission Routes (`/api/submissions`)

| Method | Path | Auth | Roles | Handler | Description |
|--------|------|------|-------|---------|-------------|
| GET | `/pending` | Yes | SA, M | `getPendingSubmissions` | Pending review queue |
| DELETE | `/bulk` | Yes | Any | `bulkDeleteSubmissions` | Bulk soft-delete ⚠️ |
| DELETE | `/:id` | Yes | SA, M, owner | `deleteSubmission` | Soft-delete submission |
| PATCH | `/:id/approve` | Yes | SA, M | `approveSubmission` | Approve submission |
| PATCH | `/:id/reject` | Yes | SA, M | `rejectSubmission` | Reject with feedback |

### Daily Report Routes (`/api/daily-reports`)

| Method | Path | Auth | Roles | Handler | Description |
|--------|------|------|-------|---------|-------------|
| POST | `/` | Yes | DE, ME, SA, M | `submitReport` | Submit daily report |
| GET | `/` | Yes | SA, M | `getAllReports` | All reports with filters |
| GET | `/my` | Yes | Any | `getMyReports` | Current user's reports |
| DELETE | `/bulk` | Yes | Any | `bulkDeleteReports` | Bulk soft-delete ⚠️ |
| GET | `/:id` | Yes | SA, M, owner | `getReportById` | Single report details |
| PUT | `/:id` | Yes | DE, ME, SA, M | `updateReport` | Edit unreviewed report |
| DELETE | `/:id` | Yes | SA, M, owner | `deleteReport` | Soft-delete report |
| PATCH | `/:id/review` | Yes | SA, M | `reviewReport` | Mark as reviewed |
| PATCH | `/:id/needs-correction` | Yes | SA, M | `markNeedsCorrection` | Request correction |

### Dashboard Routes (`/api/dashboard`)

| Method | Path | Auth | Roles | Handler |
|--------|------|------|-------|---------|
| GET | `/admin` | Yes | SA | `getAdminDashboard` |
| GET | `/manager` | Yes | M | `getManagerDashboard` |
| GET | `/employee` | Yes | DE, ME | `getEmployeeDashboard` |
| GET | `/hr` | Yes | V, SA | `getHrDashboard` |

### Notification Routes (`/api/notifications`)

| Method | Path | Auth | Roles | Handler |
|--------|------|------|-------|---------|
| GET | `/` | Yes | Any | `getNotifications` |
| GET | `/unread-count` | Yes | Any | `getUnreadCount` |
| PATCH | `/read-all` | Yes | Any | `markAllAsRead` |
| PATCH | `/:id/read` | Yes | Owner | `markAsRead` |
| DELETE | `/:id` | Yes | Owner | `deleteNotification` |
| POST | `/check-deadlines` | Yes | SA, M | `checkDeadlines` |

### Other Routes

| Method | Path | Auth | Roles | Handler | Module |
|--------|------|------|-------|---------|--------|
| GET | `/activity-logs/my` | Yes | Any | `getMyActivityLogs` | Activity |
| GET | `/activity-logs/` | Yes | SA, M, V | `getActivityLogs` | Activity |
| DELETE | `/activity-logs/bulk` | Yes | Any | `bulkDeleteActivityLogs` | Activity |
| DELETE | `/activity-logs/:id` | Yes | SA, M, owner | `deleteActivityLog` | Activity |
| POST | `/upload/` | Yes | Any | inline | Upload |
| DELETE | `/system/clear-data` | Yes | SA | `clearAllData` | System |
| DELETE | `/system/flush-data` | Yes | SA | `flushOldData` | System |
| POST | `/ai/parse-task` | Yes | Any | `parseTask` | AI |

**Legend:** SA=SuperAdmin, M=Manager, DE=DevEmployee, ME=MediaEmployee, V=Viewer

---

## 4. Known API Bugs

| Severity | Endpoint | Bug |
|----------|----------|-----|
| **CRITICAL** | `DELETE /tasks/bulk` | Empty `ids` array deletes ALL tasks |
| **CRITICAL** | `DELETE /submissions/bulk` | Empty `ids` array deletes ALL submissions |
| **CRITICAL** | `DELETE /daily-reports/bulk` | Empty `ids` array deletes ALL reports |
| **CRITICAL** | `DELETE /activity-logs/bulk` | Empty `ids` array deletes ALL logs |
| **CRITICAL** | `POST /auth/execute-reset` | Unauthenticated account takeover — no OTP/token |
| **CRITICAL** | `PUT /tasks/:id` | Employees can set status to "Approved" directly |
| **CRITICAL** | All dashboard endpoints | No `isDeleted: false` filter — deleted data corrupts metrics |
| HIGH | `POST /auth/execute-reset` | Missing response on error (request hangs) |
| HIGH | Auth middleware | Fallback JWT secret `'fallback_secret'` |
| HIGH | `GET /users` | Employees can list all users including sensitive flags |
| MEDIUM | `getAllReports` | N+1 query — `calculateMonthlyReportRate` per row |
| MEDIUM | Dashboard date filters | Computed but never applied to queries |
| MEDIUM | `checkDeadlines` | Sends reminders for soft-deleted tasks |
| LOW | Various | Missing input validation on most endpoints |

---

## 5. Missing API Modules

| Module | Spec Features | Endpoints Needed |
|--------|--------------|-----------------|
| `/api/v1/clients` | F14, F26-F31 | ~15 |
| `/api/v1/meetings` | F12 | ~10 |
| `/api/v1/calendar` | F13 | ~8 |
| `/api/v1/leads` | F17 | ~12 |
| `/api/v1/invoices` | F18 | ~12 |
| `/api/v1/attendance` | F19 | ~10 |
| `/api/v1/settings` | F11 | ~8 |
| `/api/v1/portal` | F27-F28 | ~10 |
| `/api/v1/content-calendar` | F07 | ~8 |
| `/api/v1/teams` | F21 | ~6 |
| `/api/v1/performance` | F20 | ~6 |
| `/api/v1/reminders` | F22-F25 | ~10 |
| `/api/v1/comments` | F15 | ~5 |
| `/api/v1/checklists` | F15 | ~5 |
| `/api/v1/time-tracking` | F16 | ~6 |
