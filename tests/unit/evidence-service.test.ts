import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import deliveredOrder from "../../fixtures/shopify/order.physical-delivered.json";
import dispute from "../../fixtures/shopify/dispute.item-not-received.json";
import type { ShopContext } from "../../app/services/shop-context.server";

const boundary = vi.hoisted(() => ({
  proof: vi.fn(),
  createPack: vi.fn(),
  auditEvents: vi.fn(),
  write: vi.fn(),
  pdf: vi.fn(),
  order: vi.fn(),
  dispute: vi.fn(),
}));
vi.mock("../../app/db.server", () => ({ default: {
  proofCapture: { findFirst: boundary.proof },
  evidencePack: { create: boundary.createPack },
  auditEvent: { findMany: boundary.auditEvents },
} }));
vi.mock("../../app/services/audit.server", () => ({
  createAuditEvent: vi.fn(), normalizeJson: (value: unknown) => value,
}));
vi.mock("../../app/services/notifications.server", () => ({ createNotification: vi.fn() }));
vi.mock("../../app/services/pdf.server", () => ({ generateEvidencePdf: boundary.pdf }));
vi.mock("../../app/services/storage.server", () => ({ getStorageService: () => ({ write: boundary.write }) }));
vi.mock("../../app/services/shopify-graphql.server", () => ({
  ShopifyGraphqlService: class {
    getOrder = boundary.order;
    getDispute = boundary.dispute;
  },
}));
import { generateEvidencePack } from "../../app/services/evidence.server";

const context = {
  shop: { id: "shop_test", settings: {} },
  shopDomain: "test.myshopify.com", admin: {}, demoMode: false, accessScopes: [],
} as unknown as ShopContext;

describe("evidence generation service boundaries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    boundary.order.mockResolvedValue(deliveredOrder);
    boundary.dispute.mockResolvedValue(dispute);
    boundary.proof.mockResolvedValue(null);
    boundary.auditEvents.mockResolvedValue([]);
    boundary.pdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    boundary.write.mockImplementation(async ({ key }) => ({ storageKey: `test.myshopify.com/${key}` }));
    boundary.createPack.mockImplementation(async ({ data }) => ({ id: "database_generated_id", ...data }));
  });
  afterEach(() => vi.restoreAllMocks());

  it("uses the persisted pack ID in its PDF and storage path", async () => {
    const { pack } = await generateEvidencePack({ context, orderId: deliveredOrder.id });
    const renderedId = boundary.pdf.mock.calls[0][0].packId;
    expect(pack.id).toBe(renderedId);
    expect(pack.pdfStorageKey).toBe(`test.myshopify.com/evidence-packs/${pack.id}.pdf`);
  });

  it("keeps simultaneous generations in distinct files even in the same millisecond", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1790949600000);
    await Promise.all([
      generateEvidencePack({ context, orderId: deliveredOrder.id }),
      generateEvidencePack({ context, orderId: deliveredOrder.id }),
    ]);
    expect(new Set(boundary.write.mock.calls.map(([input]) => input.key)).size).toBe(2);
  });

  it("rejects an explicitly selected proof that is missing or belongs to another shop", async () => {
    await expect(generateEvidencePack({ context, orderId: deliveredOrder.id, proofCaptureId: "other_shop_proof" }))
      .rejects.toThrow(/proof capture.*not.*found/i);
    expect(boundary.proof).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "other_shop_proof", shopId: context.shop.id },
    }));
    expect(boundary.write).not.toHaveBeenCalled();
    expect(boundary.createPack).not.toHaveBeenCalled();
  });

  it("rejects a dispute for a different order before creating an evidence pack", async () => {
    boundary.dispute.mockResolvedValue({ ...dispute, order: { id: "gid://shopify/Order/9999" } });
    await expect(generateEvidencePack({ context, orderId: deliveredOrder.id, disputeId: dispute.id }))
      .rejects.toThrow(/dispute.*order/i);
    expect(boundary.write).not.toHaveBeenCalled();
    expect(boundary.createPack).not.toHaveBeenCalled();
  });

  it("rejects an unavailable requested dispute instead of attaching an unverified ID", async () => {
    boundary.dispute.mockResolvedValue(null);
    await expect(generateEvidencePack({ context, orderId: deliveredOrder.id, disputeId: dispute.id }))
      .rejects.toThrow(/dispute.*not.*found/i);
    expect(boundary.write).not.toHaveBeenCalled();
    expect(boundary.createPack).not.toHaveBeenCalled();
  });

  it("still generates a manual pack without a dispute or proof capture", async () => {
    const result = await generateEvidencePack({ context, orderId: deliveredOrder.id });
    expect(result.order.id).toBe(deliveredOrder.id);
    expect(result.proofCapture).toBeNull();
    expect(result.dispute).toBeNull();
    expect(boundary.write).toHaveBeenCalledOnce();
  });

  it("keeps a matching dispute and selected shop-owned proof attached", async () => {
    boundary.proof.mockResolvedValue({
      id: "proof_test", shopId: context.shop.id, shopifyOrderId: deliveredOrder.id,
      status: "SEALED", files: [],
    });
    const { pack } = await generateEvidencePack({
      context, orderId: deliveredOrder.id, disputeId: dispute.id, proofCaptureId: "proof_test",
    });
    expect(pack.disputeId).toBe(dispute.id);
    expect(pack.proofCaptureId).toBe("proof_test");
  });
});
