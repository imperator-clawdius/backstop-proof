import prisma from "../db.server";
import { sha256Hex } from "../lib/crypto.server";
import { assertProofCaptureEditable } from "../lib/proof-integrity";
import { validateProofUpload } from "../lib/upload-validation";
import { captureCreateSchema } from "../lib/validation";
import { createAuditEvent } from "./audit.server";
import type { StorageService } from "./storage.server";

export async function createProofCapture(input: {
  shopId: string;
  shopifyOrderId: string;
  orderName: string;
  staffLabel?: string | null;
  stationLabel?: string | null;
  notes?: string | null;
}) {
  const parsed = captureCreateSchema.parse(input);
  const proof = await prisma.proofCapture.create({
    data: {
      shopId: input.shopId,
      shopifyOrderId: parsed.shopifyOrderId,
      orderName: parsed.orderName,
      staffLabel: parsed.staffLabel || null,
      stationLabel: parsed.stationLabel || null,
      notes: parsed.notes || null,
    },
  });
  await createAuditEvent({
    shopId: input.shopId,
    entityType: "ProofCapture",
    entityId: proof.id,
    action: "proof.created",
    actorType: "MERCHANT",
    actorLabel: parsed.staffLabel || null,
  });
  return proof;
}

export async function uploadProofFile(input: {
  shopId: string;
  shopDomain: string;
  proofCaptureId: string;
  file: File;
  storage: StorageService;
}) {
  const proof = await prisma.proofCapture.findFirstOrThrow({
    where: { id: input.proofCaptureId, shopId: input.shopId },
  });
  assertProofCaptureEditable(proof.status);
  const validated = validateProofUpload({
    filename: input.file.name,
    mimeType: input.file.type,
    byteSize: input.file.size,
  });
  const body = Buffer.from(await input.file.arrayBuffer());
  validateProofUpload({ ...validated, byteSize: body.byteLength });
  const hash = await sha256Hex(body);
  const storageResult = await input.storage.write({
    shopDomain: input.shopDomain,
    key: `proof-captures/${proof.id}/${Date.now()}-${validated.filename}`,
    body,
    contentType: validated.mimeType,
  });
  const proofFile = await prisma.proofFile.create({
    data: {
      proofCaptureId: proof.id,
      shopId: input.shopId,
      storageKey: storageResult.storageKey,
      originalFilename: validated.filename,
      mimeType: validated.mimeType,
      byteSize: body.byteLength,
      sha256: hash,
      capturedAt: new Date(),
    },
  });
  await createAuditEvent({
    shopId: input.shopId,
    entityType: "ProofCapture",
    entityId: proof.id,
    action: "proof.file_uploaded",
    actorType: "MERCHANT",
    actorLabel: proof.staffLabel,
    metadata: {
      proofFileId: proofFile.id,
      sha256: hash,
      byteSize: body.byteLength,
      mimeType: proofFile.mimeType,
    },
  });
  return proofFile;
}

export async function sealProofCapture(input: {
  shopId: string;
  proofCaptureId: string;
  actorLabel?: string | null;
}) {
  const proof = await prisma.proofCapture.findFirstOrThrow({
    where: { id: input.proofCaptureId, shopId: input.shopId },
    include: { files: true },
  });
  if (proof.status === "SEALED") return proof;
  const sealed = await prisma.proofCapture.update({
    where: { id: proof.id },
    data: { status: "SEALED", sealedAt: new Date() },
    include: { files: true },
  });
  await createAuditEvent({
    shopId: input.shopId,
    entityType: "ProofCapture",
    entityId: proof.id,
    action: "proof.sealed",
    actorType: "MERCHANT",
    actorLabel: input.actorLabel ?? proof.staffLabel,
    metadata: { fileCount: proof.files.length },
  });
  return sealed;
}

export async function getProofCaptureForShop(shopId: string, proofCaptureId: string) {
  return prisma.proofCapture.findFirst({
    where: { id: proofCaptureId, shopId },
    include: { files: true },
  });
}

export async function latestProofForOrder(shopId: string, orderId: string) {
  return prisma.proofCapture.findFirst({
    where: { shopId, shopifyOrderId: orderId },
    orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
    include: { files: true },
  });
}
