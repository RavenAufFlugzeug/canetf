import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Page-to-page transitions (app/template.tsx).
    viewTransition: true,
  },
  async redirects() {
    return [
      // The Companies page became the Watch List; keep old links working.
      { source: "/companies", destination: "/watchlist", permanent: false },
      // The company lookup page became Search (the ?symbol= query is carried over).
      { source: "/company", destination: "/search", permanent: false },
    ];
  },
};

export default nextConfig;
