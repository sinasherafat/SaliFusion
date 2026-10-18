import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The E2E suite uses localhost and 127.0.0.1 as isolated browser origins to
  // verify that private media only moves when the user exports/imports a bundle.
  allowedDevOrigins: ["127.0.0.1"],
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
