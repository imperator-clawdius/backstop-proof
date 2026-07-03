import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import prisma from "../db.server";
import { seedDemoData } from "../services/demo-seed.server";
import { getShopContext } from "../services/shop-context.server";
import { getStorageService } from "../services/storage.server";

export const loader = async () => {
  return new Response("Use POST to reset demo data.", { status: 405 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const context = await getShopContext(request);
  if (!context.demoMode) throw new Response("Demo reset is only available in demo mode.", { status: 403 });
  await getStorageService().deleteShopData(context.shopDomain);
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { shopId: context.shop.id } }),
    prisma.auditEvent.deleteMany({ where: { shopId: context.shop.id } }),
    prisma.evidencePack.deleteMany({ where: { shopId: context.shop.id } }),
    prisma.proofFile.deleteMany({ where: { shopId: context.shop.id } }),
    prisma.proofCapture.deleteMany({ where: { shopId: context.shop.id } }),
    prisma.disputeSnapshot.deleteMany({ where: { shopId: context.shop.id } }),
  ]);
  await seedDemoData(context);
  return redirect("/app");
};
