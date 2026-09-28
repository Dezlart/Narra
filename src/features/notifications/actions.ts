"use server";
import { socialAction } from "@/features/social/action-result";
import { markNotificationAsRead, markAllNotificationsAsRead } from "./service";
export async function readNotificationAction(input: unknown) {
  return socialAction(() => markNotificationAsRead(input));
}
export async function readAllNotificationsAction() {
  return socialAction(() => markAllNotificationsAsRead());
}
