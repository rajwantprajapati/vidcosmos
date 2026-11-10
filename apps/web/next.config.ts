import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: [
    "@vidcosmos/spec",
    "@vidcosmos/video",
    "@vidcosmos/pipeline",
    "@vidcosmos/integrations",
  ],
};

export default nextConfig;
