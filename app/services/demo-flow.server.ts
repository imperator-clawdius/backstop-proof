import deliveredOrder from "../../fixtures/shopify/order.physical-delivered.json";
import dispute from "../../fixtures/shopify/dispute.item-not-received.json";
import { sha256Hex } from "../lib/crypto.server";
import { calculateEvidenceCompleteness } from "../lib/evidence-score";
import { generateRebuttal } from "../lib/rebuttal";
import type { ProofFileSummary } from "../lib/shopify-types";
import { generateEvidencePdf } from "./pdf.server";
import { LocalStorageService } from "./storage.server";

export async function runDemoEvidenceFlow({ storageRoot }: { storageRoot: string }) {
  const storage = new LocalStorageService(storageRoot);
  const proofCapture = {
    id: "demo-proof-1",
    status: "SEALED",
    sealedAt: "2026-07-03T12:35:00Z",
    staffLabel: "JR",
    stationLabel: "Demo station",
  };
  const proofFiles: ProofFileSummary[] = [];

  for (const stage of ["products-laid-out", "inside-box", "sealed-label"]) {
    const body = Buffer.from(demoSvg(stage));
    const storageResult = await storage.write({
      shopDomain: "demo.backstop-proof.local",
      key: `proof/${stage}.svg`,
      body,
      contentType: "image/svg+xml",
    });
    proofFiles.push({
      id: storageResult.storageKey,
      originalFilename: `${stage}.svg`,
      mimeType: "image/svg+xml",
      byteSize: body.byteLength,
      sha256: await sha256Hex(body),
      capturedAt: "2026-07-03T12:30:00Z",
    });
  }

  const policyText = "Demo refund and shipping policies are configured for evidence pack generation.";
  const communications = "Demo communication: customer confirmed the delivery address before fulfillment.";
  const completeness = calculateEvidenceCompleteness({
    order: deliveredOrder,
    dispute,
    proofCapture,
    proofFiles,
    policyText,
    communications,
  });
  const rebuttal = generateRebuttal({
    reason: dispute.reason,
    order: deliveredOrder,
    proofSummary: { sealed: true, imageCount: 3 },
    policyText,
  });
  const pdfBytes = await generateEvidencePdf({
    packId: "demo-pack-1",
    shopName: "Backstop Demo Store",
    order: deliveredOrder,
    dispute,
    proofFiles,
    auditEvents: [
      { action: "proof.uploaded", actorType: "SYSTEM", createdAt: "2026-07-03T12:30:00Z" },
      { action: "proof.sealed", actorType: "MERCHANT", actorLabel: "JR", createdAt: "2026-07-03T12:35:00Z" },
    ],
    completeness,
    rebuttalText: rebuttal.text,
    policyText,
    communications,
    rawSnapshot: { order: deliveredOrder, dispute, proofFiles },
  });

  return {
    demoMode: true,
    proofCapture,
    proofFiles,
    evidencePack: {
      id: "demo-pack-1",
      completenessScore: completeness.score,
      missingItems: completeness.missingItems,
    },
    pdfBytes,
  };
}

function demoSvg(label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#f4f6f8"/>
  <rect x="44" y="42" width="552" height="276" rx="8" fill="#ffffff" stroke="#9aa4af"/>
  <text x="72" y="120" font-family="Arial" font-size="32" fill="#16202a">Backstop Proof Demo</text>
  <text x="72" y="174" font-family="Arial" font-size="24" fill="#3f4a55">${label}</text>
  <text x="72" y="230" font-family="Arial" font-size="18" fill="#64707d">Tamper-evident placeholder proof asset</text>
</svg>`;
}
