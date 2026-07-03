import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../app/lib/crypto.server";

describe("sha256Hex", () => {
  it("returns the known SHA-256 hash for a file buffer", async () => {
    await expect(sha256Hex(Buffer.from("abc"))).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("changes when file bytes change", async () => {
    const first = await sha256Hex(Buffer.from("packed item A"));
    const second = await sha256Hex(Buffer.from("packed item B"));

    expect(first).not.toBe(second);
  });
});
