CREATE TABLE IF NOT EXISTS "Campaign" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "source" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "Lead" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "companyName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "source" TEXT,
  "stage" TEXT NOT NULL DEFAULT 'New',
  "dealValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "expectedRevenue" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "ownerId" INTEGER NOT NULL,
  "campaignId" INTEGER,
  "nextFollowUpAt" TIMESTAMP(3),
  "lostReason" TEXT,
  "convertedClientId" INTEGER,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "LeadActivity" (
  "id" SERIAL PRIMARY KEY,
  "leadId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'Note',
  "subject" TEXT NOT NULL,
  "notes" TEXT,
  "outcome" TEXT,
  "followUpAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Deal" (
  "id" SERIAL PRIMARY KEY,
  "leadId" INTEGER NOT NULL,
  "clientId" INTEGER,
  "ownerId" INTEGER NOT NULL,
  "campaignId" INTEGER,
  "dealValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "revenue" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "collectedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'Won',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Deal" ADD CONSTRAINT "Deal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Deal" ADD CONSTRAINT "Deal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Deal" ADD CONSTRAINT "Deal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Deal_leadId_key" ON "Deal"("leadId");
CREATE INDEX IF NOT EXISTS "Lead_stage_idx" ON "Lead"("stage");
CREATE INDEX IF NOT EXISTS "Lead_ownerId_idx" ON "Lead"("ownerId");
CREATE INDEX IF NOT EXISTS "Lead_campaignId_idx" ON "Lead"("campaignId");
CREATE INDEX IF NOT EXISTS "Lead_nextFollowUpAt_idx" ON "Lead"("nextFollowUpAt");
CREATE INDEX IF NOT EXISTS "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");
CREATE INDEX IF NOT EXISTS "LeadActivity_followUpAt_idx" ON "LeadActivity"("followUpAt");
CREATE INDEX IF NOT EXISTS "Deal_ownerId_idx" ON "Deal"("ownerId");
CREATE INDEX IF NOT EXISTS "Deal_clientId_idx" ON "Deal"("clientId");
CREATE INDEX IF NOT EXISTS "Deal_campaignId_idx" ON "Deal"("campaignId");
