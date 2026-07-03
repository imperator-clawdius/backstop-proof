export const MAX_PROOF_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED_PROOF_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export type ProofUploadMetadata = {
  filename: string;
  mimeType: string;
  byteSize: number;
};

export function validateProofUpload(input: ProofUploadMetadata): ProofUploadMetadata {
  const mimeType = input.mimeType.trim().toLowerCase();
  const byteSize = Number(input.byteSize);

  if (!ALLOWED_PROOF_MIME_TYPES.has(mimeType)) {
    throw new Error("Unsupported proof file type.");
  }

  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    throw new Error("Proof file is empty.");
  }

  if (byteSize > MAX_PROOF_UPLOAD_BYTES) {
    throw new Error("Proof file is too large.");
  }

  return {
    filename: sanitizeUploadFilename(input.filename),
    mimeType,
    byteSize,
  };
}

export function sanitizeUploadFilename(filename: string): string {
  const trimmed = filename.trim() || `proof-${Date.now()}`;
  return trimmed
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 160);
}
