import prisma from "../db.server";

export async function createAuditEvent(input: {
  shopId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorType?: "SYSTEM" | "MERCHANT" | "STAFF";
  actorLabel?: string | null;
  metadata?: unknown;
}) {
  return prisma.auditEvent.create({
    data: {
      shopId: input.shopId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorType: input.actorType ?? "SYSTEM",
      actorLabel: input.actorLabel,
      metadata: normalizeJson(input.metadata ?? {}),
    },
  });
}

export function normalizeJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
