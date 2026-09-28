import { z } from "zod";
export const notificationIdSchema = z.strictObject({ notificationId: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/) });
export const NOTIFICATION_PAGE_SIZE = 20;
export const NOTIFICATION_PREVIEW_SIZE = 5;
