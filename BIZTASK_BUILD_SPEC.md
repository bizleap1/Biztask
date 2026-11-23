# BizTask v2 — Build Spec for Antigravity

> **How to use this file:** Put it in the repo root as `BIZTASK_BUILD_SPEC.md`, then tell the agent:
> *"Read BIZTASK_BUILD_SPEC.md completely. Start with Phase 0 only and stop when it's done."*
> After each phase, review the report and reply "Approved — start Phase N".

---

## 0. Your role and ground rules

You are the lead full-stack engineer rebuilding **BizTask**, the internal operations portal of **BizLeap India Pvt. Ltd.** (a 35+ person digital marketing and tech agency in Nagpur). You will:

1. Make the existing app **fast, secure and crash-proof**.
2. Keep **every existing feature** working (listed in §5) and fix the known bugs (§4).
3. Add the **new staff modules** (§6).
4. Add a separate, secure **Client Portal** (§7).

**Rules you must follow throughout:**

- **Inspect before you change.** Read the whole repo (frontend + backend + schema) before writing code. Use the existing stack unless this spec says otherwise.
- **Never lose production data.** The database is live on Supabase with real employees, tasks, daily reports and logs. All schema changes are **additive migrations**, reversible, and tested against a copy first. No `DROP`, no destructive `ALTER` without my explicit approval.
- **Work phase by phase (§10).** At the end of each phase: run lint, typecheck, tests and a production build. Then write a short report (what changed, what's left, how to verify) and **stop and wait for approval**.
- **No hard deletes, anywhere.** Soft delete (`deleted_at`) + a restore path.
- **No secrets in the frontend.** Not the Supabase service-role key, not AI keys, not OAuth secrets.
- **No mock/placeholder data in production code.** Seeds go in a separate seed script for local/staging only.
- **Don't invent scope.** If something is ambiguous, list the question in your phase report instead of guessing.
- **Every API change keeps the old frontend working until the new one ships** (or ship both together).

---

## 1. Current system (what exists today)

| Part | Where | Notes |
|---|---|---|
| Frontend | Vercel — `https://biztask-omega.vercel.app` | React SPA (Vite build, single ~1.27 MB JS bundle), loads Ant Design v4 CSS from jsDelivr CDN + Google Fonts (DM Sans **and** Inter) |
| Backend API | Render — `https://biztask-1.onrender.com/api` | Node REST API, JWT (HS256) auth. Free-tier style cold starts. |
| Database | Supabase Postgres | Tables include users, departments, tasks, task submissions, daily reports, notifications, activity logs, content calendar. Soft-delete via `isDeleted` on tasks/reports. |

**Roles today:** `SuperAdmin`, `Manager`, `DevEmployee`, `MediaEmployee`, `Viewer` (and an `/dashboard/hr` endpoint exists).
**Departments:** Development, Media, Management.

**Known API routes (from the current bundle):**
`/auth/login`, `/auth/logout`, `/auth/request-reset`, `/auth/execute-reset`, `/auth/change-password`,
`/dashboard/admin|manager|employee|hr`,
`/tasks`, `/tasks/my`, `/tasks/:id`, `/tasks/:id/status`, `/tasks/:id/submit`, `/tasks/bulk`,
`/submissions/pending`, `/submissions/:id`, `/submissions/:id/approve|reject`, `/submissions/bulk`,
`/users`, `/users/departments`, `/users/:id`, `/users/:id/activate|deactivate|grant-reset`,
`/employees`, `/daily-reports` (implied), `/content-calendar`,
`/activity-logs`, `/activity-logs/my`, `/activity-logs/:id`, `/activity-logs/bulk`,
`/notifications`, `/notifications/unread-count`, `/notifications/:id/read`, `/notifications/read-all`, `/notifications/check-deadlines`,
`/settings`.

---

## 2. Audit findings you must fix (measured on the live app)

### Performance
- `GET /daily-reports` takes **~10 seconds** for 134 rows (117 KB). Classic N+1 / missing index / no pagination. Every report loads user + department + reviewer separately.
- `GET /tasks` ~2.8 s for **one** row; `/dashboard/admin` ~1.1 s; `/notifications/unread-count` ~1.7 s.
- Render instance sleeps → first request after idle takes 30–50 s.
- One 1.27 MB JS bundle; full antd v4 CSS from CDN; two font families.
- Daily Reports page loads **all** rows at once; huge rows with full text.

### Data correctness
- **Dashboard counts soft-deleted tasks**: API `/tasks` returns 1 live task, dashboard says 8 total / 7 overdue. Overdue list shows deleted tasks. Every aggregate must filter `deleted_at IS NULL`.
- Leaderboard shows points while every task column is 0 — scoring is opaque.
- Notifications: API says 73 unread, dropdown says "No new notifications"; badge shows a dot instead of a count; messages say "user ID 6" instead of the name.

### Security
- Session token lives in `sessionStorage` (so every new tab logs out); an **expired token from ~135 days ago** is still in `localStorage`. Logout doesn't clean up. Tokens live 30 days with no revocation.
- No visible login rate limiting.
- Frontend has **no** CSP / X-Frame-Options / X-Content-Type-Options headers.
- Activity log is **deletable** (Clear All, per-row delete, bulk delete API). Task deletions are **not logged**.
- One-click **"Clear All"** mass-delete exists on Dashboard ("Clear All Data"), Tasks, Daily Reports and Activity Logs.
- Employee emails are placeholders (`Firstname@gmail.com`) — password-reset mail would go to strangers.
- Employees can be **hard-deleted** ("Delete Permanently").
- Admin can set task status straight to "Approved" from the table, skipping proof review.

### Process / UX bugs
- Daily reports can be backdated without limit (one person submitted 10 past reports in 8 minutes); entries like "nothing" / "no" are accepted; 128 of 134 reports never reviewed; one report "Needs Correction" since July.
- Task deadline accepts past dates. Create Task offers only Development and Media (no Management). Category dropdown empty until department chosen, no hint.
- Edit/Delete on task rows only appear on hover (unusable on touch).
- "Voice Task" gives no visible feedback.
- Settings page is "Coming Soon". Unknown routes silently redirect to dashboard (no 404).
- Activity log shows raw IDs ("User #1", "Task #19").
- Mobile: header buttons overflow, tables scroll sideways. 8 of 9 form labels in Create Task aren't linked to inputs; icon buttons lack `aria-label`.
- Page `<title>` is the same on every route.

---

## 3. Target architecture

Keep the current split (Vercel frontend, Render API, Supabase Postgres) but harden it:

```
Browser ──HTTPS──> Vercel (React SPA, static, security headers)
                       │  fetch with credentials (httpOnly cookies)
                       ▼
               Render Web Service (Node API, TypeScript)  ◄── Render Cron Job / worker (reminders, deadline checks)
                       │  pooled connection (Supabase pooler, port 6543)
                       ▼
               Supabase Postgres (+ Storage for files, private buckets)
```

**Decisions:**
- **Language:** TypeScript on both sides (migrate incrementally; new code is TS).
- **Frontend:** React + Vite + React Router (lazy-loaded routes) + **TanStack Query** for all server state. Keep or replace Ant Design based on what's in the repo — but **remove the full antd CDN stylesheet**; import only what's used. One font family: **Inter**.
- **Backend:** keep the existing Node framework (Express or whatever is in the repo). Add: `zod` validation, `helmet`, `cors` allowlist, `express-rate-limit` (or equivalent), `pino` structured logging, `compression`, Sentry.
- **ORM:** keep the existing ORM (likely Prisma). Use a **single client instance**, connect through the **Supabase connection pooler** (transaction mode) and a direct URL for migrations.
- **Region:** Render service and Supabase project must be in the **same region** (ideally Mumbai `ap-south-1`, else Singapore). Report the current regions in Phase 0.
- **Render plan:** a paid instance that doesn't sleep (I'll upgrade it — just tell me which). Add `/healthz` for Render health checks.
- **Files** (task proofs, client deliverables, invoices, reports): **Supabase Storage, private buckets**, served only via short-lived signed URLs issued by the API after a permission check.
- **Background jobs:** move deadline checks and reminders **off the client** (`/notifications/check-deadlines` is currently called from the browser) into a Render Cron Job or a worker.
- **Supabase exposure:** the frontend must **not** talk to Supabase directly. Enable **RLS on every table with no permissive policies for `anon`/`authenticated`** so the auto-generated PostgREST API can't leak data even if the anon key is known. All data goes through our API.

