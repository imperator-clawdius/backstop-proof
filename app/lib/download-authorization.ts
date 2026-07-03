export function assertDownloadAuthorized(input: {
  currentShopId: string;
  recordShopId: string | null | undefined;
  recordType: "Evidence pack" | "Proof file";
}) {
  if (!input.recordShopId || input.recordShopId !== input.currentShopId) {
    throw Object.assign(new Error(`${input.recordType} not found.`), { status: 404 });
  }
}
