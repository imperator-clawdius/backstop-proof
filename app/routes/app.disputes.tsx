import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import type * as React from "react";
import { Form, Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { formatDateTime } from "../lib/format";
import type { ShopifyDispute } from "../lib/shopify-types";
import { listDemoDisputes } from "../services/demo-data.server";
import { getShopContext } from "../services/shop-context.server";
import { ShopifyGraphqlService } from "../services/shopify-graphql.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const context = await getShopContext(request);
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") ?? "needs_response";
  try {
    const disputes =
      context.demoMode || !context.admin
        ? listDemoDisputes()
        : await new ShopifyGraphqlService(context.admin).listDisputes();
    return {
      disputes: disputes.filter((dispute) => matchesFilter(dispute, filter)),
      filter,
      unavailable: false,
      demoMode: context.demoMode,
      demoDisputeMode: false,
      error: "",
    };
  } catch (error) {
    const demoDisputeMode = process.env.ENABLE_DEMO_MODE === "true";
    return {
      disputes: demoDisputeMode
        ? listDemoDisputes().filter((dispute) => matchesFilter(dispute, filter))
        : [],
      filter,
      unavailable: true,
      demoMode: context.demoMode,
      demoDisputeMode,
      error: error instanceof Error ? error.message : "Dispute access unavailable.",
    };
  }
};

export default function Disputes() {
  const { disputes, filter, unavailable, error, demoDisputeMode } = useLoaderData<typeof loader>();
  return (
    <s-page heading="Disputes">
      {unavailable && (
        <Notice tone="warning">
          Dispute access is unavailable for this store or app install. You can
          still generate manual evidence packs from order data.
          {demoDisputeMode ? " Demo dispute mode is shown below." : ""} {error}
        </Notice>
      )}
      <s-section heading="Filters">
        <Form method="get" style={{ display: "flex", gap: 8 }}>
          <select name="filter" defaultValue={filter} style={inputStyle}>
            <option value="needs_response">Needs response</option>
            <option value="due_soon">Due soon</option>
            <option value="under_review">Under review</option>
            <option value="closed">Won/lost/closed</option>
            <option value="all">All</option>
          </select>
          <button type="submit" style={buttonStyle}>Apply</button>
        </Form>
      </s-section>
      <s-section heading="Dispute queue">
        {disputes.length === 0 ? (
          <s-paragraph>No disputes in this filter.</s-paragraph>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {disputes.map((dispute) => (
              <Link
                key={dispute.id}
                to={`/app/disputes/${encodeURIComponent(dispute.id)}${demoDisputeMode ? "?demoDispute=true" : ""}`}
                style={cardStyle}
              >
                <strong>{dispute.legacyResourceId ?? dispute.id}</strong>
                <span>{dispute.order?.name ?? "No order"}</span>
                <span>{dispute.amount?.currencyCode} {dispute.amount?.amount}</span>
                <span>{dispute.reason}</span>
                <span>{dispute.status}</span>
                <span>Due {formatDateTime(dispute.evidenceDueBy)}</span>
              </Link>
            ))}
          </div>
        )}
      </s-section>
    </s-page>
  );
}

function matchesFilter(dispute: ShopifyDispute, filter: string): boolean {
  const status = dispute.status ?? "";
  if (filter === "all") return true;
  if (filter === "needs_response") return status === "NEEDS_RESPONSE";
  if (filter === "under_review") return status === "UNDER_REVIEW";
  if (filter === "closed") return ["WON", "LOST", "CLOSED", "ACCEPTED"].includes(status);
  if (filter === "due_soon") {
    if (status !== "NEEDS_RESPONSE" || !dispute.evidenceDueBy) return false;
    const due = new Date(dispute.evidenceDueBy).getTime();
    const now = Date.now();
    return due >= now && due - now <= 1000 * 60 * 60 * 24 * 5;
  }
  return true;
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "warning" | "info" }) {
  return <div style={{ padding: 12, margin: "12px 0", border: "1px solid", borderColor: tone === "warning" ? "#d97706" : "#2563eb", background: tone === "warning" ? "#fffbeb" : "#eff6ff", borderRadius: 6 }}>{children}</div>;
}

const inputStyle: React.CSSProperties = { border: "1px solid #c9d1d9", borderRadius: 6, padding: "9px 10px" };
const buttonStyle: React.CSSProperties = { border: "1px solid #1f6feb", background: "#1f6feb", color: "#fff", borderRadius: 6, padding: "10px 14px" };
const cardStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1.4fr", gap: 10, border: "1px solid #d8dee4", borderRadius: 6, padding: 12, background: "#fff", textDecoration: "none", color: "#111827" };

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
