import { z } from "zod";

const optionalShortText = z.string().trim().max(120).optional().or(z.literal(""));

export const captureCreateSchema = z.object({
  shopifyOrderId: z.string().trim().min(1),
  orderName: z.string().trim().min(1).max(80),
  staffLabel: optionalShortText,
  stationLabel: optionalShortText,
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const proofFileUploadSchema = z.object({
  proofCaptureId: z.string().trim().min(1),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const evidenceCreateSchema = z.object({
  orderId: z.string().trim().min(1),
  disputeId: z.string().trim().optional(),
  proofCaptureId: z.string().trim().optional(),
  communications: z.string().trim().max(15000).optional().or(z.literal("")),
  reason: z.string().trim().max(80).optional().or(z.literal("")),
});

export const settingsSchema = z.object({
  supportEmail: z.string().trim().email().optional().or(z.literal("")),
  storeDisplayName: z.string().trim().max(120).optional().or(z.literal("")),
  defaultPolicyText: z.string().trim().max(10000).default(""),
  refundPolicy: z.string().trim().max(10000).default(""),
  shippingPolicy: z.string().trim().max(10000).default(""),
  responseTone: z.enum(["factual", "firm", "concise"]).default("factual"),
  retentionDays: z.coerce.number().int().min(90).max(365).default(180),
  notificationsEmail: z.string().trim().email().optional().or(z.literal("")),
  dueSoonDays: z.coerce.number().int().min(1).max(14).default(5),
  allowStaffInitials: z.coerce.boolean().default(true),
});

export const disputeEvidenceUpdateSchema = z.object({
  evidenceId: z.string().trim().min(1),
  confirm: z.literal("yes"),
  rebuttalText: z.string().trim().min(1).max(15000),
});
