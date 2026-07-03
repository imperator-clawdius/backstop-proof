import deliveredOrder from "../../fixtures/shopify/order.physical-delivered.json";
import missingTrackingOrder from "../../fixtures/shopify/order.missing-tracking.json";
import itemNotReceivedDispute from "../../fixtures/shopify/dispute.item-not-received.json";
import fraudulentDispute from "../../fixtures/shopify/dispute.fraudulent.json";
import type { ShopifyDispute, ShopifyOrder } from "../lib/shopify-types";

const demoOrders = [deliveredOrder, missingTrackingOrder] as ShopifyOrder[];
const demoDisputes = [itemNotReceivedDispute, fraudulentDispute] as ShopifyDispute[];

export function listDemoOrders(query?: string | null): ShopifyOrder[] {
  const needle = query?.trim().toLowerCase();
  if (!needle) return demoOrders;
  return demoOrders.filter((order) => {
    const tracking = order.fulfillments?.flatMap((fulfillment) => fulfillment.trackingInfo ?? []) ?? [];
    return [
      order.name,
      order.id,
      order.email,
      order.customer?.email,
      ...tracking.map((item) => item.number),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });
}

export function getDemoOrder(orderId: string): ShopifyOrder | null {
  const decoded = decodeURIComponent(orderId);
  return (
    demoOrders.find(
      (order) => order.id === decoded || order.name === decoded || order.id.endsWith(`/${decoded}`),
    ) ?? null
  );
}

export function listDemoDisputes(): ShopifyDispute[] {
  return demoDisputes;
}

export function getDemoDispute(disputeId: string): ShopifyDispute | null {
  const decoded = decodeURIComponent(disputeId);
  return (
    demoDisputes.find(
      (dispute) =>
        dispute.id === decoded ||
        dispute.legacyResourceId === decoded ||
        dispute.id.endsWith(`/${decoded}`),
    ) ?? null
  );
}
