import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net https://www.instagram.com",
  "connect-src 'self' https: wss:",
  "form-action 'self'",
  "frame-src https://www.google.com https://maps.google.com",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  basePath: "/verifica",
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/verifica/login",
        permanent: false,
        basePath: false,
      },
      {
        source: "/login/:path*",
        destination: "/verifica/login/:path*",
        permanent: false,
        basePath: false,
      },
      {
        source: "/setup",
        destination: "/verifica/setup",
        permanent: false,
        basePath: false,
      },
      {
        source: "/setup/:path*",
        destination: "/verifica/setup/:path*",
        permanent: false,
        basePath: false,
      },
      {
        source: "/app/:path*",
        destination: "/verifica/app/:path*",
        permanent: false,
        basePath: false,
      },
      {
        source: "/operador/:path*",
        destination: "/verifica/operador/:path*",
        permanent: false,
        basePath: false,
      },
      {
        source: "/admin/:path*",
        destination: "/verifica/admin/:path*",
        permanent: false,
        basePath: false,
      },
      {
        source: "/admin",
        destination: "/verifica/admin",
        permanent: false,
        basePath: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
