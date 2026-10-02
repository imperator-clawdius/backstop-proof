import { describe, expect, it } from "vitest";
import missingTrackingOrder from "../../fixtures/shopify/order.missing-tracking.json";
import deliveredOrder from "../../fixtures/shopify/order.physical-delivered.json";
import { generateRebuttal } from "../../app/lib/rebuttal";

describe("generateRebuttal", () => {
  it("does not infer payment, shipment or pre-shipment capture from incomplete records", () => {
    const result = generateRebuttal({
      reason: "product_not_received",
      order: { ...missingTrackingOrder, displayFinancialStatus: "PENDING", displayFulfillmentStatus: "UNFULFILLED", fulfillments: [], transactions: [] },
      proofSummary: { sealed: true, imageCount: 2 },
      policyText: "",
    });
    expect(result.text).not.toMatch(/paid successfully|fulfilled to|captured before shipment/i);
  });

  it("describes an assigned tracking number without asserting that a package shipped", () => {
    const result = generateRebuttal({
      reason: "fraudulent", order: deliveredOrder,
      proofSummary: { sealed: false, imageCount: 0 }, policyText: "",
    });
    expect(result.text).toContain("1Z999AA10123456784");
    expect(result.text).not.toMatch(/was shipped|shipped via|was fulfilled as ordered/i);
  });

  it("does not hallucinate tracking when tracking is missing", () => {
    const result = generateRebuttal({
      reason: "product_not_received",
      order: missingTrackingOrder,
      proofSummary: { sealed: false, imageCount: 0 },
      policyText: "",
    });

    expect(result.text).not.toContain("using tracking number");
    expect(result.warnings).toContain("Tracking number is missing.");
    expect(result.text).toContain("The available Shopify order data does not include a tracking number.");
  });

  it("does not claim delivery when Shopify delivery data is absent", () => {
    const result = generateRebuttal({
      reason: "product_not_received",
      order: missingTrackingOrder,
      proofSummary: { sealed: true, imageCount: 2 },
      policyText: "Shipping policy was available.",
    });

    expect(result.text.toLowerCase()).not.toContain("delivered");
    expect(result.text.toLowerCase()).not.toContain("delivery confirmation");
  });

  it("uses present fulfillment and proof facts for item-not-received disputes", () => {
    const result = generateRebuttal({
      reason: "product_not_received",
      order: deliveredOrder,
      proofSummary: { sealed: true, imageCount: 3 },
      policyText: "Shipping policy was shown at checkout.",
    });

    expect(result.text).toContain("order #1042");
    expect(result.text).toContain("UPS");
    expect(result.text).toContain("1Z999AA10123456784");
    expect(result.text).toContain("timestamped packing proof");
    expect(result.warnings).toEqual([]);
  });
});