---

## 4. Security & reliability requirements (production level)

### 4.1 Authentication
- **Cookie sessions:** short-lived access token (15 min) + rotating refresh token (7 days, stored **hashed** in a `sessions` table with user agent, IP, created/last-used, revoked_at). Both in `httpOnly; Secure; SameSite=Lax` cookies. Works across tabs; survives reload; logout revokes the session server-side. **Delete any token use of localStorage/sessionStorage** and clear stale keys on first load of the new app.
- **Rotate the JWT secret** on release so all old tokens (including the 135-day-old one) die.
- **CSRF:** SameSite cookies + require a custom header (e.g. `X-Requested-With`) or double-submit token on state-changing requests.
- **Passwords:** argon2id or bcrypt (cost ≥ 12). Min 10 chars, block the most common passwords. Keep "must change on first login".
- **Password reset:** emailed one-time link (token hashed in DB, 30-min expiry, single use). Replace the current manual "grant reset" flow (keep admin-triggered reset as an option that *sends* the link).
- **Rate limits:** login 5 attempts / 15 min per IP+email, then lockout with backoff; reset requests 3 / hour; general API 300 req / 5 min per user.
- **2FA (TOTP)** optional for staff, **required for SuperAdmin**.
- **Staff emails** must be real company addresses (`@bizleap.in`). Add an admin screen to fix them; block reset emails to unverified addresses.

