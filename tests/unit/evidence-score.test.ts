import { describe, expect, it } from "vitest";
import deliveredOrder from "../../fixtures/shopify/order.physical-delivered.json";
import missingTrackingOrder from "../../fixtures/shopify/order.missing-tracking.json";
import dispute from "../../fixtures/shopify/dispute.item-not-received.json";
import { calculateEvidenceCompleteness } from "../../app/lib/evidence-score";

describe("calculateEvidenceCompleteness", () => {
  it("scores a complete delivered order with sealed proof at 100", () => {
    const result = calculateEvidenceCompleteness({
      order: deliveredOrder,
      dispute,
      proofCapture: { status: "SEALED", sealedAt: "2026-07-03T12:35:00Z" },
      proofFiles: [
        { mimeType: "image/png" },
        { mimeType: "image/jpeg" },
        { mimeType: "application/pdf" },
      ],
      policyText: "Refunds must be requested within 30 days.",
      communications: "Customer confirmed the shipping address by email.",
    });

    expect(result.score).toBe(100);
    expect(result.missingItems).toEqual([]);
  });

  it("flags missing tracking, delivery, proof, policies, communications, and dispute reason", () => {
    const result = calculateEvidenceCompleteness({
      order: missingTrackingOrder,
      proofCapture: null,
      proofFiles: [],
      policyText: "",
      communications: "",
      dispute: null,
    });

    expect(result.score).toBeLessThan(70);
    expect(result.missingItems).toEqual(
      expect.arrayContaining([
        "Tracking number",
        "Delivery confirmation",
        "At least two proof images",
        "Sealed proof capture",
        "Merchant policy text",
        "Customer communications",
        "Dispute reason",
      ]),
    );
  });
});
