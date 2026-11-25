# BizTask Development Roadmap & Effort Estimate

> **Audit Date:** 2026-11-25  
> **Team Assumption:** 1–2 Full-Stack Developers  
> **Recalculated Estimate:** **26–32 weeks** (13–16 two-week sprints), revised from the SRS indicative 32–36 weeks because ~25–30% of core foundations (Task CRUD, Daily Reports, Auth, Dashboards, AI Voice Task) already exist and are salvageable, offset by critical security/DB migration debt.

---

## 1. Architecture Decision Summary

- **Keep:** Modular monolith in Node.js + Express + TypeScript + Prisma + PostgreSQL, and React 19 + Vite + TypeScript + Tailwind CSS v4 frontend. (No rewrite needed — existing codebase is clean enough to modernize incrementally.)
- **Upgrade:** Introduce Zod validation, versioned `/api/v1` (or backwards-compatible `/api` → `/api/v1` transition), proper Prisma migrations (`prisma migrate`), Redis + BullMQ for scheduled jobs, private signed URLs for file storage, and Vitest/Supertest/Playwright for automated testing.

---

## 2. Prioritized Implementation Plan (By Sprint)

| Sprint | Duration | Phase / Scope | Features Covered | Key Dependencies | Risks |
|--------|----------|---------------|------------------|------------------|-------|
| **Sprint 0** | Completed | Repository audit, architecture, DB, API, security, and roadmap docs | All 31 (Audit) | None | — |
| **Sprint 1** | 2 wks | **Stabilization & Security Hotfixes**: Remove `fixPassword.ts`/`dumpUsers.ts`/`dev.db`; fix `bulkDelete*` mass-delete bugs; fix `executePasswordReset` takeover & hang; remove `'fallback_secret'`; generate baseline Prisma migrations; add `zod`, `helmet`, `express-rate-limit`, Vitest/Supertest setup; fix broken JSON proof/attachment links in `ReviewSubmissions.tsx` & `DailyReports.tsx`; fix `isDeleted: false` filters in dashboards & `checkDeadlines`. | Security & Bugfixes (F01, F02, F03, F05, F06, F09) | None | Production DB sync if existing Supabase DB has un-migrated schema |
| **Sprint 2** | 2 wks | **Auth, 5-Role RBAC & Memberships**: Unify `Employee` role, add `TeamLead` & `ClientUser` roles; add `Team`, `TeamMembership`, `ClientMembership` tables; enforce `mustChangePassword` on backend; add Google OAuth login (`F01`); enforce immutable `ActivityLog` (remove delete endpoints); private signed file URLs; RBAC integration tests. | F01, F08, F09 | Sprint 1, OBD-01, OBD-02 | Role migration of existing `DevEmployee`/`MediaEmployee` users |
| **Sprint 3** | 2 wks | **Clients, Teams & Settings**: Create `Client`, `ClientContact`, `Project`, `Setting` tables; build `/api/v1/clients`, `/api/v1/teams`, `/api/v1/settings`; replace hardcoded department IDs & `Task.clientName` free-text with `Client` FK; build Clients UI, Team Roster (`F21`), Settings UI (`F11`). | F11, F14, F21 | Sprint 2 | Data migration for existing `Task.clientName` strings |
| **Sprint 4** | 2 wks | **Task Management Completion**: `TaskStatusHistory`, `TaskChecklist`, `Comment` CRUD + `@mentions`, multi-assignee support, `estimatedDuration`, bulk approval endpoint (`F05`), post-rejection workflow (`OBD-05`), Kanban board & time tracking (`F16`), Daily Reports 25/page pagination & On-leave status (`F06`). | F03, F05, F06, F15, F16 | Sprint 3, OBD-05, OBD-07 | Concurrency/optimistic locking on Kanban drag-and-drop |
| **Sprint 5** | 2 wks | **Role Dashboards & Reporting**: Add Team Lead dashboard; fix date-range filtering & cache invalidation; implement clickable KPI drill-downs (`F02`); implement configurable Client At-Risk rule (`OBD-06`); remove hardcoded HR System Health placeholder. | F02, F14 | Sprint 3, Sprint 4, OBD-06 | Query performance on large datasets without proper indexes |
| **Sprint 6** | 2 wks | **Meetings & Google Calendar**: `Meeting`, `MeetingMinutes`, `ActionItem`, `CalendarSync` tables; recurring weekly meetings; action-item-to-task conversion (`F12`); Google Calendar OAuth + Meet link + idempotent cancellation sync (`F13`). | F12, F13 | Sprint 2, Sprint 3, OBD-14 | Google Workspace API verification/scopes |
| **Sprint 7** | 2 wks | **Notifications, Reminder List & Manual Channels**: Unified Reminder List (`F22`); WhatsApp click-to-chat & templates (`F23`); Gmail/Email reminder drafts (`F24`); fix `NotificationBell` role-aware routing. | F10, F22, F23, F24 | Sprint 4, Sprint 6 | Email/WhatsApp template wording sign-off |
| **Sprint 8** | 2 wks | **Scheduled Jobs & Escalations**: Redis + BullMQ worker setup; 7 PM daily report reminder + manager escalation; deadline, meeting, and invoice overdue reminders with idempotency keys and retry/DLQ handling (`F25`). | F25 | Sprint 7, OBD-17 | Redis hosting & serverless (Vercel) incompatibility → requires Render worker |
| **Sprint 9** | 2 wks | **Sales CRM Pipeline**: `Lead`, `LeadActivity`, `Deal`, `Campaign` tables; `New → Contacted → Proposal → Negotiation → Won/Lost` pipeline; follow-up reminders; Won-to-Client conversion; sales performance reports (`F17`). | F17 | Sprint 3, OBD-09 | Attribution & ROI formula alignment |
| **Sprint 10** | 2 wks | **Invoices & Payments**: `Invoice`, `InvoiceItem`, `Payment`, `CreditNote` tables; GST/CGST/SGST calculation; immutable issued snapshots; PDF generation & email workflow; partial payments & overdue tracking (`F18`). | F18 | Sprint 3, Sprint 8, OBD-08 | Tax compliance & rounding edge cases |
| **Sprint 11** | 2 wks | **Attendance, Leave & Scorecard**: `Attendance`, `LeaveRequest`, `LeaveBalance`, `Holiday` tables; check-in/out, late tracking, leave approval (`F19`); Petpooja idempotent import; Performance Scorecard `40/30/30` (`F20`). | F19, F20 | Sprint 2, OBD-11, OBD-12 | Petpooja export format & deduction rules |
| **Sprint 12** | 2 wks | **Content Calendar AI**: `ContentCalendar`, `ContentItem` tables; monthly client planning; AI suggestions with human review gate; convert approved items to tasks; PDF/PNG export (`F07`). | F07 | Sprint 3, Sprint 4, OBD-16 | Client-side vs server-side PDF/PNG rendering |
| **Sprint 13** | 2 wks | **Client Portal Foundation & Strict Isolation**: Client invite/login & instant revocation (`F26`); Staff Sharing Controls (`INTERNAL` default, `Share with Client`, `Preview as Client`, `F30`); Client Portal dashboard, tasks, milestones, meetings (`F27`); automated 2-client isolation test suite (`F31`). | F26, F27, F30, F31 | Sprint 2–6 | **Critical security gate:** zero cross-tenant leakage |
| **Sprint 14** | 2 wks | **Client Requests, Approvals & Weekly Digest**: Client Request form & account manager conversion to task (`F28`); client content approvals & invoice view; Weekly Client Digest generator (`F29`). | F28, F29 | Sprint 10, Sprint 12, Sprint 13 | Filtering out internal-only comments/tasks in digests |
| **Sprint 15** | 2 wks | **Hardening, Security Testing & Production Release**: Full E2E Playwright suite, security/penetration tests (RBAC, direct URL, revoked sessions, file access), backup/restore reconciliation drill, OpenAPI/Swagger docs, staging UAT & production cutover. | All 31 | All prior sprints | Unresolved UAT defects or missing prod credentials |

---

## 3. Effort & Resource Allocation (1–2 Developers)

| Role | Focus Areas |
|------|-------------|
| **Developer 1 (Backend / Architect)** | Security hotfixes, Prisma migrations, RBAC & tenant isolation middleware, BullMQ worker, CRM/Invoices/Attendance/Calendar APIs, unit/integration/security tests, Render/DB ops. |
| **Developer 2 (Frontend / Full-Stack)** | Shared UI component library (Modal, DataTable, ConfirmDialog, Toast, FileUpload), fixing existing page bugs, Kanban, Calendar, CRM/Invoice/HR screens, Client Portal, Playwright E2E tests. |

> **If 1 Developer:** Serial execution following the exact sprint dependency order above; expect **40–48 weeks** for all 31 features, or deliver **MVP (Sprints 1–6 + 13)** in **14–16 weeks** first.
