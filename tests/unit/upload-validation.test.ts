import { describe, expect, it } from "vitest";
import {
  MAX_PROOF_UPLOAD_BYTES,
  validateProofUpload,
} from "../../app/lib/upload-validation";

describe("validateProofUpload", () => {
  it("allows expected proof evidence file types", () => {
    for (const mimeType of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      expect(() =>
        validateProofUpload({
          filename: "proof-file",
          mimeType,
          byteSize: 1024,
        }),
      ).not.toThrow();
    }
  });

  it("rejects executable, script, html, svg, and unsafe video uploads", () => {
    for (const mimeType of [
      "text/html",
      "image/svg+xml",
      "application/javascript",
      "application/x-msdownload",
      "video/mp4",
    ]) {
      expect(() =>
        validateProofUpload({
          filename: "unsafe-file",
          mimeType,
          byteSize: 1024,
        }),
      ).toThrow("Unsupported proof file type.");
    }
  });

  it("rejects files over the configured proof upload size limit", () => {
    expect(() =>
      validateProofUpload({
        filename: "oversized-proof.jpg",
        mimeType: "image/jpeg",
        byteSize: MAX_PROOF_UPLOAD_BYTES + 1,
      }),
    ).toThrow("Proof file is too large.");
  });
});
