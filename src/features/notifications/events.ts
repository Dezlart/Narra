import "server-only";
import type { Prisma } from "@/generated/prisma/client";

// Internal only: callers supply their existing business transaction, never a client payload.
export async function createNotification(tx: Prisma.TransactionClient, data: Prisma.NotificationCreateManyInput) {
  if (!await tx.user.findFirst({ where: { id: data.recipientId, isBanned: false }, select: { id: true } })) return;
  await tx.notification.createMany({ data: [data], skipDuplicates: true });
}

export async function createFollowerPublicationNotifications(tx: Prisma.TransactionClient, articleId: string, authorId: string) {
  // One INSERT SELECT, bounded application memory, one transaction with approval.
  // Recipients are the active followers at this statement's PostgreSQL snapshot.
  await tx.$executeRaw`
    INSERT INTO "Notification" (id, "recipientId", "actorId", type, "articleId", "eventKey")
    SELECT gen_random_uuid()::text, f."followerId", ${authorId},
      'FOLLOWED_AUTHOR_PUBLISHED'::"NotificationType", ${articleId}, ${`publication:${articleId}`}
    FROM "Follow" f
    JOIN "User" recipient ON recipient.id = f."followerId" AND NOT recipient."isBanned"
    JOIN "User" author ON author.id = f."followingId" AND NOT author."isBanned"
    WHERE f."followingId" = ${authorId} AND f."followerId" <> ${authorId}
    ON CONFLICT ("recipientId", "eventKey") DO NOTHING`;
}
