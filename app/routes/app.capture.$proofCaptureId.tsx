import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import type * as React from "react";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { formatDateTime } from "../lib/format";
import { getDemoOrder } from "../services/demo-data.server";
import { getProofCaptureForShop, sealProofCapture, uploadProofFile } from "../services/proof.server";
import { getShopContext } from "../services/shop-context.server";
import { ShopifyGraphqlService } from "../services/shopify-graphql.server";
import { getStorageService } from "../services/storage.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const context = await getShopContext(request);
  const proof = await getProofCaptureForShop(context.shop.id, params.proofCaptureId ?? "");
  if (!proof) throw new Response("Proof capture not found", { status: 404 });
  const order =
    context.demoMode || !context.admin
      ? getDemoOrder(proof.shopifyOrderId)
      : await new ShopifyGraphqlService(context.admin).getOrder(proof.shopifyOrderId);
  return { proof, order };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const context = await getShopContext(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  try {
    if (intent === "seal") {
      await sealProofCapture({
        shopId: context.shop.id,
        proofCaptureId: params.proofCaptureId ?? "",
        actorLabel: String(form.get("actorLabel") ?? ""),
      });
      return redirect(`/app/capture/${params.proofCaptureId}`);
    }
    const file = form.get("proofFile");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose a file to upload." };
    }
    await uploadProofFile({
      shopId: context.shop.id,
      shopDomain: context.shopDomain,
      proofCaptureId: params.proofCaptureId ?? "",
      file,
      storage: getStorageService(),
    });
    return redirect(`/app/capture/${params.proofCaptureId}`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update proof capture." };
  }
};

export default function CaptureDetail() {
  const { proof, order } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const sealed = proof.status === "SEALED";
  return (
    <s-page heading={`Proof capture ${proof.orderName}`}>
      <div slot="primary-action" style={{ display: "flex", gap: 8 }}>
        <Link to={`/app/orders/${encodeURIComponent(proof.shopifyOrderId)}`} style={secondaryButtonStyle}>Order detail</Link>
        {sealed && (
          <Link to={`/app/evidence/new?orderId=${encodeURIComponent(proof.shopifyOrderId)}&proofCaptureId=${proof.id}`} style={buttonStyle}>Generate evidence pack</Link>
        )}
      </div>
      {actionData?.error && <Notice tone="warning">{actionData.error}</Notice>}
      {!sealed && <Notice tone="info">This proof capture is still editable. Seal it when all required files are uploaded.</Notice>}
      {sealed && <Notice tone="info">This proof capture is sealed. Destructive edits are blocked; corrections should be appended as audit events.</Notice>}

      <s-section heading="Checklist">
        {(order?.lineItems?.nodes ?? []).map((item, index) => (
          <label key={index} style={{ display: "flex", gap: 8, padding: "6px 0" }}>
            <input type="checkbox" defaultChecked={sealed} disabled={sealed} />
            <span>{item.quantity} x {item.title} {item.variantTitle ? `(${item.variantTitle})` : ""} {item.sku ? `SKU ${item.sku}` : ""}</span>
          </label>
        ))}
      </s-section>

      <s-section heading="Proof files">
        {proof.files.length === 0 ? (
          <Notice tone="warning">No proof captured yet. Add at least two images before generating evidence.</Notice>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {proof.files.map((file) => (
              <div key={file.id} style={fileStyle}>
                <strong>{file.originalFilename}</strong>
                <span>{file.mimeType} | {file.byteSize} bytes | {formatDateTime(file.capturedAt)}</span>
                <code style={{ overflowWrap: "anywhere" }}>{file.sha256}</code>
                <a href={`/api/files/${file.id}/download`}>Download</a>
              </div>
            ))}
          </div>
        )}
      </s-section>

      {!sealed && (
        <s-section heading="Add proof evidence">
          <Form method="post" encType="multipart/form-data" style={{ display: "grid", gap: 12 }}>
            <input type="hidden" name="intent" value="upload" />
            <input
              name="proofFile"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
              required
              style={inputStyle}
            />
            <button type="submit" style={buttonStyle}>Upload and hash file</button>
          </Form>
        </s-section>
      )}

      {!sealed && (
        <s-section heading="Seal proof">
          <Form
            method="post"
            onSubmit={(event) => {
              if (!window.confirm("Seal this proof capture? After sealing, destructive edits are blocked.")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="intent" value="seal" />
            <input type="hidden" name="actorLabel" value={proof.staffLabel ?? ""} />
            <button type="submit" style={buttonStyle}>Seal proof capture</button>
          </Form>
        </s-section>
      )}
    </s-page>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "warning" | "info" }) {
  return (
    <div style={{ padding: 12, margin: "12px 0", border: "1px solid", borderColor: tone === "warning" ? "#d97706" : "#2563eb", background: tone === "warning" ? "#fffbeb" : "#eff6ff", borderRadius: 6 }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { border: "1px solid #c9d1d9", borderRadius: 6, padding: "9px 10px" };
const buttonStyle: React.CSSProperties = { display: "inline-block", border: "1px solid #1f6feb", background: "#1f6feb", color: "#fff", borderRadius: 6, padding: "10px 14px", textDecoration: "none", width: "fit-content" };
const secondaryButtonStyle: React.CSSProperties = { ...buttonStyle, background: "#fff", color: "#1f6feb" };
const fileStyle: React.CSSProperties = { display: "grid", gap: 4, border: "1px solid #d8dee4", borderRadius: 6, padding: 12, background: "#fff" };

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