### 4.2 Authorization
- RBAC middleware on **every** route. Roles: `SuperAdmin`, `Admin`, `Manager`, `HR`, `Employee` (with department), `Viewer`, and `Client` (portal only — see §7).
- **Object-level checks** in the service layer (not just the route): an employee can only read/update tasks assigned to them or in their department per policy; a manager only their department; HR sees attendance/leave; clients only their own organisation.
- Staff API under `/api/v1/staff/*`, client API under `/api/v1/portal/*`. A Client session is **rejected** by every staff route and vice versa.
- Response DTOs whitelist fields — never return password hashes, reset tokens, internal notes or other users' private data.
- Write integration tests for **IDOR**: user A can't read/update user B's resources by changing an ID.

### 4.3 Data safety
- Soft delete everywhere (`deleted_at`, `deleted_by`). A **Trash** screen for SuperAdmin with restore (auto-purge after 30 days via job, logged).
- **Remove every "Clear All" mass-delete button.** Bulk actions only on selected rows, max 100, with a confirmation dialog that names the count; destructive bulk actions require typing `DELETE`.
- **Activity/audit log is append-only:** no update/delete endpoints; a Postgres trigger raises an error on `UPDATE`/`DELETE` of `activity_logs`. Log: logins (success/fail), logouts, password changes/resets, role changes, create/update/delete/restore of every entity, approvals/rejections, exports, client-portal logins and views of sensitive items. Store actor name snapshot + IDs; UI shows names and links, not "User #1".
- Employees: **deactivate only** (no permanent delete). Deactivation revokes all sessions.
- Supabase **daily backups / PITR** enabled; document the restore procedure.

### 4.4 Input, output, transport
- `zod` schemas on every request body/query/params; reject unknown fields.
- Uploads: allowlist MIME types (images, PDF, video, common docs), size limits (images 10 MB, video 200 MB, others 25 MB), random object keys, virus-scan hook placeholder, private bucket only.
- **Frontend headers (Vercel `vercel.json`):** `Content-Security-Policy` (self + API origin + Google Fonts + Sentry), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (allow microphone only for voice tasks), HSTS.
- **API:** `helmet`, CORS allowlist of exact origins (staff app, client portal, localhost in dev only), `credentials: true`.
- No source maps published to production (upload them to Sentry instead).
- `npm audit` clean of high/critical; pin dependencies.

### 4.5 Never crash
- Global async error handler → consistent JSON error `{ error: { code, message, requestId } }`; never leak stack traces.
- `process.on('unhandledRejection'|'uncaughtException')` → log to Sentry, exit cleanly so Render restarts; **graceful shutdown** on SIGTERM (stop accepting, finish in-flight, close DB pool).
- Timeouts on every outbound call (DB statement timeout 10 s, external APIs 8 s). Retries with backoff for idempotent reads only.
- `/healthz` (liveness) and `/readyz` (DB ping) endpoints.
- Frontend: React **error boundaries** per route with a "Try again" button; TanStack Query retries for GETs; offline banner; every form shows server validation errors inline; buttons disable while submitting (no double submits); idempotency keys on create endpoints.
- **Sentry** on frontend and backend; uptime monitor on `/readyz` (e.g. Better Stack / UptimeRobot).
- Separate **staging** environment (Render + Supabase branch/project + Vercel preview) — all migrations run on staging first.

