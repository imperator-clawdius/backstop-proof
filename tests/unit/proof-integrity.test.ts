import { describe, expect, it } from "vitest";
import {
  assertProofCaptureEditable,
  assertProofCaptureMatchesOrder,
} from "../../app/lib/proof-integrity";

describe("proof integrity guards", () => {
  it("blocks destructive edits to sealed proof captures", () => {
    expect(() => assertProofCaptureEditable("SEALED")).toThrow(
      "Sealed proof captures cannot be edited.",
    );
  });

  it("allows draft proof captures to receive uploaded files", () => {
    expect(() => assertProofCaptureEditable("DRAFT")).not.toThrow();
  });

  it("blocks attaching proof captures to a different order", () => {
    expect(() =>
      assertProofCaptureMatchesOrder({
        proofCaptureId: "proof_1",
        proofOrderId: "gid://shopify/Order/1",
        requestedOrderId: "gid://shopify/Order/2",
      }),
    ).toThrow("Proof capture does not belong to this order.");
  });
});
