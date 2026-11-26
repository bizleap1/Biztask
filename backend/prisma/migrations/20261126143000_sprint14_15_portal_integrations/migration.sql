ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "clientApprovalStatus" TEXT NOT NULL DEFAULT 'NotRequested';

CREATE TABLE IF NOT EXISTS "ClientRequest" (
  "id" SERIAL PRIMARY KEY,
  "clientId" INTEGER NOT NULL,
  "requestedById" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "taskId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "PortalReport" (
  "id" SERIAL PRIMARY KEY,
  "clientId" INTEGER NOT NOT NULL,
  "title" TEXT NOT NULL,
  "reportingMonth" INTEGER NOT NULL,
  "reportingYear" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "content" JSONB,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "IntegrationAccount" (
  "id" SERIAL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "accountName" TEXT,
  "externalAccountId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Disconnected',
  "lastSuccessfulSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "SyncLog" (
  "id" SERIAL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "externalRef" TEXT,
  "message" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);

DO $$ BEGIN
  ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PortalReport" ADD CONSTRAINT "PortalReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ClientRequest_clientId_idx" ON "ClientRequest"("clientId");
CREATE INDEX IF NOT EXISTS "ClientRequest_status_idx" ON "ClientRequest"("status");
CREATE INDEX IF NOT EXISTS "ClientRequest_requestedById_idx" ON "ClientRequest"("requestedById");
CREATE UNIQUE INDEX IF NOT EXISTS "PortalReport_clientId_reportingMonth_reportingYear_key" ON "PortalReport"("clientId","reportingMonth","reportingYear");
CREATE INDEX IF NOT EXISTS "PortalReport_clientId_idx" ON "PortalReport"("clientId");
CREATE INDEX IF NOT EXISTS "PortalReport_status_idx" ON "PortalReport"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationAccount_provider_externalAccountId_key" ON "IntegrationAccount"("provider","externalAccountId");
CREATE INDEX IF NOT EXISTS "IntegrationAccount_provider_idx" ON "IntegrationAccount"("provider");
CREATE INDEX IF NOT EXISTS "IntegrationAccount_status_idx" ON "IntegrationAccount"("status");
CREATE INDEX IF NOT EXISTS "SyncLog_provider_idx" ON "SyncLog"("provider");
CREATE INDEX IF NOT EXISTS "SyncLog_status_idx" ON "SyncLog"("status");
CREATE INDEX IF NOT EXISTS "SyncLog_startedAt_idx" ON "SyncLog"("startedAt");