---

## 5. Existing features to keep (and fix)

Rebuild/keep these with the bug fixes from §2:

1. **Login / password change / reset** — per §4.1.
2. **Role-based dashboards** (admin, manager, employee, HR) — counts exclude deleted rows; stat cards are clickable (open filtered lists); department filter; date range. No "Clear All Data".
3. **Tasks**
   - Fields: title, description, department, category (categories depend on department — show a hint), client (new), assignee, assigned by, priority (Low/Medium/High/Urgent), deadline (**no past dates**), proof required + proof type (Any, Image, PDF, Video, Screenshot, GitHub PR, Website URL, Social media link), client details, drive link, social platform, post type, GitHub repo, environment.
   - Workflow: **Pending → In Progress → Submitted → Approved / Rejected (with reason) → back to In Progress**. Admins cannot jump to Approved without a submission unless they tick "Approve without proof" (logged).
   - **Voice Task**: record (MediaRecorder) with a visible recording indicator + timer, send audio to the API, transcribe + parse server-side (AI key stays on the server), show a pre-filled Create Task form to confirm. Clear error if mic is denied.
   - Always-visible "⋯" row menu (no hover-only actions). Search, filters (status, department, client, assignee), sorting, **server-side pagination**.
   - Department list must include **Management**.
4. **Review Submissions** — inline preview of proofs (image/PDF/video/link preview), approve/reject with reason, bulk approve selected.
5. **Daily Reports**
   - Structured form: work completed, pending work, blockers, tomorrow's plan, linked tasks, **"On leave / holiday"** option.
   - Can only submit for **today or yesterday**; older dates need manager approval. Min 30 characters for "work completed" unless on leave.
   - Manager review: Reviewed / Needs correction (with feedback). Auto-mark "Reviewed" after 3 days with no action is **configurable**, off by default.
   - List: paginated (25/page), filters (employee, department, status, date range), text truncated to 2 lines with "Read more".
6. **Content Calendar AI generator** — keep. Move the AI call server-side. Save generated calendars against a client. Add "Create tasks from calendar" (one task per post for the Media team). PNG/PDF export.
7. **Employees** — CRUD, roles, departments, designation, status, temp password generator, "Reset requested" flag. Deactivate instead of delete. Profile page with their tasks, reports, attendance and score.
8. **Activity Logs** — read-only (§4.3), filters, names + links instead of IDs, export CSV (SuperAdmin).
9. **Notifications** — bell with **numeric unread badge**; dropdown lists unread first; human names in messages; mark read / mark all read; generated server-side.
10. **Settings** (replace "Coming soon"): company profile (name, address, GSTIN, bank, UPI, logo), departments, task categories per department, working days, daily-report deadline time, late check-in time, invoice prefix and terms, reminder rules, integrations (Google, email, WhatsApp).
11. **404 page**; per-route `<title>` ("Tasks · BizTask").

---

## 6. New staff modules

These already exist as a working prototype ("BizTask Plus"). Match its behaviour and look.

### 6.1 Clients
- Client list cards: name, services, health (Auto/On track/Needs attention/At risk/Paused; Auto = 0 overdue → On track, 1 → Needs attention, 2+ → At risk), task progress %, open/overdue counts, account owner, next meeting. Search.
- Client detail: header (services pills, website, owner), stats (task progress, open tasks, meetings held, outstanding invoices), milestones, open tasks, meetings, contact (WhatsApp link, email), files & links, notes, **"Preview as client"** button, portal access management (§7).

### 6.2 Meetings
- Fields: title, client, date, time, duration, platform (Google Meet / Zoom / Teams / In person / Phone), link, location, attendees (staff multi-select + external emails), agenda, weekly repeat, minutes, action items.
- Upcoming / Past tabs; Join button; copy link; "Minutes missing" flag on past meetings; **Add minutes → each action item line becomes a task**.
- **Google Calendar integration:** per-user Google OAuth (scope: calendar events). Creating a meeting can create the event with an auto Meet link and invites; store `google_event_id`; edits/cancels sync to Calendar.

