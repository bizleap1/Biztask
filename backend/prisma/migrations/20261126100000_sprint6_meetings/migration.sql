ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "meetingId" INTEGER;

CREATE TABLE IF NOT EXISTS "Meeting" (
  "id" SERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "agenda" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  "locationLink" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Scheduled',
  "repeatWeekly" BOOLEAN NOT NULL DEFAULT false,
  "organizerId" INTEGER NOT NULL,
  "clientId" INTEGER,
  "externalEventId" TEXT,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "MeetingAttendee" (
  "id" SERIAL PRIMARY KEY,
  "meetingId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "response" TEXT NOT NULL DEFAULT 'Pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("meetingId", "userId")
);

CREATE TABLE IF NOT EXISTS "MeetingMinute" (
  "id" SERIAL PRIMARY KEY,
  "meetingId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "recordedById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "MeetingActionItem" (
  "id" SERIAL PRIMARY KEY,
  "meetingId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "assigneeId" INTEGER,
  "dueDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'Open',
  "taskId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("taskId")
);

DO $$ BEGIN
  ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MeetingMinute" ADD CONSTRAINT "MeetingMinute_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MeetingMinute" ADD CONSTRAINT "MeetingMinute_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Meeting_startAt_idx" ON "Meeting"("startAt");
CREATE INDEX IF NOT EXISTS "Meeting_organizerId_idx" ON "Meeting"("organizerId");
CREATE INDEX IF NOT EXISTS "Meeting_clientId_idx" ON "Meeting"("clientId");
CREATE INDEX IF NOT EXISTS "Meeting_status_idx" ON "Meeting"("status");
CREATE INDEX IF NOT EXISTS "MeetingAttendee_userId_idx" ON "MeetingAttendee"("userId");
CREATE INDEX IF NOT EXISTS "MeetingMinute_meetingId_idx" ON "MeetingMinute"("meetingId");
CREATE INDEX IF NOT EXISTS "MeetingActionItem_meetingId_idx" ON "MeetingActionItem"("meetingId");
CREATE INDEX IF NOT EXISTS "MeetingActionItem_assigneeId_idx" ON "MeetingActionItem"("assigneeId");
CREATE INDEX IF NOT EXISTS "Task_meetingId_idx" ON "Task"("meetingId");
