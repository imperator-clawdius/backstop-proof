import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import type * as React from "react";
import { Form, Link, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { formatDateTime, getCustomerEmail, getCustomerName } from "../lib/format";
import { listDemoOrders } from "../services/demo-data.server";
import { createProofCapture } from "../services/proof.server";
import { getShopContext } from "../services/shop-context.server";
import { ShopifyGraphqlService } from "../services/shopify-graphql.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const context = await getShopContext(request);
  const url = new URL(request.url);
  const selectedOrderId = url.searchParams.get("orderId") ?? "";
  const orders =
    context.demoMode || !context.admin
      ? listDemoOrders()
      : await new ShopifyGraphqlService(context.admin).listRecentOrders();
  return { orders, selectedOrderId };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const context = await getShopContext(request);
  const form = await request.formData();
  const proof = await createProofCapture({
    shopId: context.shop.id,
    shopifyOrderId: String(form.get("shopifyOrderId") ?? ""),
    orderName: String(form.get("orderName") ?? ""),
    staffLabel: String(form.get("staffLabel") ?? ""),
    stationLabel: String(form.get("stationLabel") ?? ""),
    notes: String(form.get("notes") ?? ""),
  });
  return redirect(`/app/capture/${proof.id}`);
};

export default function Capture() {
  const { orders, selectedOrderId } = useLoaderData<typeof loader>();
  const selected = orders.find((order) => order.id === selectedOrderId) ?? orders[0];
  return (
    <s-page heading="Capture packing proof">
      <s-section heading="Start a proof capture">
        <Notice>
          Capture products laid out before packing, products inside the box, and
          the sealed package with the label visible. Files are hash-sealed
          server-side after upload.
        </Notice>
        <Form method="post" style={{ display: "grid", gap: 14 }}>
          <label style={fieldStyle}>
            <span>Recent order</span>
            <select
              name="shopifyOrderId"
              defaultValue={selected?.id}
              style={inputStyle}
              onChange={(event) => {
                const option = event.currentTarget.selectedOptions[0];
                const orderName = option?.getAttribute("data-order-name") ?? "";
                const target = event.currentTarget.form?.elements.namedItem("orderName") as HTMLInputElement | null;
                if (target) target.value = orderName;
              }}
            >
              {orders.map((order) => (
                <option key={order.id} value={order.id} data-order-name={order.name}>
                  {order.name} | {getCustomerName(order) || getCustomerEmail(order)} | {formatDateTime(order.createdAt)}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            <span>Order name</span>
            <input name="orderName" defaultValue={selected?.name ?? ""} style={inputStyle} required />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={fieldStyle}>
              <span>Staff initials/name</span>
              <input name="staffLabel" style={inputStyle} placeholder="JR" />
            </label>
            <label style={fieldStyle}>
              <span>Packing station/location</span>
              <input name="stationLabel" style={inputStyle} placeholder="Station 2" />
            </label>
          </div>
          <label style={fieldStyle}>
            <span>Notes</span>
            <textarea name="notes" style={textareaStyle} placeholder="Box weighed before sealing." />
          </label>
          <button type="submit" style={buttonStyle}>Start proof capture</button>
        </Form>
      </s-section>

      <s-section heading="Expected capture set" slot="aside">
        <s-unordered-list>
          <s-list-item>Products laid out before packing</s-list-item>
          <s-list-item>Products inside box</s-list-item>
          <s-list-item>Sealed package with label visible</s-list-item>
          <s-list-item>Optional supporting PDF when needed</s-list-item>
        </s-unordered-list>
        <Link to="/app/orders">Find a different order</Link>
      </s-section>
    </s-page>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 12, border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 6, marginBottom: 12 }}>{children}</div>;
}

const fieldStyle: React.CSSProperties = { display: "grid", gap: 5 };
const inputStyle: React.CSSProperties = { border: "1px solid #c9d1d9", borderRadius: 6, padding: "9px 10px" };
const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: 96 };
const buttonStyle: React.CSSProperties = { border: "1px solid #1f6feb", background: "#1f6feb", color: "#fff", borderRadius: 6, padding: "10px 14px", width: "fit-content" };

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
