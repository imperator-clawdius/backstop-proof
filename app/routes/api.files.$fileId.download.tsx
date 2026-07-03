import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { assertDownloadAuthorized } from "../lib/download-authorization";
import { getShopContext } from "../services/shop-context.server";
import { getStorageService } from "../services/storage.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const context = await getShopContext(request);
  const file = await prisma.proofFile.findFirst({
    where: { id: params.fileId ?? "", shopId: context.shop.id },
  });
  if (!file) throw new Response("Proof file not found", { status: 404 });
  assertDownloadAuthorized({
    currentShopId: context.shop.id,
    recordShopId: file.shopId,
    recordType: "Proof file",
  });
  const { body, contentType } = await getStorageService().read(file.storageKey);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${file.originalFilename.replace(/"/g, "")}"`,
    },
  });
};
