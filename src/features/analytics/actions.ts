"use server";
import { cookies } from "next/headers";
import { analyticsSecret, issueVisitor, validVisitor, VISITOR_COOKIE, VISITOR_LIFETIME } from "./identity";
import { registerArticleView } from "./service";
// Two steps: establish cookie first; never count a cookie-less concurrent request.
export async function prepareVisitorAction() {
  const secret = analyticsSecret();
  if (!secret) return false;
  const jar = await cookies();
  if (!validVisitor(jar.get(VISITOR_COOKIE)?.value, secret)) jar.set(VISITOR_COOKIE, issueVisitor(secret), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: VISITOR_LIFETIME,
  });
  return true;
}
export async function registerArticleViewAction(articleId: unknown) {
  try { return await registerArticleView(articleId, (await cookies()).get(VISITOR_COOKIE)?.value ?? ""); }
  catch { return { counted: false }; } // Analytics must never interrupt reading.
}