### 6.3 Tasks upgrades
- Task detail drawer: status, priority, assignee, due, description, **checklist**, **comments with @mentions** (notify mentioned user), linked meeting, proof submissions, activity history.
- **Kanban view** (To do / In progress / Submitted / Done) with drag & drop, plus list view.
- **Recurring tasks** (e.g. "GMB report on the 1st of every month").
- **Time tracking**: start/stop timer per task + manual entry; hours per client per month.

### 6.4 Sales (leads pipeline)
- Lead: contact name, company, phone, email, source (Instagram, Facebook/Meta Ads, Google/Website, Referral, LinkedIn, Walk-in, Cold outreach, Other), service wanted, deal value ₹, stage (New → Contacted → Proposal sent → Negotiation → Won / Lost + lost reason), next follow-up date, owner, notes, activity timeline.
- Board view (columns per stage with totals) + table view. Stats: open pipeline value, won this month, win rate, follow-ups due.
- **Convert to client** on Won (creates client + contact, links lead).

### 6.5 Invoices
- Number auto: `{PREFIX}/{YYYY}/{seq}` (unique, per year), client, invoice date, due date, line items (description, qty, rate), GST 0/5/12/18% (show **CGST/SGST split**; IGST if client state ≠ Maharashtra — client gets a state + GSTIN field), notes, terms.
- Status: Draft → Sent → Part paid → Paid; Overdue computed; Cancelled. Payments: amount, date, mode (UPI/Bank/Cheque/Cash/Card), reference/UTR. Can't record more than the balance.
- **PDF generated server-side** (consistent layout with company details, bank, UPI); stored in Storage; download via signed URL.
- **Email invoice** to the client contact with PDF attached (via the email provider, §6.8).
- Stats: outstanding, overdue, collected this month, billed this month. Filters by status/client. Only SuperAdmin/Admin/accounts role can see invoices.

### 6.6 Attendance & Leave
- Check-in / check-out per person (self-service button + admin edit), late after configurable time (default 10:15), hours worked, 7-day strip + date picker, monthly export CSV.
- Leave requests: type (Casual, Sick, Half day, Work from home), from/to, reason → Pending → Approved/Declined by manager/HR. Leave balances per year (configurable quotas). Holiday calendar.
- People on approved leave are excluded from report/check-in reminders and from attendance %.

### 6.7 Performance scorecard
- Per person, for This month / Last 30 days / Last month:
  - On-time % (tasks completed on or before due) — weight **40%**
  - Completion % (completed ÷ tasks due in period) — **30%**
  - Attendance % (days checked in ÷ working days, excluding Sundays/holidays/approved leave) — **30%**
  - Minus 5 per task overdue right now (max 20), minus 2 per late check-in (max 10).
  - Also show: daily reports submitted ÷ expected, hours logged.
- Team average, top performer, needs-support, ranking table, per-person drill-down. Formula explained on the page. Weights configurable in Settings. Visible to managers/admins; each employee sees only their own.

### 6.8 Reminders & automation (server-side jobs)
Run on a schedule (IST):
| Rule | When | To | Channels |
|---|---|---|---|
| Daily report missing | 7:00 PM Mon–Sat | employee | in-app + email (+ WhatsApp optional) |
| Escalate missing reports | 9:30 PM | department manager | email |
| Reports pending review > 2 days | 10:00 AM | reviewer | in-app + email |
| Task due in 24 h / 2 h | rolling | assignee | in-app + email |
| Task overdue | 10:00 AM daily | assignee + manager | in-app + email |
| Meeting starting | 15 min before | attendees | in-app + email |
| Meeting minutes missing | 30 min after end | organiser | in-app |
| Not checked in | after late time | employee | in-app |
| Lead follow-up due | 9:30 AM | lead owner | in-app + email |
| Invoice overdue | 10:00 AM, every 3 days | client contact (cc owner) | email |
- Each rule toggleable in Settings; quiet hours 10 PM–8 AM and Sundays/leave days.
- **Email provider:** Resend or Amazon SES with the `bizleap.in` domain (SPF/DKIM/DMARC). Transactional templates.
- **WhatsApp (optional, behind a feature flag):** WhatsApp Business Cloud API with approved templates. Until enabled, show "Open in WhatsApp" (`wa.me`) buttons with pre-filled text.
- All sends logged in a `notification_deliveries` table (status, provider id, error) and de-duplicated (never send the same reminder twice).

