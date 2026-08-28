import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@cornerstonejs/core",
    "@cornerstonejs/dicom-image-loader",
    "@cornerstonejs/metadata",
    "@cornerstonejs/tools",
  ],
  webpack(config) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    return config;
  },
};

export default nextConfig;
