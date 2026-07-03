import { afterEach, describe, expect, it } from "vitest";
import {
  shouldUseDemoContext,
  shouldUseReadOnlyDemoDisputeFallback,
} from "../../app/lib/demo-mode";

const originalEnv = { ...process.env };

describe("demo mode context", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("allows unauthenticated demo context only for the explicit standalone demo key", () => {
    process.env.ENABLE_DEMO_MODE = "true";
    process.env.SHOPIFY_API_KEY = "demo";

    expect(shouldUseDemoContext()).toBe(true);
  });

  it("does not let query params bypass Shopify auth for real app credentials", () => {
    process.env.ENABLE_DEMO_MODE = "true";
    process.env.SHOPIFY_API_KEY = "real-key";

    expect(shouldUseDemoContext()).toBe(false);
  });

  it("does not let headers bypass Shopify auth for real app credentials", () => {
    process.env.ENABLE_DEMO_MODE = "true";
    process.env.SHOPIFY_API_KEY = "real-key";

    expect(shouldUseDemoContext()).toBe(false);
  });

  it("allows read-only demo disputes for authenticated real shops without enabling demo context", () => {
    process.env.ENABLE_DEMO_MODE = "true";
    process.env.SHOPIFY_API_KEY = "real-key";

    expect(
      shouldUseReadOnlyDemoDisputeFallback({
        currentShopIsDemo: false,
        demoDisputeParam: "true",
      }),
    ).toBe(true);
    expect(shouldUseDemoContext()).toBe(false);
  });

  it("blocks demo dispute fallback when demo mode is disabled", () => {
    process.env.ENABLE_DEMO_MODE = "false";
    process.env.SHOPIFY_API_KEY = "real-key";

    expect(
      shouldUseReadOnlyDemoDisputeFallback({
        currentShopIsDemo: false,
        demoDisputeParam: "true",
      }),
    ).toBe(false);
  });

  it("does not use read-only demo dispute fallback inside standalone demo context", () => {
    process.env.ENABLE_DEMO_MODE = "true";
    process.env.SHOPIFY_API_KEY = "demo";

    expect(
      shouldUseReadOnlyDemoDisputeFallback({
        currentShopIsDemo: true,
        demoDisputeParam: "true",
      }),
    ).toBe(false);
  });
});
