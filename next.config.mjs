import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["agora-agent-server-sdk"],
  transpilePackages: [
    "agora-rtc-sdk-ng",
    "agora-rtm",
    "agora-agent-uikit",
    "agora-agent-client-toolkit",
  ],
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: rootDir,
  },
};

export default nextConfig;
