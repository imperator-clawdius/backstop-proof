import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getStorageService } from "../services/storage.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // Always delete by shop domain so orphaned sessions cannot survive an uninstall.
  await getStorageService().deleteShopData(shop);
  await db.session.deleteMany({ where: { shop } });
  await db.shop.deleteMany({ where: { shopDomain: shop } });

  return new Response();
};
