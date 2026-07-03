import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import type * as React from "react";
import { Form, Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { formatDateTime, formatMoney, getCustomerEmail, getCustomerName, getPrimaryTracking } from "../lib/format";
import { listDemoOrders } from "../services/demo-data.server";
import { getShopContext } from "../services/shop-context.server";
import { ShopifyGraphqlService } from "../services/shopify-graphql.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const context = await getShopContext(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const orders =
    context.demoMode || !context.admin
      ? listDemoOrders(query)
      : query
        ? await new ShopifyGraphqlService(context.admin).searchOrders(query)
        : await new ShopifyGraphqlService(context.admin).listRecentOrders();

  const cards = await Promise.all(
    orders.map(async (order) => {
      const [sealed, draft, evidence] = await Promise.all([
        prisma.proofCapture.count({
          where: { shopId: context.shop.id, shopifyOrderId: order.id, status: "SEALED" },
        }),
        prisma.proofCapture.count({
          where: { shopId: context.shop.id, shopifyOrderId: order.id, status: "DRAFT" },
        }),
        prisma.evidencePack.count({
          where: { shopId: context.shop.id, shopifyOrderId: order.id },
        }),
      ]);
      return {
        order,
        proofStatus: sealed > 0 ? "sealed" : draft > 0 ? "partial" : "none",
        evidenceStatus: evidence > 0 ? "generated" : "none",
      };
    }),
  );

  return { query, cards, demoMode: context.demoMode };
};

export default function Orders() {
  const { query, cards } = useLoaderData<typeof loader>();
  return (
    <s-page heading="Orders">
      <s-section heading="Find an order">
        <Form method="get" style={{ display: "flex", gap: 8, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, flex: 1 }}>
            <span>Order name, email, or tracking number</span>
            <input name="q" defaultValue={query} placeholder="#1042 or customer@example.com" style={inputStyle} />
          </label>
          <button type="submit" style={buttonStyle}>Search</button>
        </Form>
      </s-section>

      <s-section heading={query ? "Search results" : "Recent orders"}>
        {cards.length === 0 ? (
          <s-paragraph>No matching orders found.</s-paragraph>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {cards.map(({ order, proofStatus, evidenceStatus }) => {
              const tracking = getPrimaryTracking(order);
              return (
                <Link key={order.id} to={`/app/orders/${encodeURIComponent(order.id)}`} style={cardStyle}>
                  <div>
                    <strong>{order.name}</strong>
                    <div style={mutedStyle}>{formatDateTime(order.createdAt)}</div>
                  </div>
                  <div>
                    <div>{getCustomerName(order) || getCustomerEmail(order) || "No customer"}</div>
                    <div style={mutedStyle}>{formatMoney(order)}</div>
                  </div>
                  <div>
                    <div>{order.displayFulfillmentStatus ?? "Unknown fulfillment"}</div>
                    <div style={mutedStyle}>
                      {tracking?.company || "No carrier"} {tracking?.number ?? ""}
                    </div>
                  </div>
                  <div>
                    <div>Proof: {proofStatus}</div>
                    <div style={mutedStyle}>Evidence: {evidenceStatus}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </s-section>
    </s-page>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid #c9d1d9",
  borderRadius: 6,
  padding: "9px 10px",
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid #1f6feb",
  background: "#1f6feb",
  color: "#fff",
  borderRadius: 6,
  padding: "10px 14px",
};

const cardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1.4fr 1.4fr 1fr",
  gap: 12,
  padding: 14,
  border: "1px solid #d8dee4",
  borderRadius: 6,
  textDecoration: "none",
  color: "#111827",
  background: "#fff",
};

const mutedStyle: React.CSSProperties = { color: "#57606a", fontSize: 13 };

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
