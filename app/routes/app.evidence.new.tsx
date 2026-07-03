import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import type * as React from "react";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { formatMoney, getPrimaryTracking } from "../lib/format";
import { getDemoOrder } from "../services/demo-data.server";
import { generateEvidencePack } from "../services/evidence.server";
import { getShopContext } from "../services/shop-context.server";
import { ShopifyGraphqlService } from "../services/shopify-graphql.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const context = await getShopContext(request);
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId") ?? "";
  const proofCaptureId = url.searchParams.get("proofCaptureId") ?? "";
  const order = orderId
    ? context.demoMode || !context.admin
      ? getDemoOrder(orderId)
      : await new ShopifyGraphqlService(context.admin).getOrder(orderId)
    : null;
  const proofCaptures = order
    ? await prisma.proofCapture.findMany({
        where: { shopId: context.shop.id, shopifyOrderId: order.id },
        orderBy: { updatedAt: "desc" },
        include: { files: true },
      })
    : [];
  return { order, orderId, proofCaptureId, proofCaptures };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const context = await getShopContext(request);
  const form = await request.formData();
  try {
    const result = await generateEvidencePack({
      context,
      orderId: String(form.get("orderId") ?? ""),
      proofCaptureId: String(form.get("proofCaptureId") ?? "") || null,
      disputeId: String(form.get("disputeId") ?? "") || null,
      communications: String(form.get("communications") ?? ""),
      reason: String(form.get("reason") ?? ""),
    });
    return redirect(`/app/evidence/${result.pack.id}`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to generate evidence pack." };
  }
};

export default function NewEvidence() {
  const { order, orderId, proofCaptureId, proofCaptures } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const tracking = order ? getPrimaryTracking(order) : null;
  return (
    <s-page heading="Generate evidence pack">
      {actionData?.error && <Notice tone="warning">{actionData.error}</Notice>}
      {!order && (
        <s-section heading="Choose order">
          <Form method="get" style={{ display: "flex", gap: 8 }}>
            <input name="orderId" defaultValue={orderId} placeholder="gid://shopify/Order/..." style={inputStyle} />
            <button type="submit" style={buttonStyle}>Load order</button>
          </Form>
          <p><Link to="/app/orders">Search orders first</Link></p>
        </s-section>
      )}
      {order && (
        <s-section heading={`Evidence for ${order.name}`}>
          {!tracking?.number && <Notice tone="warning">Delivery confirmation or tracking is missing from Shopify data.</Notice>}
          {proofCaptures.filter((proof) => proof.status === "SEALED").length === 0 && (
            <Notice tone="warning">No sealed proof captured for this order.</Notice>
          )}
          <p>Total: {formatMoney(order)}</p>
          <Form method="post" style={{ display: "grid", gap: 12 }}>
            <input type="hidden" name="orderId" value={order.id} />
            <label style={fieldStyle}>
              <span>Dispute reason</span>
              <select name="reason" style={inputStyle} defaultValue="product_not_received">
                <option value="product_not_received">Product not received</option>
                <option value="fraudulent">Fraudulent</option>
                <option value="product_unacceptable">Product unacceptable</option>
                <option value="credit_not_processed">Credit not processed</option>
                <option value="duplicate">Duplicate</option>
                <option value="subscription_canceled">Subscription canceled</option>
                <option value="general">General / unknown</option>
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Proof capture</span>
              <select name="proofCaptureId" style={inputStyle} defaultValue={proofCaptureId}>
                <option value="">Use latest sealed proof if available</option>
                {proofCaptures.map((proof) => (
                  <option key={proof.id} value={proof.id}>
                    {proof.status} | {proof.files.length} file(s) | {proof.orderName}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Relevant customer communication</span>
              <textarea name="communications" style={textareaStyle} placeholder="Paste only communication the merchant wants included." />
            </label>
            <button type="submit" style={buttonStyle}>Generate PDF evidence pack</button>
          </Form>
        </s-section>
      )}
    </s-page>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "warning" | "info" }) {
  return <div style={{ padding: 12, marginBottom: 12, border: "1px solid", borderColor: tone === "warning" ? "#d97706" : "#2563eb", background: tone === "warning" ? "#fffbeb" : "#eff6ff", borderRadius: 6 }}>{children}</div>;
}

const fieldStyle: React.CSSProperties = { display: "grid", gap: 5 };
const inputStyle: React.CSSProperties = { border: "1px solid #c9d1d9", borderRadius: 6, padding: "9px 10px", width: "100%" };
const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: 140 };
const buttonStyle: React.CSSProperties = { border: "1px solid #1f6feb", background: "#1f6feb", color: "#fff", borderRadius: 6, padding: "10px 14px", width: "fit-content" };

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
