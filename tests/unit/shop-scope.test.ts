import { describe, expect, it } from "vitest";
import { assertShopScoped } from "../../app/lib/shop-scope";

describe("assertShopScoped", () => {
  it("allows access when record and session shop IDs match", () => {
    expect(() =>
      assertShopScoped({ currentShopId: "shop_1", recordShopId: "shop_1" }),
    ).not.toThrow();
  });

  it("blocks cross-shop access", () => {
    expect(() =>
      assertShopScoped({ currentShopId: "shop_1", recordShopId: "shop_2" }),
    ).toThrow("Record does not belong to this shop.");
  });
});
