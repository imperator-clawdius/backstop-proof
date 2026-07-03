import prisma from "../db.server";
import { calculateEvidenceCompleteness } from "../lib/evidence-score";
import { assertProofCaptureMatchesOrder } from "../lib/proof-integrity";
import { generateRebuttal } from "../lib/rebuttal";
import type { ShopifyDispute, ShopifyOrder } from "../lib/shopify-types";
import { evidenceCreateSchema } from "../lib/validation";
import { createAuditEvent, normalizeJson } from "./audit.server";
import { getDemoDispute, getDemoOrder } from "./demo-data.server";
import { createNotification } from "./notifications.server";
import { generateEvidencePdf } from "./pdf.server";
import { policyTextFromSettings, parseShopSettings } from "./settings.server";
import { ShopifyGraphqlService } from "./shopify-graphql.server";
import type { ShopContext } from "./shop-context.server";
import { getStorageService } from "./storage.server";

export async function generateEvidencePack(input: {
  context: ShopContext;
  orderId: string;
  disputeId?: string | null;
  proofCaptureId?: string | null;
  communications?: string | null;
  reason?: string | null;
}) {
  const parsed = evidenceCreateSchema.parse({
    orderId: input.orderId,
    disputeId: input.disputeId ?? undefined,
    proofCaptureId: input.proofCaptureId ?? undefined,
    communications: input.communications ?? "",
    reason: input.reason ?? "",
  });
  const order = await loadOrder(input.context, parsed.orderId);
  if (!order) throw new Error("Order was not found.");
  const dispute = parsed.disputeId ? await loadDispute(input.context, parsed.disputeId) : null;
  const settings = parseShopSettings(input.context.shop);
  const policyText = policyTextFromSettings(settings);
  const proofCapture = parsed.proofCaptureId
    ? await prisma.proofCapture.findFirst({
        where: { id: parsed.proofCaptureId, shopId: input.context.shop.id },
        include: { files: true },
      })
    : await prisma.proofCapture.findFirst({
        where: {
          shopId: input.context.shop.id,
          shopifyOrderId: order.id,
          status: "SEALED",
        },
        orderBy: { updatedAt: "desc" },
        include: { files: true },
      });
  const proofFiles = proofCapture?.files ?? [];
  if (proofCapture) {
    assertProofCaptureMatchesOrder({
      proofCaptureId: proofCapture.id,
      proofOrderId: proofCapture.shopifyOrderId,
      requestedOrderId: order.id,
    });
  }
  const completeness = calculateEvidenceCompleteness({
    order,
    dispute,
    proofCapture,
    proofFiles,
    policyText,
    communications: parsed.communications,
  });
  const rebuttal = generateRebuttal({
    reason: parsed.reason || dispute?.reason || "unknown",
    order,
    proofSummary: {
      sealed: proofCapture?.status === "SEALED",
      imageCount: proofFiles.filter((file) => file.mimeType.startsWith("image/")).length,
    },
    policyText,
  });
  const rawSnapshot = {
    order,
    dispute,
    proofCapture,
    proofFiles,
    warnings: rebuttal.warnings,
    generatedAt: new Date().toISOString(),
    demoMode: input.context.demoMode,
  };
  const packId = `pack_${Date.now()}`;
  const pdfBytes = await generateEvidencePdf({
    packId,
    shopName: settings.storeDisplayName || input.context.shopDomain,
    order,
    dispute,
    proofFiles,
    auditEvents: await prisma.auditEvent.findMany({
      where: {
        shopId: input.context.shop.id,
        entityType: "ProofCapture",
        entityId: proofCapture?.id ?? "",
      },
      orderBy: { createdAt: "asc" },
    }),
    completeness,
    rebuttalText: rebuttal.text,
    policyText,
    communications: parsed.communications ?? "",
    rawSnapshot,
  });
  const storage = getStorageService();
  const storageResult = await storage.write({
    shopDomain: input.context.shopDomain,
    key: `evidence-packs/${packId}.pdf`,
    body: Buffer.from(pdfBytes),
    contentType: "application/pdf",
  });
  const pack = await prisma.evidencePack.create({
    data: {
      shopId: input.context.shop.id,
      shopifyOrderId: order.id,
      orderName: order.name,
      disputeId: dispute?.id ?? parsed.disputeId ?? null,
      proofCaptureId: proofCapture?.id ?? null,
      pdfStorageKey: storageResult.storageKey,
      rebuttalText: rebuttal.text,
      completenessScore: completeness.score,
      missingItems: normalizeJson(completeness.missingItems),
      rawSnapshot: normalizeJson(rawSnapshot),
    },
  });
  await createAuditEvent({
    shopId: input.context.shop.id,
    entityType: "EvidencePack",
    entityId: pack.id,
    action: "evidence.generated",
    metadata: { score: completeness.score, missingItems: completeness.missingItems },
  });
  await createNotification({
    shopId: input.context.shop.id,
    type: "evidence_pack_generated",
    title: `Evidence pack generated for ${order.name}`,
    body:
      completeness.score < 70
        ? "This evidence pack is incomplete. Add the missing items before submitting."
        : "Evidence pack generated and ready for merchant review.",
  });
  return { pack, order, dispute, proofCapture, proofFiles, completeness, rebuttal };
}

async function loadOrder(context: ShopContext, orderId: string): Promise<ShopifyOrder | null> {
  if (context.demoMode || !context.admin) return getDemoOrder(orderId);
  return new ShopifyGraphqlService(context.admin).getOrder(orderId);
}

async function loadDispute(context: ShopContext, disputeId: string): Promise<ShopifyDispute | null> {
  if (context.demoMode || !context.admin) return getDemoDispute(disputeId);
  return new ShopifyGraphqlService(context.admin).getDispute(disputeId);
}
