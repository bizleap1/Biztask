# Testing Checklist

## Authentication
- [x] SuperAdmin setup works once.
- [ ] Login works with correct credentials.
- [ ] Wrong password fails cleanly.
- [ ] Inactive user cannot login.
- [ ] Removed user cannot login.
- [ ] Token persists after refresh.
- [ ] Logout clears token.

## Employee Management
- [ ] Add employee works.
- [ ] Duplicate email blocked.
- [ ] Edit employee works.
- [ ] Deactivate employee works.
- [ ] Activate employee works.
- [ ] Remove employee requires confirmation.
- [ ] Last SuperAdmin cannot be removed.

## Task Management
- [ ] Create Development task.
- [ ] Create Media task.
- [ ] Assigned employee dropdown filters by department.
- [ ] Employee sees only own tasks.
- [ ] Employee can start task.
- [ ] Employee can submit task with proof.
- [ ] Employee cannot approve own task.
- [ ] Manager/SuperAdmin can approve/reject.
- [ ] Rejected task shows feedback.
- [ ] Employee can resubmit.

## Daily Reports
- [ ] Employee can submit today’s report.
- [ ] Duplicate report for same date blocked.
- [ ] Manager/SuperAdmin can review.
- [ ] Needs Correction requires feedback.
- [ ] Employee can edit and resubmit correction.

## Dashboard
- [ ] SuperAdmin analytics load.
- [ ] Manager analytics load only team data.
- [ ] Employee dashboard shows own data.
- [ ] Empty states do not crash.
- [ ] Charts do not crash with empty data.

## Notifications & Activity Logs
- [ ] New task notification created.
- [ ] Approval/rejection notification created.
- [ ] Daily report notification created.
- [ ] Login activity logged.
- [ ] SuperAdmin can view global logs.
- [ ] Employee cannot view global logs.

## Responsive Design
- [ ] Mobile layout works.
- [ ] Sidebar works as a drawer on mobile.
- [ ] Tables do not break boundaries.