### 6.9 Team
- Roster used across the app: name, department, role/designation, WhatsApp number, company email, joining date, status. (Merge with Employees — one source of truth.)

---

## 7. Client Portal (separate, secure)

**Goal:** clients log in and see live progress on their own work — what's being done, by whom, how far along — without seeing anything internal.

### 7.1 Access & auth
- Separate app shell at **`/portal`** (or subdomain `clients.bizleap.in` — tell me which is simpler with the current Vercel setup). Own login page with BizLeap branding.
- `client_users` belong to exactly **one** `client` (organisation). A client can have several contacts.
- **Invite flow:** staff click "Invite to portal" on a client → email with a one-time set-password link (expires 72 h). Staff can revoke access instantly (revokes sessions).
- Same cookie-session system as staff but a separate cookie name, `role = Client`, `client_id` in the session.
- 2FA optional for clients. Rate limiting as staff. All client logins logged.

### 7.2 What clients see
- **Overview:** overall progress %, project health, current phase/milestone, next meeting, latest updates, outstanding invoice amount.
- **Projects & milestones:** list with status, target dates, % complete.
- **Work in progress:** tasks marked **client-visible** — title, status, assignee **first name + role** (e.g. "Praveer · Developer"), due date, last update. No internal descriptions, comments or proofs unless explicitly shared.
- **Team on your account:** names, roles, account manager contact.
- **Meetings:** upcoming (with join link) and past with **shared** minutes.
- **Deliverables & files:** shared files/links; client can **Approve** or **Request changes** (with comment) → creates/updates a task and notifies the owner.
- **Reports:** monthly SEO/GMB/ads reports uploaded by staff (PDF) — download via signed URL.
- **Invoices:** list, status, balance, download PDF.
- **Requests / messages:** client can raise a request (title, description, attachment) → appears on the staff side as a task in "Client requests" for the account owner.
- **Activity feed:** only client-visible events.
- Weekly **email digest** to client contacts (toggle per client).

### 7.3 Visibility model (staff side)
- Every task, milestone, file, meeting-minute and comment has `visibility: 'internal' | 'client'` — **default `internal`**.
- Per-item "Share with client" toggle; per-client settings for which sections the portal shows (e.g. hide invoices for some clients).
- "Preview as client" on the client page renders exactly what the client sees.

### 7.4 Isolation — non-negotiable
- `client_id` **always comes from the session**, never from the URL/body. Every portal query is scoped `WHERE client_id = session.client_id AND visibility = 'client' AND deleted_at IS NULL`.
- Portal endpoints live only under `/api/v1/portal/*` and use **separate DTOs** that omit internal fields.
- Postgres **RLS policies** as a second layer for client-visible tables (if the ORM connects with a role that respects RLS) — explain your approach in Phase 0.
- Files: signed URLs (5-min expiry) issued only after the same scope check.
- Automated tests: client A cannot access client B's projects, tasks, files, invoices, or any staff endpoint — by ID guessing, query params or direct storage paths.

---

## 8. Data model (new/changed tables — adapt names to the existing schema)

Use UUID primary keys for new tables; `created_at`, `updated_at`, `created_by`, `deleted_at`, `deleted_by` on all business tables.

