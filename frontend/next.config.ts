import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      { source: "/credits", destination: "/billing", permanent: true },
    ];
  },
};

export default nextConfig;
