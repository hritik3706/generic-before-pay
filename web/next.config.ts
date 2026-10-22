import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    const target = process.env.OCR_BACKEND_URL ?? "http://127.0.0.1:8000";
    return [{ source: "/v1/:path*", destination: `${target}/v1/:path*` }];
  },
};

export default nextConfig;
