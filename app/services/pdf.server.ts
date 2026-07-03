import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  formatAddress,
  formatDateTime,
  formatMoney,
  getCustomerEmail,
  getCustomerName,
  getPrimaryTracking,
  hasDeliveryConfirmation,
} from "../lib/format";
import type {
  AuditEventSummary,
  ProofFileSummary,
  ShopifyDispute,
  ShopifyOrder,
} from "../lib/shopify-types";
import type { CompletenessResult } from "../lib/evidence-score";

export type EvidencePdfInput = {
  packId: string;
  shopName: string;
  order: ShopifyOrder;
  dispute?: ShopifyDispute | null;
  proofFiles: ProofFileSummary[];
  auditEvents: AuditEventSummary[];
  completeness: CompletenessResult;
  rebuttalText: string;
  policyText: string;
  communications: string;
  rawSnapshot: unknown;
};

const pageWidth = 612;
const pageHeight = 792;
const margin = 54;
const lineHeight = 13;

export async function generateEvidencePdf(input: EvidencePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensure = (needed = 80) => {
    if (y < margin + needed) {
      drawFooter(page, input.packId, pdf.getPageCount(), regular);
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };
  const drawText = (text: string, options?: { size?: number; font?: typeof regular; color?: ReturnType<typeof rgb> }) => {
    const size = options?.size ?? 10;
    const font = options?.font ?? regular;
    const color = options?.color ?? rgb(0.12, 0.12, 0.12);
    for (const line of wrapText(text, font, size, pageWidth - margin * 2)) {
      ensure(lineHeight + 4);
      page.drawText(line, { x: margin, y, size, font, color });
      y -= lineHeight;
    }
  };
  const section = (title: string) => {
    ensure(60);
    y -= 8;
    page.drawText(title, { x: margin, y, size: 14, font: bold, color: rgb(0.05, 0.16, 0.28) });
    y -= 18;
    page.drawLine({
      start: { x: margin, y: y + 6 },
      end: { x: pageWidth - margin, y: y + 6 },
      thickness: 0.6,
      color: rgb(0.72, 0.76, 0.8),
    });
  };
  const row = (label: string, value: string) => {
    ensure(30);
    page.drawText(label, { x: margin, y, size: 9, font: bold, color: rgb(0.24, 0.27, 0.3) });
    for (const line of wrapText(value || "Not available", regular, 9, 330)) {
      page.drawText(line, { x: 210, y, size: 9, font: regular, color: rgb(0.12, 0.12, 0.12) });
      y -= 12;
    }
    y -= 2;
  };

  page.drawText("Backstop Proof Evidence Pack", {
    x: margin,
    y,
    size: 24,
    font: bold,
    color: rgb(0.04, 0.14, 0.24),
  });
  y -= 34;
  drawText("Merchant-reviewed packing proof, order facts, and dispute evidence materials.", {
    size: 11,
  });
  y -= 12;
  row("Merchant", input.shopName);
  row("Order", input.order.name);
  row("Evidence pack ID", input.packId);
  row("Generated", formatDateTime(new Date()));
  row("Dispute reason", input.dispute?.reason ?? "Not available");
  row("Dispute amount", input.dispute?.amount?.amount ? `${input.dispute.amount.currencyCode} ${input.dispute.amount.amount}` : "Not available");
  row("Prepared by", "Backstop Proof");

  section("Executive Summary");
  drawText(
    `The order was placed on ${formatDateTime(input.order.createdAt)}, paid or recorded in Shopify, fulfilled to the customer-provided shipping address when available, and reviewed with the proof and tracking records below. This pack is prepared for merchant review before any submission.`,
  );
  drawText(
    "Backstop Proof prepares merchant-reviewed evidence materials. It does not provide legal advice and does not guarantee dispute outcomes.",
    { size: 9, color: rgb(0.35, 0.35, 0.35) },
  );

  section("Order Details");
  row("Order ID", input.order.id);
  row("Order name", input.order.name);
  row("Created", formatDateTime(input.order.createdAt));
  row("Total", formatMoney(input.order));
  row("Customer", getCustomerName(input.order) || "Not available");
  row("Customer email", getCustomerEmail(input.order) || "Not available");
  row("Shipping address", formatAddress(input.order.shippingAddress));
  row("Billing address", formatAddress(input.order.billingAddress));
  for (const item of input.order.lineItems?.nodes ?? []) {
    row(
      "Line item",
      `${item.quantity ?? 0} x ${item.title ?? "Untitled"}${item.variantTitle ? ` (${item.variantTitle})` : ""}${item.sku ? ` SKU ${item.sku}` : ""}`,
    );
  }

  section("Fulfillment and Tracking");
  const tracking = getPrimaryTracking(input.order);
  row("Fulfillment status", input.order.displayFulfillmentStatus ?? "Not available");
  row("Carrier", tracking?.company ?? "Not available from Shopify data");
  row("Tracking number", tracking?.number ?? "Not available from Shopify data");
  row("Tracking URL", tracking?.url ?? "Not available from Shopify data");
  row("Fulfillment date", formatDateTime(input.order.fulfillments?.[0]?.createdAt));
  row(
    "Delivery confirmation",
    hasDeliveryConfirmation(input.order)
      ? "Delivery confirmation is present in Shopify data."
      : "Not available from Shopify data. Add carrier delivery confirmation before submitting when possible.",
  );

  section("Packing Proof");
  if (input.proofFiles.length === 0) {
    drawText("No sealed proof files were included.");
  }
  for (const file of input.proofFiles) {
    row("Proof file", file.originalFilename ?? file.filename ?? "Stored proof file");
    row("Captured", formatDateTime(file.capturedAt));
    row("SHA-256", file.sha256 ?? "Not available");
    row("File size", file.byteSize ? `${file.byteSize} bytes` : "Not available");
  }
  drawText(
    "The hash values identify the files stored in Backstop Proof. Any alteration to the underlying file changes the hash.",
    { font: mono, size: 8 },
  );

  section("Policies and Communications");
  drawText(input.policyText || "Merchant policy not configured in Backstop Proof.");
  if (input.communications) {
    drawText(input.communications);
  } else {
    drawText("No customer communication was added by the merchant.");
  }

  section("Timeline");
  row("Order created", formatDateTime(input.order.createdAt));
  row("Payment captured", formatDateTime(input.order.transactions?.[0]?.processedAt));
  row("Fulfilled", formatDateTime(input.order.fulfillments?.[0]?.createdAt));
  row("Dispute opened", formatDateTime(input.dispute?.initiatedAt));
  row("Evidence pack generated", formatDateTime(new Date()));

  section("Rebuttal Letter");
  drawText(input.rebuttalText);

  section("Completeness");
  row("Score", `${input.completeness.score}/100`);
  row(
    "Missing items",
    input.completeness.missingItems.length
      ? input.completeness.missingItems.join(", ")
      : "No missing items detected.",
  );

  section("Appendix: Audit Trail");
  if (input.auditEvents.length === 0) {
    drawText("No audit events were supplied.");
  }
  for (const event of input.auditEvents) {
    row("Audit event", `${formatDateTime(event.createdAt)} ${event.actorType ?? "SYSTEM"} ${event.action}`);
  }

  section("Appendix: Raw Snapshot Summary");
  for (const line of JSON.stringify(input.rawSnapshot, null, 2).slice(0, 5000).split("\n")) {
    drawText(line, { font: mono, size: 7 });
  }

  for (const [index, pdfPage] of pdf.getPages().entries()) {
    drawFooter(pdfPage, input.packId, index + 1, regular);
  }

  return pdf.save();
}

function drawFooter(page: import("pdf-lib").PDFPage, packId: string, pageNumber: number, font: import("pdf-lib").PDFFont) {
  page.drawText(`Generated by Backstop Proof | ${packId} | Page ${pageNumber}`, {
    x: margin,
    y: 28,
    size: 8,
    font,
    color: rgb(0.38, 0.42, 0.46),
  });
}

function wrapText(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const rawLine of String(text).split("\n")) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || current === "") {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}
