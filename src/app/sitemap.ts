import type { MetadataRoute } from "next";
import { siteOrigin } from "@/features/public-content/metadata";
import { getPublicSitemapPaths } from "@/features/public-content/sitemap";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  if (!origin) return [];
  return (await getPublicSitemapPaths()).map(({ path, ...metadata }) => ({ url: origin + path, ...metadata }));
}
