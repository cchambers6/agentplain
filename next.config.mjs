/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
      {
        // The old pilot pricing model ($1,500 / $2,750 / $4,500 tiers, 30-day
        // paid pilot) was killed per project_stripe_both_surfaces.md. Old
        // /pilot links from outreach 308-redirect to home so they don't 404.
        source: "/pilot",
        destination: "/#pricing",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
