import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { Shop } from "@prisma/client";
import prisma from "../db.server";
import { shouldUseDemoContext } from "../lib/demo-mode";
import { authenticate } from "../shopify.server";

export type ShopContext = {
  shop: Shop;
  shopDomain: string;
  admin: AdminApiContext | null;
  demoMode: boolean;
  accessScopes: string[];
};

const DEMO_SHOP_DOMAIN = "demo.backstop-proof.local";

export async function getShopContext(request: Request): Promise<ShopContext> {
  if (shouldUseDemoContext()) {
    const shop = await ensureShop(DEMO_SHOP_DOMAIN, process.env.SCOPES ?? "");
    return {
      shop,
      shopDomain: DEMO_SHOP_DOMAIN,
      admin: null,
      demoMode: true,
      accessScopes: scopesToArray(process.env.SCOPES),
    };
  }

  const { admin, session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop, session.scope ?? "");
  return {
    shop,
    shopDomain: session.shop,
    admin,
    demoMode: false,
    accessScopes: scopesToArray(session.scope),
  };
}

export async function ensureShop(shopDomain: string, accessScope: string | null): Promise<Shop> {
  return prisma.shop.upsert({
    where: { shopDomain },
    update: {
      uninstalledAt: null,
      accessScope,
    },
    create: {
      shopDomain,
      accessScope,
      settings: {
        responseTone: "factual",
        retentionDays: 180,
        dueSoonDays: 5,
        allowStaffInitials: true,
      },
    },
  });
}

export function scopesToArray(scopes?: string | null): string[] {
  return (scopes ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function missingRequiredScopes(scopes: string[]): string[] {
  const required = [
    "read_orders",
    "read_customers",
    "read_shopify_payments_disputes",
    "read_shopify_payments_dispute_evidences",
    "write_shopify_payments_dispute_evidences",
  ];
  return required.filter((scope) => !scopes.includes(scope));
}
