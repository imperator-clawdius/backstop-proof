import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import type * as React from "react";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { shouldUseReadOnlyDemoDisputeFallback } from "../lib/demo-mode";
import { formatDateTime } from "../lib/format";
import { disputeEvidenceUpdateSchema } from "../lib/validation";
import { getDemoDispute, getDemoOrder } from "../services/demo-data.server";
import { mapDisputeEvidenceInput } from "../services/dispute-evidence.server";
import { generateEvidencePack } from "../services/evidence.server";
import { policyTextFromSettings, parseShopSettings } from "../services/settings.server";
import { getShopContext } from "../services/shop-context.server";
import { ShopifyGraphqlService } from "../services/shopify-graphql.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const context = await getShopContext(request);
  const url = new URL(request.url);
  const demoDisputeMode = shouldUseReadOnlyDemoDisputeFallback({
    currentShopIsDemo: context.demoMode,
    demoDisputeParam: url.searchParams.get("demoDispute"),
  });
  const disputeId = params.disputeId ? decodeURIComponent(params.disputeId) : "";
  const dispute =
    context.demoMode || demoDisputeMode || !context.admin
      ? getDemoDispute(disputeId)
      : await new ShopifyGraphqlService(context.admin).getDispute(disputeId);
  if (!dispute) throw new Response("Dispute not found", { status: 404 });
  const order = dispute.order?.id
    ? context.demoMode || demoDisputeMode || !context.admin
      ? getDemoOrder(dispute.order.id)
      : await new ShopifyGraphqlService(context.admin).getOrder(dispute.order.id)
    : null;
  const proof = order && !demoDisputeMode
    ? await prisma.proofCapture.findFirst({
        where: { shopId: context.shop.id, shopifyOrderId: order.id },
        orderBy: { updatedAt: "desc" },
        include: { files: true },
      })
    : null;
  const latestPack = order && !demoDisputeMode
    ? await prisma.evidencePack.findFirst({
        where: { shopId: context.shop.id, shopifyOrderId: order.id, disputeId: dispute.id },
        orderBy: { createdAt: "desc" },
      })
    : null;
  return {
    dispute,
    order,
    proof,
    latestPack,
    disputeUpdatesEnabled: process.env.ENABLE_SHOPIFY_DISPUTE_UPDATE === "true",
    demoMode: context.demoMode,
    demoDisputeMode,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const context = await getShopContext(request);
  const url = new URL(request.url);
  const demoDisputeMode = shouldUseReadOnlyDemoDisputeFallback({
    currentShopIsDemo: context.demoMode,
    demoDisputeParam: url.searchParams.get("demoDispute"),
  });
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const disputeId = params.disputeId ? decodeURIComponent(params.disputeId) : "";
  const dispute =
    context.demoMode || demoDisputeMode || !context.admin
      ? getDemoDispute(disputeId)
      : await new ShopifyGraphqlService(context.admin).getDispute(disputeId);
  if (!dispute?.order?.id) return { error: "Dispute has no associated order." };

  if (demoDisputeMode) {
    return {
      error:
        "Demo dispute mode is read-only for real Shopify installs. Use standalone demo mode for demo evidence generation.",
    };
  }

  if (intent === "generate") {
    const result = await generateEvidencePack({
      context,
      orderId: dispute.order.id,
      disputeId: dispute.id,
      reason: dispute.reason,
    });
    return redirect(`/app/evidence/${result.pack.id}`);
  }

  if (intent === "update_shopify") {
    if (process.env.ENABLE_SHOPIFY_DISPUTE_UPDATE !== "true") {
      return { error: "Shopify dispute evidence updates are disabled by ENABLE_SHOPIFY_DISPUTE_UPDATE." };
    }
    if (context.demoMode || !context.admin) {
      return { error: "Shopify dispute evidence updates require a real authenticated Shopify session." };
    }
    const parsed = disputeEvidenceUpdateSchema.parse({
      evidenceId: form.get("evidenceId"),
      confirm: form.get("confirm"),
      rebuttalText: form.get("rebuttalText"),
    });
    const order = await new ShopifyGraphqlService(context.admin).getOrder(dispute.order.id);
    if (!order) return { error: "Associated order was not found." };
    const settings = parseShopSettings(context.shop);
    const input = mapDisputeEvidenceInput({
      order,
      rebuttalText: parsed.rebuttalText,
      settings: {
        refundPolicy: settings.refundPolicy,
        shippingPolicy: settings.shippingPolicy,
        defaultPolicyText: policyTextFromSettings(settings),
      },
    });
    const result = await new ShopifyGraphqlService(context.admin).updateDisputeEvidence(parsed.evidenceId, input);
    if (result.userErrors.length > 0) {
      return { error: result.userErrors.map((error) => error.message).join("; ") };
    }
    await prisma.evidencePack.updateMany({
      where: { shopId: context.shop.id, disputeId: dispute.id },
      data: { status: "DRAFTED_TO_SHOPIFY" },
    });
    return { message: "Shopify dispute evidence draft updated. Review it in Shopify before final submission." };
  }

  return { error: "Unknown action." };
};

