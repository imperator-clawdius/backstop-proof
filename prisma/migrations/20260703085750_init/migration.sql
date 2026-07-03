-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" DATETIME,
    "accessScope" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "settings" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProofCapture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "staffLabel" TEXT,
    "stationLabel" TEXT,
    "notes" TEXT,
    "sealedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProofCapture_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProofFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proofCaptureId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProofFile_proofCaptureId_fkey" FOREIGN KEY ("proofCaptureId") REFERENCES "ProofCapture" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProofFile_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidencePack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "disputeId" TEXT,
    "proofCaptureId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "pdfStorageKey" TEXT NOT NULL,
    "rebuttalText" TEXT NOT NULL,
    "completenessScore" INTEGER NOT NULL,
    "missingItems" JSONB NOT NULL,
    "rawSnapshot" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EvidencePack_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvidencePack_proofCaptureId_fkey" FOREIGN KEY ("proofCaptureId") REFERENCES "ProofCapture" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisputeSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifyDisputeId" TEXT NOT NULL,
    "shopifyOrderId" TEXT,
    "orderName" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "evidenceDueBy" DATETIME,
    "raw" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DisputeSnapshot_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "actorLabel" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNREAD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "Notification_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");

-- CreateIndex
CREATE INDEX "ProofCapture_shopId_shopifyOrderId_idx" ON "ProofCapture"("shopId", "shopifyOrderId");

-- CreateIndex
CREATE INDEX "ProofCapture_shopId_status_idx" ON "ProofCapture"("shopId", "status");

-- CreateIndex
CREATE INDEX "ProofFile_shopId_proofCaptureId_idx" ON "ProofFile"("shopId", "proofCaptureId");

-- CreateIndex
CREATE INDEX "ProofFile_shopId_sha256_idx" ON "ProofFile"("shopId", "sha256");

-- CreateIndex
CREATE INDEX "EvidencePack_shopId_shopifyOrderId_idx" ON "EvidencePack"("shopId", "shopifyOrderId");

-- CreateIndex
CREATE INDEX "EvidencePack_shopId_disputeId_idx" ON "EvidencePack"("shopId", "disputeId");

-- CreateIndex
CREATE INDEX "DisputeSnapshot_shopId_status_idx" ON "DisputeSnapshot"("shopId", "status");

-- CreateIndex
CREATE INDEX "DisputeSnapshot_shopId_evidenceDueBy_idx" ON "DisputeSnapshot"("shopId", "evidenceDueBy");

-- CreateIndex
CREATE UNIQUE INDEX "DisputeSnapshot_shopId_shopifyDisputeId_key" ON "DisputeSnapshot"("shopId", "shopifyDisputeId");

-- CreateIndex
CREATE INDEX "AuditEvent_shopId_entityType_entityId_idx" ON "AuditEvent"("shopId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_shopId_createdAt_idx" ON "AuditEvent"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_shopId_status_idx" ON "Notification"("shopId", "status");

-- CreateIndex
CREATE INDEX "Notification_shopId_type_idx" ON "Notification"("shopId", "type");
