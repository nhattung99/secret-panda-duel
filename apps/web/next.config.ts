import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  transpilePackages: ["@zama-fhe/sdk", "@zama-fhe/react-sdk"],
  webpack(config) {
    // The SDK uses feature checks available in 1.8.0. Newer releases use import.source,
    // which the webpack version bundled with Next.js cannot parse.
    config.resolve.alias["wasm-feature-detect$"] = require.resolve("wasm-feature-detect");
    return config;
  },
};

export default config;
