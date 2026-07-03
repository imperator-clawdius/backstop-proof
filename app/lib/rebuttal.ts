import {
  formatAddress,
  formatDateTime,
  formatMoney,
  getPrimaryTracking,
} from "./format";
import type { ProofSummary, ShopifyOrder } from "./shopify-types";

export type DisputeReason =
  | "fraudulent"
  | "product_not_received"
  | "product_unacceptable"
  | "credit_not_processed"
  | "duplicate"
  | "subscription_canceled"
  | "general"
  | "unknown"
  | string;

export type RebuttalInput = {
  reason?: DisputeReason | null;
  order: ShopifyOrder;
  proofSummary: ProofSummary;
  policyText?: string | null;
};

export type RebuttalResult = {
  text: string;
  warnings: string[];
};

export function normalizeReason(reason?: string | null): DisputeReason {
  const normalized = (reason ?? "unknown").toLowerCase();
  if (normalized === "product_not_received" || normalized === "product not received") {
    return "product_not_received";
  }
  if (normalized === "fraudulent") return "fraudulent";
  if (normalized === "product_unacceptable") return "product_unacceptable";
  if (normalized === "credit_not_processed") return "credit_not_processed";
  if (normalized === "duplicate") return "duplicate";
  if (normalized === "subscription_canceled") return "subscription_canceled";
  return normalized || "unknown";
}

export function generateRebuttal(input: RebuttalInput): RebuttalResult {
  const reason = normalizeReason(input.reason);
  const order = input.order;
  const tracking = getPrimaryTracking(order);
  const warnings: string[] = [];
  const facts = [
    `order ${order.name}`,
    `created on ${formatDateTime(order.createdAt)}`,
    `for ${formatMoney(order)}`,
  ];

  if (order.shippingAddress) {
    facts.push(`shipping address:\n${formatAddress(order.shippingAddress)}`);
  } else {
    warnings.push("Shipping address is missing.");
  }

  if (tracking?.number) {
    facts.push(
      `shipped via ${tracking.company ?? "carrier not available"} using tracking number ${tracking.number}`,
    );
  } else {
    warnings.push("Tracking number is missing.");
  }

  if (input.proofSummary.sealed && input.proofSummary.imageCount > 0) {
    facts.push(
      `supported by timestamped packing proof with ${input.proofSummary.imageCount} image file(s)`,
    );
  } else {
    warnings.push("Sealed packing proof is missing.");
  }

  if (!input.policyText?.trim()) {
    warnings.push("Merchant policy text is missing.");
  }

  const reasonSentence = reasonIntro(reason);
  const trackingSentence = tracking?.number
    ? `The package was shipped via ${tracking.company ?? "the carrier"} using tracking number ${tracking.number}.`
    : "The available Shopify order data does not include a tracking number.";
  const proofSentence =
    input.proofSummary.sealed && input.proofSummary.imageCount > 0
      ? "The attached evidence includes timestamped packing proof captured before shipment."
      : "The merchant has not attached sealed packing proof for this order.";

  return {
    text: [
      "To whom it may concern: We respectfully contest this dispute.",
      reasonSentence,
      `The evidence package shows that ${facts.join(", ")}.`,
      trackingSentence,
      proofSentence,
      "The merchant asks that the issuer or card network review the attached evidence and reverse the dispute when appropriate.",
    ].join("\n\n"),
    warnings,
  };
}

function reasonIntro(reason: DisputeReason): string {
  switch (reason) {
    case "fraudulent":
      return "The merchant's position is that the order records and fulfillment evidence support that the transaction was fulfilled as ordered.";
    case "product_not_received":
      return "The merchant's position is that the order was placed, paid successfully, fulfilled to the customer-provided shipping address, and supported by the available fulfillment records.";
    case "product_unacceptable":
      return "The merchant's position is that the purchased items and fulfillment records should be reviewed alongside any merchant policy and customer communication included in this pack.";
    case "credit_not_processed":
      return "The merchant's position is that refund and order records should be reviewed before determining whether a credit was owed or already handled.";
    case "duplicate":
      return "The merchant's position is that the order and transaction records should be reviewed to determine whether the disputed charge was a duplicate.";
    case "subscription_canceled":
      return "The merchant's position is that subscription, cancellation, fulfillment, and policy records should be reviewed before determining the dispute.";
    default:
      return "The merchant's position is based on the order, fulfillment, policy, communication, and proof records included in this evidence pack.";
  }
}
