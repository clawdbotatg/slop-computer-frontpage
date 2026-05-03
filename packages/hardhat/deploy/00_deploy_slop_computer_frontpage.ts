import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploySlopComputerFrontpage: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute } = hre.deployments;

  const result = await deploy("SlopComputerFrontpage", {
    from: deployer,
    args: [deployer],
    log: true,
    autoMine: true,
  });

  if (result.newlyDeployed) {
    await execute(
      "SlopComputerFrontpage",
      { from: deployer, log: true },
      "addEpisode",
      "Episode 0 — Slop is live",
      "2026-05-02",
      "00:00",
      "Placeholder. Real episodes start soon.",
      "QmPlaceholderPlaceholderPlaceholderPlaceholderPlaceholder",
    );
  }
};

export default deploySlopComputerFrontpage;
deploySlopComputerFrontpage.tags = ["SlopComputerFrontpage"];
