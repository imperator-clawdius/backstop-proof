import { formatAddress, getCustomerEmail } from "../lib/format";
import type { ShopifyOrder } from "../lib/shopify-types";

export type EvidenceSettings = {
  refundPolicy?: string;
  shippingPolicy?: string;
  defaultPolicyText?: string;
};

export type ShopifyDisputeEvidenceInput = {
  customerFirstName?: string;
  customerLastName?: string;
  customerEmailAddress?: string;
  shippingAddress?: string;
  uncategorizedText?: string;
  accessActivityLog?: string;
  cancellationPolicyDisclosure?: string;
  cancellationRebuttal?: string;
  refundPolicyDisclosure?: string;
  refundRefusalExplanation?: string;
};

export function mapDisputeEvidenceInput({
  order,
  rebuttalText,
  settings,
}: {
  order: ShopifyOrder;
  rebuttalText: string;
  settings: EvidenceSettings;
}): ShopifyDisputeEvidenceInput {
  return compactObject({
    customerFirstName: order.customer?.firstName ?? undefined,
    customerLastName: order.customer?.lastName ?? undefined,
    customerEmailAddress: getCustomerEmail(order) || undefined,
    shippingAddress: order.shippingAddress ? formatAddress(order.shippingAddress) : undefined,
    uncategorizedText: rebuttalText,
    accessActivityLog: "Backstop Proof evidence pack generated from merchant-reviewed order, fulfillment, proof, and audit records.",
    cancellationPolicyDisclosure: settings.defaultPolicyText || undefined,
    cancellationRebuttal: undefined,
    refundPolicyDisclosure: settings.refundPolicy || undefined,
    refundRefusalExplanation: settings.shippingPolicy || undefined,
  });
}

function compactObject<T extends Record<string, string | undefined>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== ""),
  ) as T;
}
