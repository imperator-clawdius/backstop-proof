import { createHash } from "node:crypto";

export async function sha256Hex(input: Buffer | Uint8Array | ArrayBuffer): Promise<string> {
  const buffer = Buffer.isBuffer(input)
    ? input
    : input instanceof ArrayBuffer
      ? Buffer.from(input)
      : Buffer.from(input);
  return createHash("sha256").update(buffer).digest("hex");
}
