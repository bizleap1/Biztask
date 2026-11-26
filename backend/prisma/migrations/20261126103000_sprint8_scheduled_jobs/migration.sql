CREATE TABLE IF NOT EXISTS "ScheduledJob" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "schedule" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt" TIMESTAMP(3),
  "lastStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ScheduledJob_name_key" ON "ScheduledJob"("name");
CREATE INDEX IF NOT EXISTS "ScheduledJob_enabled_idx" ON "ScheduledJob"("enabled");

CREATE TABLE IF NOT EXISTS "ScheduledJobAttempt" (
  "id" SERIAL PRIMARY KEY,
  "jobId" INTEGER,
  "jobName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Running',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "processed" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "errors" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "ScheduledJobAttempt" DROP CONSTRAINT IF EXISTS "ScheduledJobAttempt_jobId_fkey";
ALTER TABLE "ScheduledJobAttempt"
  ADD CONSTRAINT "ScheduledJobAttempt_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "ScheduledJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "ScheduledJobAttempt_idempotencyKey_key" ON "ScheduledJobAttempt"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ScheduledJobAttempt_jobName_idx" ON "ScheduledJobAttempt"("jobName");
CREATE INDEX IF NOT EXISTS "ScheduledJobAttempt_status_idx" ON "ScheduledJobAttempt"("status");
CREATE INDEX IF NOT EXISTS "ScheduledJobAttempt_startedAt_idx" ON "ScheduledJobAttempt"("startedAt");