- `clients` (name, services[], website, state, gstin, health_override, owner_id, notes, portal_enabled, portal_sections jsonb)
- `client_contacts` (client_id, name, email, phone, is_primary)
- `client_users` (client_id, contact_id, email unique, password_hash, status, last_login_at, invited_at)
- `projects` (client_id, name, status, start/target dates) and `milestones` (project_id, title, due_date, status, visibility)
- `tasks` — add: client_id, project_id, visibility, recurrence_rule, parent_id, estimate_minutes, checklist jsonb (or `task_checklist_items`), meeting_id
- `task_comments` (task_id, author_id, body, mentions uuid[], visibility)
- `time_entries` (task_id, user_id, started_at, ended_at, minutes, note)
- `meetings` (client_id, title, starts_at timestamptz, duration_min, platform, link, location, agenda, minutes, minutes_visibility, recurring, google_event_id, organiser_id) + `meeting_attendees` (meeting_id, user_id | email)
- `leads` (contact_name, company, phone, email, source, service, value numeric, stage, lost_reason, follow_up_on, owner_id, client_id, won_at) + `lead_activities`
- `invoices` (number unique, client_id, issue_date, due_date, gst_rate, place_of_supply, status, notes, pdf_path, sent_at) + `invoice_items` + `payments` (invoice_id, amount, paid_on, mode, reference, recorded_by)
- `attendance` (user_id, date, check_in, check_out, source) unique(user_id, date)
- `leave_requests` (user_id, type, from_date, to_date, half_day, reason, status, decided_by, decided_at) + `leave_balances` + `holidays`
- `files` (owner entity type/id, client_id, bucket path, mime, size, visibility, uploaded_by)
- `client_requests` (client_id, client_user_id, title, body, status, task_id)
- `sessions`, `password_resets`, `oauth_tokens` (user_id, provider, encrypted refresh token), `notification_deliveries`, `settings` (key/value jsonb)
- `activity_logs` — append-only trigger; add actor_type (staff/client/system), actor_name, ip, user_agent.

**Indexes (minimum):**
`tasks(assigned_to_id, status, deadline) WHERE deleted_at IS NULL`, `tasks(client_id) WHERE deleted_at IS NULL`, `daily_reports(user_id, report_date DESC)`, `daily_reports(status, report_date DESC)`, `notifications(user_id, is_read, created_at DESC)`, `activity_logs(created_at DESC)`, `activity_logs(entity_type, entity_id)`, `attendance(date)`, `meetings(starts_at)`, `meetings(client_id)`, `leads(stage, follow_up_on)`, `invoices(client_id, status)`, `invoices(due_date) WHERE status IN ('sent','part_paid')`, `sessions(user_id) WHERE revoked_at IS NULL`.

