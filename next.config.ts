import type { NextConfig } from "next";

function normalizeBasePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

const configuredBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || process.env.APP_BASE_PATH || "");
const basePath = process.env.NODE_ENV === "development" ? "" : configuredBasePath;

const nextConfig: NextConfig = {
  assetPrefix: basePath || undefined,
  basePath: basePath || undefined,
  images: {
    unoptimized: true,
  },
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
