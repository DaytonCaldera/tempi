import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["http://localhost:3000", "http://192.168.100.74:3000"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        // The service worker must never be served stale: a new version replaces the old one on the next visit
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      {
        source: "/:path*",
        headers: [
          // No other site may frame the app (clickjacking on admin actions)
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The camera only for the app itself: the barcode scanner (components/scanner/BarcodeScanner.tsx)
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          // Browsers ignore it over plain http, so local development is unaffected
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
