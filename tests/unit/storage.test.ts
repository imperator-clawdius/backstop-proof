import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalStorageService } from "../../app/services/storage.server";

describe("LocalStorageService", () => {
  it("writes and reads shop-scoped files without public URLs", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "backstop-proof-"));
    const storage = new LocalStorageService(root);

    try {
      const result = await storage.write({
        shopDomain: "demo-store.myshopify.com",
        key: "proofs/file.txt",
        body: Buffer.from("sealed evidence"),
        contentType: "text/plain",
      });
      const read = await storage.read(result.storageKey);

      expect(result.storageKey).toBe("demo-store.myshopify.com/proofs/file.txt");
      expect(result.publicUrl).toBeNull();
      expect(read.body.toString("utf8")).toBe("sealed evidence");
      expect(read.contentType).toBe("text/plain");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("deletes only the selected shop storage namespace", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "backstop-proof-"));
    const storage = new LocalStorageService(root);

    try {
      const deletedShopFile = await storage.write({
        shopDomain: "deleted-shop.myshopify.com",
        key: "proofs/file.txt",
        body: Buffer.from("remove me"),
        contentType: "text/plain",
      });
      const retainedShopFile = await storage.write({
        shopDomain: "retained-shop.myshopify.com",
        key: "proofs/file.txt",
        body: Buffer.from("keep me"),
        contentType: "text/plain",
      });

      await storage.deleteShopData("deleted-shop.myshopify.com");

      await expect(storage.read(deletedShopFile.storageKey)).rejects.toThrow();
      await expect(storage.read(retainedShopFile.storageKey)).resolves.toMatchObject({
        contentType: "text/plain",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
