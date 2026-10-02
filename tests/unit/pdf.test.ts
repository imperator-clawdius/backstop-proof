import { describe, expect, it, vi } from "vitest";
import { PDFPage } from "pdf-lib";
import deliveredOrder from "../../fixtures/shopify/order.physical-delivered.json";
import dispute from "../../fixtures/shopify/dispute.item-not-received.json";
import { generateEvidencePdf } from "../../app/services/pdf.server";

describe("generateEvidencePdf", () => {
  it("does not label a failed authorization as captured payment", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      await generateEvidencePdf({
        packId: "pack_test", shopName: "Test Store",
        order: { ...deliveredOrder, displayFinancialStatus: "PENDING", displayFulfillmentStatus: "UNFULFILLED", fulfillments: [],
          transactions: [{ kind: "AUTHORIZATION", status: "FAILURE", processedAt: "2026-07-01T01:02:03Z" }] },
        proofFiles: [], auditEvents: [], completeness: { score: 0, missingItems: [] },
        rebuttalText: "Review the available records.", policyText: "", communications: "", rawSnapshot: {},
      });
      const text = drawn.mock.calls.map(([value]) => value).join("\n");
      expect(text).not.toMatch(/paid or recorded|fulfilled to the customer/);
      expect(text).not.toContain("2026-07-01 01:02:03 UTC");
    } finally { drawn.mockRestore(); }
  });

  it("renders a successful capture after refund and failed-capture records", async () => {
    const drawn = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      await generateEvidencePdf({
        packId: "pack_test", shopName: "Test Store",
        order: { ...deliveredOrder, transactions: [
          { kind: "REFUND", status: "SUCCESS", processedAt: "2026-07-01T01:02:03Z" },
          { kind: "CAPTURE", status: "FAILURE", processedAt: "2026-07-01T02:03:04Z" },
          { kind: "CAPTURE", status: "SUCCESS", processedAt: "2026-07-01T03:04:05Z" },
        ] },
        proofFiles: [], auditEvents: [], completeness: { score: 0, missingItems: [] },
        rebuttalText: "Review the available records.", policyText: "", communications: "", rawSnapshot: {},
      });
      const text = drawn.mock.calls.map(([value]) => value).join("\n");
      expect(text).toContain("2026-07-01 03:04:05 UTC");
      expect(text).not.toContain("2026-07-01 01:02:03 UTC");
      expect(text).not.toContain("2026-07-01 02:03:04 UTC");
    } finally { drawn.mockRestore(); }
  });

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
