-- Sprint 12: Content Calendar AI (F07)
-- Adds ContentCalendar and ContentItem tables

CREATE TABLE "ContentCalendar" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCalendar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentItem" (
    "id" SERIAL NOT NULL,
    "calendarId" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "platform" TEXT NOT NULL,
    "postType" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "objective" TEXT,
    "visualIdea" TEXT,
    "hashtags" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "reviewNotes" TEXT,
    "taskId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "ContentCalendar_clientId_month_year_key" ON "ContentCalendar"("clientId", "month", "year");
CREATE UNIQUE INDEX "ContentItem_taskId_key" ON "ContentItem"("taskId");

-- Indexes
CREATE INDEX "ContentCalendar_clientId_idx" ON "ContentCalendar"("clientId");
CREATE INDEX "ContentCalendar_createdById_idx" ON "ContentCalendar"("createdById");
CREATE INDEX "ContentCalendar_status_idx" ON "ContentCalendar"("status");
CREATE INDEX "ContentItem_calendarId_idx" ON "ContentItem"("calendarId");
CREATE INDEX "ContentItem_scheduledDate_idx" ON "ContentItem"("scheduledDate");
CREATE INDEX "ContentItem_status_idx" ON "ContentItem"("status");
CREATE INDEX "ContentItem_platform_idx" ON "ContentItem"("platform");

-- Foreign keys
ALTER TABLE "ContentCalendar" ADD CONSTRAINT "ContentCalendar_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentCalendar" ADD CONSTRAINT "ContentCalendar_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "ContentCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
