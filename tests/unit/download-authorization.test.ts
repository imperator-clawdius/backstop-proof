import { describe, expect, it } from "vitest";
import { assertDownloadAuthorized } from "../../app/lib/download-authorization";

describe("download authorization", () => {
  it("allows downloads owned by the current shop", () => {
    expect(() =>
      assertDownloadAuthorized({
        currentShopId: "shop_1",
        recordShopId: "shop_1",
        recordType: "Evidence pack",
      }),
    ).not.toThrow();
  });

  it("rejects proof file downloads from another shop", () => {
    expect(() =>
      assertDownloadAuthorized({
        currentShopId: "shop_1",
        recordShopId: "shop_2",
        recordType: "Proof file",
      }),
    ).toThrow("Proof file not found.");
  });

  it("rejects evidence PDF downloads from another shop", () => {
    expect(() =>
      assertDownloadAuthorized({
        currentShopId: "shop_1",
        recordShopId: "shop_2",
        recordType: "Evidence pack",
      }),
    ).toThrow("Evidence pack not found.");
  });
});
