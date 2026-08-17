-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "invoiceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Document_invoiceId_key" ON "Document"("invoiceId");
