import { describe, expect, it } from "vitest";
import {
  captureCreateSchema,
  evidenceCreateSchema,
  settingsSchema,
} from "../../app/lib/validation";

describe("validation schemas", () => {
  it("accepts valid proof capture input", () => {
    expect(
      captureCreateSchema.parse({
        shopifyOrderId: "gid://shopify/Order/1",
        orderName: "#1001",
        staffLabel: "JR",
        stationLabel: "Station 2",
        notes: "Box weighed before sealing.",
      }),
    ).toMatchObject({ orderName: "#1001" });
  });

  it("rejects evidence generation without an order ID", () => {
    expect(() => evidenceCreateSchema.parse({ orderId: "" })).toThrow();
  });

  it("normalizes settings defaults", () => {
    expect(settingsSchema.parse({}).retentionDays).toBe(180);
  });
});
