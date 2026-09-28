import "server-only";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { lockSocialUsers, socialTransactionOptions } from "@/features/social/transaction";
import { SocialError } from "@/features/social/errors";
import { notificationIdSchema } from "./schemas";
import { getOwnedNotificationView } from "./queries";

export async function markNotificationAsRead(input: unknown, requestHeaders?: Headers) {
  const { notificationId } = notificationIdSchema.parse(input);
  const user = await requireAuth(requestHeaders);
  return getPrisma().$transaction(async (tx) => {
    await lockSocialUsers(tx, user.id);
    const view = await getOwnedNotificationView(tx, user.id, notificationId);
    if (!view) throw new SocialError("NOT_FOUND", "Уведомление недоступно.");
    await tx.notification.updateMany({ where: { id: notificationId, recipientId: user.id, readAt: null }, data: { readAt: new Date() } });
    return { href: view.href };
  }, socialTransactionOptions);
}
export async function markAllNotificationsAsRead(requestHeaders?: Headers) {
  const user = await requireAuth(requestHeaders);
  return getPrisma().$transaction(async (tx) => {
    await lockSocialUsers(tx, user.id);
    await tx.notification.updateMany({ where: { recipientId: user.id, readAt: null }, data: { readAt: new Date() } });
  }, socialTransactionOptions);
}
