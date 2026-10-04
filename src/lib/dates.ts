// Deterministic on the server and client; never inherit the host timezone.
export function formatDateTime(value: Date | string | null) {
  return value ? `${new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC` : "—";
}
