import type { DeployFunction } from "hardhat-deploy/types";

const deployDuel: DeployFunction = async ({ deployments, getNamedAccounts, network }) => {
  const { deployer } = await getNamedAccounts();
  const deployment = await deployments.deploy("SecretPandaDuel", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: network.name === "sepolia" ? 2 : 1,
  });
  console.log(`SecretPandaDuel on ${network.name}: ${deployment.address}`);
};

deployDuel.tags = ["duel"];
export default deployDuel;