**Migration of existing data:** keep all existing rows. Map current `isDeleted=true` → `deleted_at = updated_at`. Existing tasks get `visibility='internal'`. Fix employee emails via an admin screen (don't guess). Write a one-off script that reports anomalies (tasks without department, reports with future dates, etc.) instead of silently changing them.

---

## 9. Performance requirements

**Targets (measure before & after, report both):**
- API p95 < **300 ms** for list endpoints, < 150 ms for simple reads (warm, same region).
- First load: LCP < **2 s** on a fast 4G profile; initial JS < **250 KB gzipped**; route chunks lazy-loaded.
- No list endpoint returns more than 100 rows; default page size 25.

**Backend:**
- Kill N+1: fetch relations in one query with `select` of only needed columns (`include`/joins). Start with `/daily-reports`, `/tasks`, `/dashboard/*`, `/notifications`.
- **Dashboard aggregates in SQL** (`COUNT(*) FILTER (WHERE …)` in one query per widget, or a view), always excluding deleted rows; cache per user for 30–60 s (in-memory LRU; Redis only if needed).
- Cursor-based pagination for long lists (reports, logs, notifications); offset OK for small tables.
- `compression` middleware; `ETag` on GETs; keep-alive.
- Connection pool via Supabase pooler; set `statement_timeout`.
- Unread-count endpoint must be a single indexed `COUNT`.

**Frontend:**
- Route-level code splitting (`React.lazy`), vendor chunk separation.
- Remove the antd CDN CSS; tree-shake components; one font (Inter, `display=swap`, preconnect).
- TanStack Query: sensible `staleTime` (30 s for lists, 5 min for reference data like users/departments/clients), prefetch on hover for detail pages, **optimistic updates** for status changes/checklists/comments.
- Skeleton loaders instead of "Loading…"; virtualized rows for lists > 100 items.
- Server-side search with 300 ms debounce.
- Images lazy-loaded; avatars as initials.

---

## 10. Phases (stop after each one)

### Phase 0 — Audit & plan (no code changes)
Deliver a report with: stack and versions found, folder structure, DB schema dump (tables, row counts, indexes), current regions of Render/Supabase, baseline timings for the slow endpoints, bundle analysis, list of every place that reads/writes tokens, every hard-delete path, every `Clear All`, and a concrete plan + migration list for Phases 1–7. List open questions.
**Stop.**

### Phase 1 — Security foundation & crash-proofing
Cookie sessions + refresh rotation + revocation, secret rotation, rate limiting, helmet/CORS/headers, zod on existing endpoints, RBAC + object-level checks on existing endpoints, append-only activity log, soft-delete everywhere + Trash, remove Clear All, error handling, health checks, graceful shutdown, Sentry, RLS lockdown on Supabase tables, staging env.
Acceptance: login works across tabs; logout kills the session on all devices; 6th wrong password is blocked; `curl` to Supabase REST with the anon key returns nothing; IDOR tests pass; deleting the activity log via SQL fails.
**Stop.**

### Phase 2 — Speed
N+1 fixes, indexes, pagination, SQL aggregates, caching, compression, bundle splitting, font/CSS cleanup, TanStack Query.
Acceptance: before/after table of timings and bundle sizes meeting §9 targets; dashboard numbers match the task list exactly.
**Stop.**

### Phase 3 — Fix existing features
Everything in §2 (process/UX bugs) and §5: notifications, daily report rules, task workflow, voice task, settings page, 404, titles, mobile layouts, accessibility, employee deactivate-only, real emails screen.
**Stop.**

### Phase 4 — New staff modules
Clients, Meetings, task drawer/checklist/comments/kanban/recurring/time tracking, Sales, Invoices (server PDF), Attendance & Leave, Performance, Team — per §6.
**Stop.**

### Phase 5 — Client Portal
Per §7, including invite flow, visibility toggles, "Preview as client", portal UI, digest emails and the isolation test suite.
**Stop.**

### Phase 6 — Integrations & automation
Google OAuth + Calendar sync, email provider + templates, scheduled reminder jobs (§6.8) with delivery log and de-dup, optional WhatsApp behind a flag.
**Stop.**

### Phase 7 — Hardening & launch
Test coverage (unit for services, API integration for auth/RBAC/portal isolation, Playwright e2e: login, create task → submit proof → approve, daily report, meeting with minutes → tasks, invoice → payment, client portal login), CI on GitHub Actions (lint, typecheck, test, build) gating deploys, load test on main endpoints (50 concurrent users), backup/restore drill, `README` + `RUNBOOK.md` (deploy, rollback, rotate secrets, restore DB, add a client to the portal), environment variable list.

---

## 11. Design system (match BizTask Plus)

- Clean black-and-white UI: background `#F9FAFB`, cards white with `1px #E5E7EB` border and 14 px radius, text `#111827`, secondary `#4B5563` (keep 4.5:1 contrast), primary buttons black pill-shaped, secondary white with grey border.
- Status pills: green `#047857` on `#ECFDF5` (done/on track), amber `#92400E` on `#FFFBEB` (pending/due soon), red `#B91C1C` on `#FEF2F2` (overdue/at risk), blue `#1D4ED8` on `#EFF6FF` (in progress), purple `#6D28D9` on `#F5F3FF` (review/recurring).
- Font: **Inter** only. Left sidebar nav (collapses to a hamburger under 768 px), top bar with notifications bell showing the **number**.
- Stat cards row at the top of every module; filters row; table or board below; task details open in a **right-side drawer**; forms in centred modals.
- Mobile (< 640 px): tables become cards, header actions wrap, touch targets ≥ 44 px.
- Accessibility: every input has a linked `<label>`, icon buttons have `aria-label`, focus states visible, dialogs trap focus and close on Esc.
- Client portal: same system with a lighter, more spacious layout, BizLeap logo, and a "Your account manager" card.

---

## 12. Environment variables (document all in `.env.example`)

`DATABASE_URL` (pooler), `DIRECT_URL` (migrations), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_DOMAIN`, `APP_URL`, `PORTAL_URL`, `API_URL`, `CORS_ORIGINS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `STORAGE_BUCKET_PRIVATE`, `SENTRY_DSN_API`, `SENTRY_DSN_WEB`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY` (for stored OAuth refresh tokens), `AI_API_KEY` (content calendar + voice task, server only), `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` (optional), `TZ=Asia/Kolkata`.

---

## 13. Definition of done

- All existing features work; nothing regressed; existing data intact.
- §9 performance targets met and measured.
- All §4 security items implemented and tested; zero high/critical `npm audit` issues.
- Client portal isolation tests pass.
- No console errors in production; Sentry shows no unhandled errors in a 48-hour staging soak.
- CI green; README + RUNBOOK written; staging and production both deployed.
