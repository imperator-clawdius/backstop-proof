import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import type * as React from "react";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { formatDateTime } from "../lib/format";
import { getShopContext } from "../services/shop-context.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const context = await getShopContext(request);
  const pack = await prisma.evidencePack.findFirst({
    where: { id: params.evidencePackId ?? "", shopId: context.shop.id },
  });
  if (!pack) throw new Response("Evidence pack not found", { status: 404 });
  const proofCapture = pack.proofCaptureId
    ? await prisma.proofCapture.findFirst({
        where: { id: pack.proofCaptureId, shopId: context.shop.id },
        include: { files: true },
      })
    : null;
  return { pack, proofCapture };
};

export default function EvidenceDetail() {
  const { pack, proofCapture } = useLoaderData<typeof loader>();
  const missingItems = Array.isArray(pack.missingItems) ? pack.missingItems : [];
  return (
    <s-page heading={`Evidence pack ${pack.orderName}`}>
      <div slot="primary-action" style={{ display: "flex", gap: 8 }}>
        <a
          href={`/api/evidence/${pack.id}/download`}
          onClick={(event) => {
            if (pack.completenessScore < 70 && !window.confirm("This evidence pack is incomplete. Download anyway?")) {
              event.preventDefault();
            }
          }}
          style={buttonStyle}
        >
          Download PDF
        </a>
        <Link to={`/app/orders/${encodeURIComponent(pack.shopifyOrderId)}`} style={secondaryButtonStyle}>Order</Link>
      </div>
      {pack.completenessScore < 70 && (
        <Notice tone="warning">This evidence pack is incomplete. Add the missing items before submitting.</Notice>
      )}
      <s-section heading="Summary">
        <Fact label="Score" value={`${pack.completenessScore}/100`} />
        <Fact label="Status" value={pack.status} />
        <Fact label="Created" value={formatDateTime(pack.createdAt)} />
        <Fact label="Dispute ID" value={pack.disputeId ?? "Manual evidence pack"} />
        <Fact label="Missing items" value={missingItems.length ? missingItems.join(", ") : "No missing items detected"} />
      </s-section>
      <s-section heading="Rebuttal text">
        <textarea readOnly value={pack.rebuttalText} style={textareaStyle} />
      </s-section>
      <s-section heading="Proof">
        {proofCapture ? (
          <Fact label={proofCapture.status} value={`${proofCapture.files.length} file(s), sealed ${formatDateTime(proofCapture.sealedAt)}`} />
        ) : (
          <s-paragraph>No proof capture was attached.</s-paragraph>
        )}
      </s-section>
    </s-page>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "grid", gridTemplateColumns: "170px 1fr", gap: 12, padding: "8px 0", borderBottom: "1px solid #eef0f2" }}><strong>{label}</strong><span>{value}</span></div>;
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "warning" | "info" }) {
  return <div style={{ padding: 12, margin: "12px 0", border: "1px solid", borderColor: tone === "warning" ? "#d97706" : "#2563eb", background: tone === "warning" ? "#fffbeb" : "#eff6ff", borderRadius: 6 }}>{children}</div>;
}

const buttonStyle: React.CSSProperties = { display: "inline-block", border: "1px solid #1f6feb", background: "#1f6feb", color: "#fff", borderRadius: 6, padding: "10px 14px", textDecoration: "none" };
const secondaryButtonStyle: React.CSSProperties = { ...buttonStyle, background: "#fff", color: "#1f6feb" };
const textareaStyle: React.CSSProperties = { width: "100%", minHeight: 260, border: "1px solid #c9d1d9", borderRadius: 6, padding: 12, fontFamily: "inherit" };

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
