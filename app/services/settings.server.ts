import type { Shop } from "@prisma/client";
import { settingsSchema } from "../lib/validation";

export type BackstopSettings = ReturnType<typeof settingsSchema.parse>;

export function parseShopSettings(shop: Pick<Shop, "settings"> | null): BackstopSettings {
  const raw = shop?.settings && typeof shop.settings === "object" ? shop.settings : {};
  return settingsSchema.parse(raw);
}

export function policyTextFromSettings(settings: BackstopSettings): string {
  return [settings.defaultPolicyText, settings.refundPolicy, settings.shippingPolicy]
    .filter((value) => value.trim().length > 0)
    .join("\n\n");
}
