import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["http://localhost:3000", "http://192.168.100.74:3000"],
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
