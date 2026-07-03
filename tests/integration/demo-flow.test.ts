import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runDemoEvidenceFlow } from "../../app/services/demo-flow.server";

describe("demo evidence flow", () => {
  it("creates sealed demo proof and a downloadable PDF without Shopify dispute access", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "backstop-demo-"));

    try {
      const result = await runDemoEvidenceFlow({ storageRoot: root });

      expect(result.demoMode).toBe(true);
      expect(result.proofCapture.status).toBe("SEALED");
      expect(result.proofFiles).toHaveLength(3);
      expect(result.evidencePack.completenessScore).toBeGreaterThanOrEqual(70);
      expect(result.pdfBytes.length).toBeGreaterThan(1000);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
