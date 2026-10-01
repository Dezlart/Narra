import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export const VISITOR_COOKIE = "narra-view-visitor";
export const VISITOR_LIFETIME = 86400;
export function analyticsSecret() { const value = process.env.ANALYTICS_HASH_SECRET; return value && value.length >= 32 ? value : null; }
export function utcBucket(now: Date) { return new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`); }
const sign = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("hex");
export function issueVisitor(secret: string, now = new Date()) {
  const value = `${Math.floor(now.getTime() / 1000)}.${randomBytes(32).toString("hex")}`;
  return `${value}.${sign(`cookie:${value}`, secret)}`;
}
export function validVisitor(token: string | undefined, secret: string, now = new Date()): token is string {
  if (!token || !/^\d{10}\.[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)) return false;
  const [time, nonce, signature] = token.split(".");
  const age = now.getTime() / 1000 - Number(time);
  return age >= 0 && age < VISITOR_LIFETIME && timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(`cookie:${time}.${nonce}`, secret), "hex"));
}
export function visitorHash(token: string, articleId: string, bucket: Date, secret: string) {
  return sign(JSON.stringify(["view", articleId, bucket.toISOString(), token]), secret);
}
