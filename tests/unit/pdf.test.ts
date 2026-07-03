import { describe, expect, it } from "vitest";
import deliveredOrder from "../../fixtures/shopify/order.physical-delivered.json";
import dispute from "../../fixtures/shopify/dispute.item-not-received.json";
import { generateEvidencePdf } from "../../app/services/pdf.server";

describe("generateEvidencePdf", () => {
  it("returns a non-empty PDF document", async () => {
    const pdf = await generateEvidencePdf({
      packId: "pack_test",
      shopName: "Backstop Demo Store",
      order: deliveredOrder,
      dispute,
      proofFiles: [],
      auditEvents: [],
      completeness: { score: 80, missingItems: ["Policy text"] },
      rebuttalText: "To whom it may concern: We respectfully contest this dispute.",
      policyText: "",
      communications: "",
      rawSnapshot: { order: deliveredOrder, dispute },
    });

    expect(pdf.length).toBeGreaterThan(1000);
    expect(Buffer.from(pdf.subarray(0, 4)).toString("utf8")).toBe("%PDF");
  });
});
