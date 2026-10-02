import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import fontkit from "@pdf-lib/fontkit";
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
let unicodeFontBytes: Promise<Buffer> | undefined;
const fontCharacters = new WeakMap<import("pdf-lib").PDFFont, Set<number>>();
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export async function generateEvidencePdf(input: EvidencePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // public/ is copied into both the development app and the compiled container.
  unicodeFontBytes ??= readFile(resolve(process.cwd(), "public/fonts/ZenKakuGothicNew-Regular.ttf"));
  // Full embedding avoids missing glyph outlines observed with fontkit subsets.
  const regular = await pdf.embedFont(await unicodeFontBytes, { subset: false });
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = regular; // Appendix text needs the same Unicode coverage as rows.
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensure = (needed = 80) => {
    if (y < margin + needed) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      return true;
    }
    return false;
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
    y -= 8;
  };
  const row = (label: string, value: string) => {
    ensure(30);
    page.drawText(label, { x: margin, y, size: 9, font: bold, color: rgb(0.24, 0.27, 0.3) });
    for (const line of wrapText(value || "Not available", regular, 9, 330)) {
      if (ensure(16)) {
        page.drawText(`${label} (continued)`, { x: margin, y, size: 8, font: bold, color: rgb(0.24, 0.27, 0.3) });
      }
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
    `Shopify records the order date as ${formatDateTime(input.order.createdAt)}. The following sections present the available payment, fulfillment, proof, and tracking records. Missing data does not establish payment, shipment, or delivery. This pack is prepared for merchant review before any submission.`,
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
  row("Payment status", input.order.displayFinancialStatus ?? "Not available");
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
  row("Fulfillment record created", formatDateTime(input.order.fulfillments?.[0]?.createdAt));
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
  const capturedPayment = input.order.transactions?.find(
    (transaction) => transaction.status === "SUCCESS" && ["SALE", "CAPTURE"].includes(transaction.kind ?? ""),
  );
  row("Successful sale/capture", formatDateTime(capturedPayment?.processedAt));
  row("Fulfillment record created", formatDateTime(input.order.fulfillments?.[0]?.createdAt));
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
  // A pasted tab is layout whitespace, not a missing visible glyph. Expand it
  // only for rendering; the stored source text and raw snapshot stay unchanged.
  const layoutText = text.replace(/\t/g, "    ");
  let supported = fontCharacters.get(font);
  if (!supported) {
    supported = new Set(font.getCharacterSet());
    fontCharacters.set(font, supported);
  }
  for (const character of layoutText) {
    const codePoint = character.codePointAt(0)!;
    if (character !== "\n" && character !== "\r" && !supported.has(codePoint)) {
      throw new Error(`PDF font does not support U+${codePoint.toString(16).toUpperCase()}. Original text was not replaced.`);
    }
  }
  const lines: string[] = [];
  for (const rawLine of layoutText.split(/\r?\n/)) {
    const words = rawLine.match(/\S+|\s+/gu) ?? [];
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current + word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = "";
        // Tracking URLs, hashes, and CJK text may have no spaces. Wrap on
        // grapheme boundaries so every character survives without overflow.
        for (const { segment } of graphemes.segment(word)) {
          if (font.widthOfTextAtSize(segment, size) > maxWidth) {
            throw new Error("A text grapheme exceeds the PDF column width.");
          }
          if (current && font.widthOfTextAtSize(current + segment, size) > maxWidth) {
            lines.push(current);
            current = segment;
          } else {
            current += segment;
          }
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}
