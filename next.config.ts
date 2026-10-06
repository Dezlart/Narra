import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ...(process.env.VERCEL_ENV === "preview" ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
    ] }];
  },
  // Never let the optimizer cache guarded image routes after publication changes.
  // All article images are already sanitized WebP and use unoptimized next/image.
  images: { localPatterns: [{ pathname: "/public-assets/**" }] },
};

export default nextConfig;
