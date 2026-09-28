import { getNotificationPreview } from "./queries";
import { NotificationBellClient } from "./bell-client";
export async function NotificationBell() {
  return <NotificationBellClient {...await getNotificationPreview()} />;
}
