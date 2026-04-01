/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // must be false — piper uses singleton WASM state
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Required for ONNX Runtime WASM
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Allow importing WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },
  // Headers needed for SharedArrayBuffer (required by ONNX WASM multi-threaded mode)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
