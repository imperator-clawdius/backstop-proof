import type { Address, ShopifyOrder } from "./shopify-types";

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "Not available";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

export function formatMoney(order: ShopifyOrder): string {
  const amount =
    order.totalPriceSet?.shopMoney?.amount ??
    order.totalReceivedSet?.shopMoney?.amount ??
    null;
  const currency =
    order.totalPriceSet?.shopMoney?.currencyCode ??
    order.totalReceivedSet?.shopMoney?.currencyCode ??
    order.currencyCode ??
    "";
  return amount ? `${currency} ${amount}`.trim() : "Not available";
}

export function formatAddress(address?: Address | null): string {
  if (!address) return "Not available";
  const cityLine = [address.city, address.provinceCode ?? address.province, address.zip]
    .filter(Boolean)
    .join(", ");
  return [
    address.name,
    address.address1,
    address.address2,
    cityLine,
    address.countryCodeV2 ?? address.country,
  ]
    .filter(Boolean)
    .join("\n");
}

export function getCustomerName(order: ShopifyOrder): string {
  return [order.customer?.firstName, order.customer?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function getCustomerEmail(order: ShopifyOrder): string {
  return order.customer?.email ?? order.email ?? "";
}

export function getPrimaryTracking(order: ShopifyOrder) {
  for (const fulfillment of order.fulfillments ?? []) {
    const tracking = fulfillment.trackingInfo?.find((item) => item.number);
    if (tracking) return tracking;
  }
  return null;
}

export function hasDeliveryConfirmation(order: ShopifyOrder): boolean {
  return Boolean(
    order.fulfillments?.some(
      (fulfillment) =>
        fulfillment.deliveredAt ||
        fulfillment.status?.toUpperCase() === "DELIVERED",
    ),
  );
}

export function hasFulfillmentDetails(order: ShopifyOrder): boolean {
  return Boolean(
    order.displayFulfillmentStatus ||
      order.fulfillments?.some((fulfillment) => fulfillment.createdAt || fulfillment.status),
  );
}
