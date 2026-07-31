/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lean, self-contained server output for Docker.
  output: "standalone",
  // Proxy API calls to the FastAPI backend during development.
  // In production, Caddy routes /api and /files to the backend before Next sees them.
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8009";
    return [
      { source: "/api/:path*", destination: `${api}/:path*` },
      { source: "/files/:path*", destination: `${api}/files/:path*` },
    ];
  },
};
export default nextConfig;
