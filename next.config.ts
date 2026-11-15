import type { NextConfig } from "next";

/**
 * Rafterlore's own domain serves the same deployment as the Trash site. On that host, the root is
 * Rafterlore's home and the Trash site's pages send visitors there instead. Matched by host in the
 * routing layer, so the Trash site itself pays nothing for it.
 */
const RAFTERLORE_HOST = [{ type: "host" as const, value: "(?:www\\.)?rafterlore\\.com" }];

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", has: RAFTERLORE_HOST, destination: "/l" },
        // Browsers and search engines that ask rafterlore.com for /favicon.ico get the R, not Trash's icon.
        { source: "/favicon.ico", has: RAFTERLORE_HOST, destination: "/brand/rafterlore.ico" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    return [
      { source: "/:page(live|front-office|managers|rivals|history|stats)", has: RAFTERLORE_HOST, destination: "/", permanent: false },
      { source: "/managers/:id*", has: RAFTERLORE_HOST, destination: "/", permanent: false },
    ];
  },
  cacheComponents: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "sleepercdn.com" }] },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
