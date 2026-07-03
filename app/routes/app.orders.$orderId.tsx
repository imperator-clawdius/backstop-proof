import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import type * as React from "react";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import {
  formatAddress,
  formatDateTime,
  formatMoney,
  getCustomerEmail,
  getCustomerName,
  getPrimaryTracking,
} from "../lib/format";
import { getDemoOrder } from "../services/demo-data.server";
import { getShopContext } from "../services/shop-context.server";
import { ShopifyGraphqlService } from "../services/shopify-graphql.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const context = await getShopContext(request);
  const orderId = params.orderId ? decodeURIComponent(params.orderId) : "";
  const order =
    context.demoMode || !context.admin
      ? getDemoOrder(orderId)
      : await new ShopifyGraphqlService(context.admin).getOrder(orderId);
  if (!order) throw new Response("Order not found", { status: 404 });
  const [proofCaptures, evidencePacks] = await Promise.all([
    prisma.proofCapture.findMany({
      where: { shopId: context.shop.id, shopifyOrderId: order.id },
      orderBy: { updatedAt: "desc" },
      include: { files: true },
    }),
    prisma.evidencePack.findMany({
      where: { shopId: context.shop.id, shopifyOrderId: order.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { order, proofCaptures, evidencePacks };
};

export default function OrderDetail() {
  const { order, proofCaptures, evidencePacks } = useLoaderData<typeof loader>();
  const tracking = getPrimaryTracking(order);
  return (
    <s-page heading={`Order ${order.name}`}>
      <div slot="primary-action" style={{ display: "flex", gap: 8 }}>
        <Link to={`/app/capture?orderId=${encodeURIComponent(order.id)}`} style={buttonStyle}>Start packing proof</Link>
        <Link to={`/app/evidence/new?orderId=${encodeURIComponent(order.id)}`} style={buttonStyle}>Generate evidence pack</Link>
        {evidencePacks[0] && (
          <a href={`/api/evidence/${evidencePacks[0].id}/download`} style={buttonStyle}>Download latest PDF</a>
        )}
      </div>

      <s-section heading="Order summary">
        <Fact label="Created" value={formatDateTime(order.createdAt)} />
        <Fact label="Total" value={formatMoney(order)} />
        <Fact label="Financial status" value={order.displayFinancialStatus ?? "Not available"} />
        <Fact label="Fulfillment status" value={order.displayFulfillmentStatus ?? "Not available"} />
        <Fact label="Customer" value={getCustomerName(order) || "Not available"} />
        <Fact label="Customer email" value={getCustomerEmail(order) || "Not available"} />
      </s-section>

      <s-section heading="Addresses">
        <Fact label="Shipping" value={formatAddress(order.shippingAddress)} pre />
        <Fact label="Billing" value={formatAddress(order.billingAddress)} pre />
      </s-section>

      <s-section heading="Line items">
        {(order.lineItems?.nodes ?? []).map((item, index) => (
          <Fact
            key={`${item.sku}-${index}`}
            label={`${item.quantity ?? 0} x ${item.title ?? "Untitled"}`}
            value={`${item.variantTitle ?? "Default"}${item.sku ? ` | SKU ${item.sku}` : ""}`}
          />
        ))}
      </s-section>

      <s-section heading="Fulfillment and tracking">
        <Fact label="Carrier" value={tracking?.company ?? "Not available from Shopify data"} />
        <Fact label="Tracking" value={tracking?.number ?? "Not available from Shopify data"} />
        <Fact label="Tracking URL" value={tracking?.url ?? "Not available from Shopify data"} />
        {(order.fulfillments ?? []).map((fulfillment, index) => (
          <Fact
            key={index}
            label={`Fulfillment ${index + 1}`}
            value={`${fulfillment.status ?? "Unknown"} | Created ${formatDateTime(fulfillment.createdAt)} | Delivered ${formatDateTime(fulfillment.deliveredAt)}`}
          />
        ))}
      </s-section>

      <s-section heading="Proof captures">
        {proofCaptures.length === 0 ? (
          <s-paragraph>No proof captured for this order.</s-paragraph>
        ) : (
          proofCaptures.map((proof) => (
            <Fact
              key={proof.id}
              label={proof.status}
              value={`${proof.files.length} file(s), sealed ${formatDateTime(proof.sealedAt)} | ${proof.notes ?? ""}`}
            />
          ))
        )}
      </s-section>

      <s-section heading="Evidence packs">
        {evidencePacks.length === 0 ? (
          <s-paragraph>No evidence packs generated yet.</s-paragraph>
        ) : (
          evidencePacks.map((pack) => (
            <Fact
              key={pack.id}
              label={`${pack.completenessScore}/100`}
              value={`${pack.status} | ${formatDateTime(pack.createdAt)} | ${pack.rebuttalText.slice(0, 120)}...`}
            />
          ))
        )}
      </s-section>
    </s-page>
  );
}

function Fact({ label, value, pre }: { label: string; value: string; pre?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, padding: "8px 0", borderBottom: "1px solid #eef0f2" }}>
      <strong>{label}</strong>
      {pre ? <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{value}</pre> : <span>{value}</span>}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid #1f6feb",
  background: "#1f6feb",
  color: "#fff",
  borderRadius: 6,
  padding: "9px 12px",
  textDecoration: "none",
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
