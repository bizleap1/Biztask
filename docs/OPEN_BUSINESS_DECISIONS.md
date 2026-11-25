# BizTask Open Business Decisions & Required Inputs

> **Audit Date:** 2026-11-25  
> **Source:** BizTask SRS v1.0 Section 15 + Repository Audit Findings

Before implementing dependent modules, the following business rules, policies, and external service credentials must be confirmed by BizLeap stakeholders. **Dependent automation must remain blocked/configurable until signed off.**

---

## 1. Roles, Hierarchy & Access Policies

| ID | Topic | Owner | Questions Requiring Confirmation |
|----|-------|-------|----------------------------------|
| **OBD-01** | **Role Consolidation** | Operations Lead | Existing DB uses `DevEmployee`, `MediaEmployee`, and `Viewer` (HR). Confirm migrating `DevEmployee`/`MediaEmployee` to unified `Employee` + `Department` assignment, and whether `Viewer` should remain as an HR/read-only role or map to `Manager`/`TeamLead`. |
| **OBD-02** | **Manager Role Grants** | Operations Lead | Which roles may a `Manager` create or assign (e.g., `Employee` and `TeamLead` only, never `Manager` or `SuperAdmin`)? |
| **OBD-03** | **Employee Task Delegation** | Operations Lead | Existing `AssignTask.tsx` allows `DevEmployee`/`MediaEmployee` to assign tasks to peers. Confirm whether `Employee` retains peer/self-assignment rights or if task assignment is restricted to `SuperAdmin`, `Manager`, and `TeamLead`. |
| **OBD-04** | **"P.M." Discipline & Cross-Team Handoffs** | Operations Lead | Clarify the meaning of "P.M." in the team structure and define permitted cross-department handoff rules (e.g., Media → Dev). |

---

## 2. Task & Delivery Rules

| ID | Topic | Owner | Questions Requiring Confirmation |
|----|-------|-------|----------------------------------|
| **OBD-05** | **Post-Rejection Workflow** | Product Owner / Team Leads | SRS specifies `Pending → In Progress → Submitted → Approved / Rejected`. Confirm whether `Rejected` returns the task to `In Progress` or enters a dedicated `Rework` state, and whether `Rejected` tasks can be edited/resubmitted directly. |
| **OBD-06** | **Client At-Risk Rule** | Kaushal & Team Leads | Define the exact threshold that marks a client account "At-Risk" on dashboards (e.g., X overdue tasks, or tasks delayed by > Y hours/days). |
| **OBD-07** | **Daily Reports Fields** | Operations Lead | Existing `DailyReport` uses `workCompleted`, `pendingWork`, `tomorrowPlan`, `blockers`. Spec F06 asks for "Today's work", "Yesterday's work", "Pending activities", "Challenges/blockers", and "On-leave" status. Confirm final field mapping and whether `On leave` skips attachment requirements. |

---

## 3. Commercial, Sales & Finance (F17, F18)

| ID | Topic | Owner | Questions Requiring Confirmation |
|----|-------|-------|----------------------------------|
| **OBD-08** | **Invoice & Tax Rules** | Sales & Finance | Provide sample invoice, numbering prefix/format (e.g., `BL-YYYY-001`), GST/CGST/SGST rates & HSN/SAC rules, and credit-note/adjustment policy for issued invoices. |
| **OBD-09** | **Sales Revenue vs. Collections** | Sales & Finance | Confirm pipeline stages (`New → Contacted → Proposal → Negotiation → Won/Lost`), revenue recognition rules (closed deal value vs. collected receipts), and attribution period. |
| **OBD-10** | **Ads / Lead ROI Formula** | Ads & Sales Leads | Confirm lead quality definitions, walk-in tracking, campaign spend/revenue sources, and exact ROI/profit formulas. |

---

## 4. People Operations & Performance (F19, F20)

| ID | Topic | Owner | Questions Requiring Confirmation |
|----|-------|-------|----------------------------------|
| **OBD-11** | **Attendance & Petpooja Mapping** | HR / Operations | Confirm check-in/out policy, late threshold, working hours, leave types & approvers, and provide sample Petpooja export/API payload with employee ID mapping. |
| **OBD-12** | **Performance Scorecard Rules** | HR / Operations | Confirm `40% on-time + 30% completion + 30% attendance` weighting, exact deduction rules for late submissions/rework, and whether resubmissions receive partial or zero completion credit. |

---

## 5. External Integrations & Infrastructure

| ID | Topic | Owner | Questions Requiring Confirmation |
|----|-------|-------|----------------------------------|
| **OBD-13** | **Database & Storage Hosting** | Technical Lead | Repo currently uses **Supabase PostgreSQL + Supabase Storage** and **Render (backend) + Vercel (frontend)**. Spec proposes **Neon PostgreSQL** and **Cloudinary**. Decide whether to keep Supabase or migrate to Neon + Cloudinary. |
| **OBD-14** | **Google OAuth, Calendar & Gmail** | Technical Lead / Ops | Confirm Google Workspace domain (`bizleap.in`), OAuth client credentials, Calendar owner/sync direction/timezone/cancellation rules, and Gmail sender mailbox. |
| **OBD-15** | **WhatsApp Business API** | Management / Account Owners | Confirm sender account, Meta template approvals, opt-in/consent rules, and budget. Keep automated sending **disabled** until approved (click-to-chat only in interim). |
| **OBD-16** | **AI / OpenAI vs. Gemini** | Product Owner / Tech Lead | Repo already implements Voice Task using **Google Gemini (`@google/genai`)**, whereas spec mentions **OpenAI API**. Confirm whether to standardize on Gemini or add OpenAI, and approve Content Calendar AI & Meeting AI prompts/budgets. |
| **OBD-17** | **Background Jobs (Redis / BullMQ)** | Technical Lead | Confirm provisioning Redis (e.g., Upstash / Render Redis) for BullMQ scheduled jobs (7 PM daily report reminder, escalations, overdue invoices) vs. Render Cron Jobs. |
