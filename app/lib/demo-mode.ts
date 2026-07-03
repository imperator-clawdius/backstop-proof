export function shouldUseDemoContext(): boolean {
  return process.env.ENABLE_DEMO_MODE === "true" && process.env.SHOPIFY_API_KEY === "demo";
}

export function shouldUseReadOnlyDemoDisputeFallback({
  currentShopIsDemo,
  demoDisputeParam,
}: {
  currentShopIsDemo: boolean;
  demoDisputeParam: string | null;
}): boolean {
  return (
    process.env.ENABLE_DEMO_MODE === "true" &&
    !currentShopIsDemo &&
    demoDisputeParam === "true"
  );
}
