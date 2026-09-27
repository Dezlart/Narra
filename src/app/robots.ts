import type { MetadataRoute } from "next";
import { siteOrigin } from "@/features/public-content/metadata";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return origin ? {
    rules: { userAgent: "*", allow: ["/", "/api/public/articles/"], disallow: ["/dashboard", "/admin", "/editor", "/login", "/register", "/api/"] },
    sitemap: `${origin}/sitemap.xml`,
  } : { rules: { userAgent: "*", disallow: "/" } };
}
