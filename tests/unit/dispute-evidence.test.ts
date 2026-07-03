import { describe, expect, it } from "vitest";
import deliveredOrder from "../../fixtures/shopify/order.physical-delivered.json";
import { mapDisputeEvidenceInput } from "../../app/services/dispute-evidence.server";

describe("mapDisputeEvidenceInput", () => {
  it("maps only safe Shopify dispute evidence fields", () => {
    const input = mapDisputeEvidenceInput({
      order: deliveredOrder,
      rebuttalText: "Merchant evidence summary.",
      settings: {
        refundPolicy: "Refunds require returned goods.",
        shippingPolicy: "Orders ship within two business days.",
      },
    });

    expect(input).toMatchObject({
      customerFirstName: "Jamie",
      customerLastName: "Rivera",
      customerEmailAddress: "jamie@example.com",
      uncategorizedText: "Merchant evidence summary.",
      refundPolicyDisclosure: "Refunds require returned goods.",
    });
    expect(Object.keys(input)).not.toContain("submitEvidence");
    expect(Object.keys(input)).not.toContain("amount");
  });
});
