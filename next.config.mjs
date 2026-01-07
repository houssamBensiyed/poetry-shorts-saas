/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "bcryptjs",
      "bullmq",
      "ioredis",
      "cloudinary",
    ],
  },
};

export default nextConfig;
