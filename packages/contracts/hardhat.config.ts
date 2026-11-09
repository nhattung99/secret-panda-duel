import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "hardhat-deploy";
import { task, subtask, type HardhatUserConfig } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(__dirname, "../../.env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async ({ solcVersion }, _hre, runSuper) => {
  if (solcVersion !== "0.8.27") return runSuper();
  return {
    compilerPath: require.resolve("solc/soljson.js"),
    isSolcJs: true,
    version: solcVersion,
    longVersion: require("solc").version(),
  };
});

task("deploy").setAction(async (args, hre, runSuper) => {
  if (hre.network.name === "sepolia") {
    if (!process.env.SEPOLIA_RPC_URL || !process.env.DEPLOYER_PRIVATE_KEY) {
      throw new Error("Set SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY in the root environment.");
    }
    if ((await hre.ethers.provider.getNetwork()).chainId !== 11155111n) {
      throw new Error("SEPOLIA_RPC_URL must point to Ethereum Sepolia.");
    }
  }
  return runSuper(args);
});

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: { optimizer: { enabled: true, runs: 800 }, evmVersion: "cancun" },
  },
  namedAccounts: { deployer: 0 },
  networks: {
    hardhat: { chainId: 31337 },
    sepolia: {
      chainId: 11155111,
      url: process.env.SEPOLIA_RPC_URL ?? "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY ?? "" },
};

export default config;
