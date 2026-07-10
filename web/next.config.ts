import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  // Empacota um server Node autocontido em .next/standalone — é isso que o
  // Electron roda localmente pra abrir o app sem depender da Vercel.
  output: "standalone",
};

export default nextConfig;
