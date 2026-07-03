export function assertShopScoped({
  currentShopId,
  recordShopId,
}: {
  currentShopId: string;
  recordShopId: string | null | undefined;
}) {
  if (!recordShopId || recordShopId !== currentShopId) {
    throw Object.assign(new Error("Record does not belong to this shop."), {
      status: 403,
    });
  }
}
