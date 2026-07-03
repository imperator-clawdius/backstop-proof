import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { assertDownloadAuthorized } from "../lib/download-authorization";
import { createAuditEvent } from "../services/audit.server";
import { getShopContext } from "../services/shop-context.server";
import { getStorageService } from "../services/storage.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const context = await getShopContext(request);
  const pack = await prisma.evidencePack.findFirst({
    where: { id: params.evidencePackId ?? "", shopId: context.shop.id },
  });
  if (!pack) throw new Response("Evidence pack not found", { status: 404 });
  assertDownloadAuthorized({
    currentShopId: context.shop.id,
    recordShopId: pack.shopId,
    recordType: "Evidence pack",
  });
  const { body, contentType } = await getStorageService().read(pack.pdfStorageKey);
  await prisma.evidencePack.update({
    where: { id: pack.id },
    data: { status: "DOWNLOADED" },
  });
  await createAuditEvent({
    shopId: context.shop.id,
    entityType: "EvidencePack",
    entityId: pack.id,
    action: "evidence.downloaded",
    actorType: "MERCHANT",
    metadata: {
      orderName: pack.orderName,
      completenessScore: pack.completenessScore,
    },
  });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="backstop-proof-${pack.orderName.replace(/[^a-zA-Z0-9-]/g, "")}-${pack.id}.pdf"`,
    },
  });
};
