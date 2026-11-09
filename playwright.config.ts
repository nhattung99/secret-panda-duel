import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3015";

export default defineConfig({
  testDir: "./apps/web/tests",
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL || "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -w @panda/web -- --hostname 127.0.0.1 --port 3015",
    url: baseURL,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_CHAIN_ID: "11155111",
      NEXT_PUBLIC_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000042",
      NEXT_PUBLIC_SEPOLIA_RPC_URL: `${baseURL}/test-rpc`,
    },
  },
});
