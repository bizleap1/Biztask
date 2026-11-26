CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" SERIAL PRIMARY KEY,
  "invoiceNumber" TEXT NOT NULL,
  "clientId" INTEGER NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "cgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "sgstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "igstAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "amountPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "snapshot" JSONB,
  "issuedAt" TIMESTAMP(3),
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "Invoice_clientId_idx" ON "Invoice"("clientId");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX IF NOT EXISTS "Invoice_dueDate_idx" ON "Invoice"("dueDate");

CREATE TABLE IF NOT EXISTS "InvoiceItem" (
  "id" SERIAL PRIMARY KEY,
  "invoiceId" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "lineTotal" DECIMAL(65,30) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "Receipt" (
  "id" SERIAL PRIMARY KEY,
  "invoiceId" INTEGER NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "method" TEXT NOT NULL DEFAULT 'Bank',
  "reference" TEXT,
  "notes" TEXT,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");

CREATE TABLE IF NOT EXISTS "Attendance" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "workDate" TIMESTAMP(3) NOT NULL,
  "checkInAt" TIMESTAMP(3),
  "checkOutAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'Present',
  "source" TEXT NOT NULL DEFAULT 'Manual',
  "externalRef" TEXT,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "LeaveRequest" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "approverId" INTEGER,
  "leaveType" TEXT NOT NULL DEFAULT 'Casual',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "Holiday" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX IF NOT EXISTS "Receipt_invoiceId_idx" ON "Receipt"("invoiceId");
CREATE INDEX IF NOT EXISTS "Receipt_receivedAt_idx" ON "Receipt"("receivedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_user_workDate_externalRef_key" ON "Attendance"("userId","workDate","externalRef");
CREATE INDEX IF NOT EXISTS "Attendance_userId_idx" ON "Attendance"("userId");
CREATE INDEX IF NOT EXISTS "Attendance_workDate_idx" ON "Attendance"("workDate");
CREATE INDEX IF NOT EXISTS "Attendance_externalRef_idx" ON "Attendance"("externalRef");
CREATE INDEX IF NOT EXISTS "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");
CREATE INDEX IF NOT EXISTS "LeaveRequest_status_idx" ON "LeaveRequest"("status");
CREATE INDEX IF NOT EXISTS "LeaveRequest_startDate_idx" ON "LeaveRequest"("startDate");
CREATE UNIQUE INDEX IF NOT EXISTS "Holiday_date_key" ON "Holiday"("date");
