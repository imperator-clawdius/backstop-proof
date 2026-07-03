import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import type * as React from "react";
import { Form, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { settingsSchema } from "../lib/validation";
import { parseShopSettings } from "../services/settings.server";
import { getShopContext } from "../services/shop-context.server";
import { getStorageService } from "../services/storage.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const context = await getShopContext(request);
  const settings = parseShopSettings(context.shop);
  const [proofFiles, evidencePacks] = await Promise.all([
    prisma.proofFile.findMany({ where: { shopId: context.shop.id }, select: { byteSize: true } }),
    prisma.evidencePack.count({ where: { shopId: context.shop.id } }),
  ]);
  return {
    settings,
    plan: context.shop.plan,
    storageBytes: proofFiles.reduce((sum, file) => sum + file.byteSize, 0),
    evidencePacks,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const context = await getShopContext(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "save");
  if (intent === "delete_data") {
    await getStorageService().deleteShopData(context.shopDomain);
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { shopId: context.shop.id } }),
      prisma.auditEvent.deleteMany({ where: { shopId: context.shop.id } }),
      prisma.evidencePack.deleteMany({ where: { shopId: context.shop.id } }),
      prisma.proofFile.deleteMany({ where: { shopId: context.shop.id } }),
      prisma.proofCapture.deleteMany({ where: { shopId: context.shop.id } }),
      prisma.disputeSnapshot.deleteMany({ where: { shopId: context.shop.id } }),
    ]);
    return { message: "Shop data deleted. Shopify sessions and app settings were retained for this install." };
  }
  const settings = settingsSchema.parse({
    supportEmail: form.get("supportEmail"),
    storeDisplayName: form.get("storeDisplayName"),
    defaultPolicyText: form.get("defaultPolicyText"),
    refundPolicy: form.get("refundPolicy"),
    shippingPolicy: form.get("shippingPolicy"),
    responseTone: form.get("responseTone"),
    retentionDays: form.get("retentionDays"),
    notificationsEmail: form.get("notificationsEmail"),
    dueSoonDays: form.get("dueSoonDays"),
    allowStaffInitials: form.get("allowStaffInitials") === "on",
  });
  await prisma.shop.update({
    where: { id: context.shop.id },
    data: { settings },
  });
  return { message: "Settings saved." };
};

export default function Settings() {
  const { settings, plan, storageBytes, evidencePacks } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  return (
    <s-page heading="Settings">
      {actionData?.message && <Notice>{actionData.message}</Notice>}
      <Form method="post" style={{ display: "grid", gap: 16 }}>
        <input type="hidden" name="intent" value="save" />
        <s-section heading="Merchant profile">
          <label style={fieldStyle}><span>Store display name</span><input name="storeDisplayName" defaultValue={settings.storeDisplayName} style={inputStyle} /></label>
          <label style={fieldStyle}><span>Support email</span><input name="supportEmail" defaultValue={settings.supportEmail} style={inputStyle} /></label>
        </s-section>
        <s-section heading="Evidence settings">
          <label style={fieldStyle}><span>Default policy text</span><textarea name="defaultPolicyText" defaultValue={settings.defaultPolicyText} style={textareaStyle} /></label>
          <label style={fieldStyle}><span>Refund policy</span><textarea name="refundPolicy" defaultValue={settings.refundPolicy} style={textareaStyle} /></label>
          <label style={fieldStyle}><span>Shipping policy</span><textarea name="shippingPolicy" defaultValue={settings.shippingPolicy} style={textareaStyle} /></label>
          <label style={fieldStyle}><span>Chargeback response tone</span><select name="responseTone" defaultValue={settings.responseTone} style={inputStyle}><option value="factual">Factual</option><option value="firm">Firm</option><option value="concise">Concise</option></select></label>
        </s-section>
        <s-section heading="Storage and team">
          <p>Storage usage: {storageBytes.toLocaleString()} bytes across proof files.</p>
          <p>Evidence packs generated: {evidencePacks}</p>
          <label><input type="checkbox" name="allowStaffInitials" defaultChecked={settings.allowStaffInitials} /> Allow staff initials</label>
        </s-section>
        <s-section heading="Billing">
          <p>Current plan: {plan}</p>
          <div style={pricingGridStyle}>
            <Plan name="Free" body="10 proof captures/month, 1 evidence PDF/month, watermark footer." />
            <Plan name="Starter" body="$19/month, 100 proof captures/month, 20 evidence PDFs/month." />
            <Plan name="Pro" body="$59/month, 1,000 proof captures/month, 100 evidence PDFs/month, due-date reminders." />
          </div>
          <p>Use Shopify App Pricing/Billing API for public distribution. Do not use off-platform billing.</p>
        </s-section>
        <s-section heading="Data and notifications">
          <label style={fieldStyle}><span>Retention days</span><select name="retentionDays" defaultValue={settings.retentionDays} style={inputStyle}><option value="90">90</option><option value="180">180</option><option value="365">365</option></select></label>
          <label style={fieldStyle}><span>Reminder email</span><input name="notificationsEmail" defaultValue={settings.notificationsEmail} style={inputStyle} /></label>
          <label style={fieldStyle}><span>Due-soon threshold days</span><input name="dueSoonDays" type="number" min="1" max="14" defaultValue={settings.dueSoonDays} style={inputStyle} /></label>
        </s-section>
        <button type="submit" style={buttonStyle}>Save settings</button>
      </Form>
      <s-section heading="Delete shop data">
        <Form
          method="post"
          onSubmit={(event) => {
            if (!window.confirm("Delete proof, evidence, dispute snapshots, audit events, and notifications for this shop?")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="delete_data" />
          <button type="submit" style={dangerButtonStyle}>Delete shop data</button>
        </Form>
      </s-section>
    </s-page>
  );
}

function Plan({ name, body }: { name: string; body: string }) {
  return <div style={{ border: "1px solid #d8dee4", borderRadius: 6, padding: 12 }}><strong>{name}</strong><p>{body}</p></div>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 12, marginBottom: 12, border: "1px solid #2563eb", background: "#eff6ff", borderRadius: 6 }}>{children}</div>;
}

const fieldStyle: React.CSSProperties = { display: "grid", gap: 5, marginBottom: 12 };
const inputStyle: React.CSSProperties = { border: "1px solid #c9d1d9", borderRadius: 6, padding: "9px 10px", width: "100%" };
const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: 120 };
const buttonStyle: React.CSSProperties = { border: "1px solid #1f6feb", background: "#1f6feb", color: "#fff", borderRadius: 6, padding: "10px 14px", width: "fit-content" };
const dangerButtonStyle: React.CSSProperties = { ...buttonStyle, borderColor: "#b42318", background: "#b42318" };
const pricingGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 };

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
