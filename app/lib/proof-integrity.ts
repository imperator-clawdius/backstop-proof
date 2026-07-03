export function assertProofCaptureEditable(status: string | null | undefined) {
  if (status === "SEALED") {
    throw new Error("Sealed proof captures cannot be edited. Add a correction audit event instead.");
  }
}

export function assertProofCaptureMatchesOrder(input: {
  proofCaptureId: string;
  proofOrderId: string | null | undefined;
  requestedOrderId: string;
}) {
  if (input.proofOrderId !== input.requestedOrderId) {
    throw new Error("Proof capture does not belong to this order.");
  }
}
