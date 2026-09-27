import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Never let the optimizer cache guarded image routes after publication changes.
  // All article images are already sanitized WebP and use unoptimized next/image.
  images: { localPatterns: [{ pathname: "/public-assets/**" }] },
};

export default nextConfig;
