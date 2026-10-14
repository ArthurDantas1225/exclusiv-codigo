import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  images: {
    minimumCacheTTL: 2678400,
    remotePatterns: [{
      protocol: "https",
      hostname: "rznnojrtgolekdkcvxnv.supabase.co",
      pathname: "/storage/v1/object/**",
    }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
