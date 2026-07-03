import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import type * as React from "react";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { getShopContext } from "../services/shop-context.server";
import { listDemoDisputes } from "../services/demo-data.server";
import { ShopifyGraphqlService } from "../services/shopify-graphql.server";
import { listUnreadNotifications } from "../services/notifications.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const context = await getShopContext(request);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [openProofCaptures, ordersPackedToday, evidencePacks, notifications] =
    await Promise.all([
      prisma.proofCapture.count({
        where: { shopId: context.shop.id, status: "DRAFT" },
      }),
      prisma.proofCapture.count({
        where: { shopId: context.shop.id, status: "SEALED", sealedAt: { gte: today } },
      }),
      prisma.evidencePack.count({ where: { shopId: context.shop.id } }),
      listUnreadNotifications(context.shop.id),
    ]);

  let openDisputes = 0;
  let responseDueSoon = 0;
  let disputesUnavailable = false;
  try {
    const disputes =
      context.demoMode || !context.admin
        ? listDemoDisputes()
        : await new ShopifyGraphqlService(context.admin).listDisputes();
    const now = Date.now();
    const dueSoonMs = 1000 * 60 * 60 * 24 * 5;
    openDisputes = disputes.filter((dispute) =>
      ["NEEDS_RESPONSE", "UNDER_REVIEW"].includes(dispute.status ?? ""),
    ).length;
    responseDueSoon = disputes.filter((dispute) => {
      if (!dispute.evidenceDueBy) return false;
      const due = new Date(dispute.evidenceDueBy).getTime();
      return due >= now && due - now <= dueSoonMs;
    }).length;
  } catch {
    disputesUnavailable = true;
  }

  return {
    demoMode: context.demoMode,
    openProofCaptures,
    ordersPackedToday,
    evidencePacks,
    openDisputes,
    responseDueSoon,
    disputesUnavailable,
    notifications,
  };
};

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();
  return (
    <s-page heading="Backstop Proof">
      <s-section heading="Command center">
        {data.disputesUnavailable && (
          <Notice tone="warning">
            Dispute access is unavailable for this store or app install. You can
            still generate manual evidence packs from order data.
          </Notice>
        )}
        <div style={gridStyle}>
          <Metric label="Open proof captures" value={data.openProofCaptures} />
          <Metric label="Orders packed today" value={data.ordersPackedToday} />
          <Metric label="Evidence packs generated" value={data.evidencePacks} />
          <Metric label="Open disputes" value={data.openDisputes} />
          <Metric label="Responses due soon" value={data.responseDueSoon} />
        </div>
      </s-section>

      <s-section heading="Quick actions">
        <div style={actionGridStyle}>
          <Action href="/app/capture" title="Capture proof" body="Start or continue a packing proof capture." />
          <Action href="/app/orders" title="Find order" body="Search Shopify orders by name, email, or tracking." />
          <Action href="/app/evidence/new" title="Generate evidence pack" body="Create a PDF and rebuttal from order records." />
          <Action href="/app/disputes" title="View disputes" body="Review Shopify Payments disputes or demo disputes." />
          <Action href="/app/settings" title="Settings" body="Configure policies, retention, billing, and notifications." />
        </div>
      </s-section>

      <s-section heading="Notifications">
        {data.notifications.length === 0 ? (
          <s-paragraph>No unread notifications.</s-paragraph>
        ) : (
          <s-unordered-list>
            {data.notifications.map((notification) => (
              <s-list-item key={notification.id}>
                <strong>{notification.title}</strong> {notification.body}
              </s-list-item>
            ))}
          </s-unordered-list>
        )}
      </s-section>

      <s-section slot="aside" heading="MVP boundaries">
        <s-paragraph>
          Backstop Proof prepares merchant-reviewed evidence materials. It does
          not provide legal advice and does not guarantee dispute outcomes.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={metricStyle}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ color: "#4b5563" }}>{label}</div>
    </div>
  );
}

function Action({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link to={href} style={actionStyle}>
      <strong>{title}</strong>
      <span>{body}</span>
    </Link>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "warning" | "info" }) {
  return (
    <div
      style={{
        padding: 12,
        marginBottom: 16,
        border: "1px solid",
        borderColor: tone === "warning" ? "#d97706" : "#2563eb",
        background: tone === "warning" ? "#fffbeb" : "#eff6ff",
        borderRadius: 6,
      }}
    >
      {children}
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};

const metricStyle: React.CSSProperties = {
  border: "1px solid #d8dee4",
  borderRadius: 6,
  padding: 16,
  minHeight: 94,
  background: "#ffffff",
};

const actionGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const actionStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 14,
  border: "1px solid #d8dee4",
  borderRadius: 6,
  color: "#111827",
  textDecoration: "none",
  background: "#ffffff",
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
