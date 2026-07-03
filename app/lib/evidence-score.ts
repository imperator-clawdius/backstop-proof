import {
  getCustomerEmail,
  getCustomerName,
  getPrimaryTracking,
  hasDeliveryConfirmation,
  hasFulfillmentDetails,
} from "./format";
import type {
  ProofCaptureSummary,
  ProofFileSummary,
  ShopifyDispute,
  ShopifyOrder,
} from "./shopify-types";

export type CompletenessInput = {
  order: ShopifyOrder | null;
  dispute?: ShopifyDispute | null;
  proofCapture?: ProofCaptureSummary | null;
  proofFiles?: ProofFileSummary[];
  policyText?: string | null;
  communications?: string | null;
};

export type CompletenessResult = {
  score: number;
  missingItems: string[];
};

type Criterion = {
  label: string;
  present: boolean;
};

export function calculateEvidenceCompleteness(input: CompletenessInput): CompletenessResult {
  const order = input.order;
  const proofFiles = input.proofFiles ?? [];
  const imageCount = proofFiles.filter((file) => file.mimeType?.startsWith("image/")).length;
  const criteria: Criterion[] = [
    {
      label: "Order details",
      present: Boolean(order?.id && order.name && order.createdAt && order.totalPriceSet),
    },
    {
      label: "Customer details",
      present: Boolean(order && (getCustomerName(order) || getCustomerEmail(order))),
    },
    {
      label: "Fulfillment details",
      present: Boolean(order && hasFulfillmentDetails(order)),
    },
    {
      label: "Tracking number",
      present: Boolean(order && getPrimaryTracking(order)?.number),
    },
    {
      label: "Delivery confirmation",
      present: Boolean(order && hasDeliveryConfirmation(order)),
    },
    {
      label: "At least two proof images",
      present: imageCount >= 2,
    },
    {
      label: "Sealed proof capture",
      present: input.proofCapture?.status === "SEALED",
    },
    {
      label: "Merchant policy text",
      present: Boolean(input.policyText?.trim()),
    },
    {
      label: "Customer communications",
      present: Boolean(input.communications?.trim()),
    },
    {
      label: "Dispute reason",
      present: Boolean(input.dispute?.reason),
    },
  ];

  const presentCount = criteria.filter((criterion) => criterion.present).length;
  return {
    score: Math.round((presentCount / criteria.length) * 100),
    missingItems: criteria
      .filter((criterion) => !criterion.present)
      .map((criterion) => criterion.label),
  };
}
