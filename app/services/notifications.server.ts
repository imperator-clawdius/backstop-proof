import prisma from "../db.server";

export async function createNotification(input: {
  shopId: string;
  type: string;
  title: string;
  body: string;
  status?: "UNREAD" | "READ" | "SENT";
}) {
  return prisma.notification.create({
    data: {
      shopId: input.shopId,
      type: input.type,
      title: input.title,
      body: input.body,
      status: input.status ?? "UNREAD",
    },
  });
}

export async function listUnreadNotifications(shopId: string) {
  return prisma.notification.findMany({
    where: { shopId, status: "UNREAD" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}