export default function DisputeDetail() {
  const {
    dispute,
    order,
    proof,
    latestPack,
    disputeUpdatesEnabled,
    demoMode,
    demoDisputeMode,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  return (
    <s-page heading={`Dispute ${dispute.legacyResourceId ?? dispute.id}`}>
      {actionData?.error && <Notice tone="warning">{actionData.error}</Notice>}
      {actionData?.message && <Notice tone="info">{actionData.message}</Notice>}
      {(demoMode || demoDisputeMode) && (
        <Notice tone="info">
          Demo dispute mode is active. No Shopify dispute evidence is updated
          and no real shop records are changed from this view.
        </Notice>
      )}
      <s-section heading="Dispute data">
        <Fact label="Order" value={dispute.order?.name ?? "Not available"} />
        <Fact label="Amount" value={`${dispute.amount?.currencyCode ?? ""} ${dispute.amount?.amount ?? ""}`.trim()} />
        <Fact label="Reason" value={dispute.reason ?? "Not available"} />
        <Fact label="Status" value={dispute.status ?? "Not available"} />
        <Fact label="Initiated" value={formatDateTime(dispute.initiatedAt)} />
        <Fact label="Evidence due" value={formatDateTime(dispute.evidenceDueBy)} />
        <Fact label="Evidence sent" value={formatDateTime(dispute.evidenceSentOn)} />
      </s-section>
      <s-section heading="Proof and evidence">
        <Fact label="Associated order" value={order?.name ?? "Not found"} />
        <Fact label="Proof status" value={proof ? `${proof.status} | ${proof.files.length} file(s)` : "No proof captured"} />
        <Fact label="Latest evidence pack" value={latestPack ? `${latestPack.completenessScore}/100 | ${latestPack.status}` : "None"} />
        {latestPack && <p><Link to={`/app/evidence/${latestPack.id}`}>Open latest evidence pack</Link></p>}
      </s-section>
      <s-section heading="Actions">
        {!demoDisputeMode && (
          <Form method="post" style={{ display: "inline-block", marginRight: 8 }}>
            <input type="hidden" name="intent" value="generate" />
            <button type="submit" style={buttonStyle}>Generate evidence pack from dispute</button>
          </Form>
        )}
        {latestPack && (
          <Form
            method="post"
            style={{ display: "grid", gap: 10, marginTop: 16 }}
            onSubmit={(event) => {
              if (!window.confirm("Update the Shopify dispute evidence draft? This will not submit final evidence.")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="intent" value="update_shopify" />
            <input type="hidden" name="confirm" value="yes" />
            <input type="hidden" name="evidenceId" value={dispute.evidence?.id ?? ""} />
            <label style={{ display: "grid", gap: 5 }}>
              <span>Draft text to send to Shopify evidence fields</span>
              <textarea name="rebuttalText" defaultValue={latestPack.rebuttalText} style={textareaStyle} />
            </label>
            {!disputeUpdatesEnabled && <Notice tone="warning">Evidence draft update is feature-flagged off.</Notice>}
            <button
              type="submit"
              style={buttonStyle}
              disabled={!disputeUpdatesEnabled || demoMode || demoDisputeMode || !dispute.evidence?.id}
            >
              Prepare Shopify evidence draft
            </button>
          </Form>
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

const buttonStyle: React.CSSProperties = { border: "1px solid #1f6feb", background: "#1f6feb", color: "#fff", borderRadius: 6, padding: "10px 14px" };
const textareaStyle: React.CSSProperties = { width: "100%", minHeight: 180, border: "1px solid #c9d1d9", borderRadius: 6, padding: 12, fontFamily: "inherit" };

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
