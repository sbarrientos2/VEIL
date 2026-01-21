/** @type {import('next').NextConfig} */
const nextConfig = {
  // Handle Solana wallet adapter issues
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    return config;
  },
  // Transpile SDK
  transpilePackages: ["@veil/sdk"],
};

module.exports = nextConfig;
