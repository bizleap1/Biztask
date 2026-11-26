ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "clientVisible" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Task_clientVisible_idx" ON "Task"("clientVisible");
