import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  images: { minimumCacheTTL: 2678400, remotePatterns: [
    { protocol: "https", hostname: "sduacssupdhzwqmlijqv.supabase.co", pathname: "/storage/v1/object/**" },
    { protocol: "https", hostname: "rznnojrtgolekdkcvxnv.supabase.co", pathname: "/storage/v1/object/**" },
  ] },
};
export default config;
