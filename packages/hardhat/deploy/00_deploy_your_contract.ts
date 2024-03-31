import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const {
  parseEther,
  formatEther,
} = ethers.utils;

/**
 * Deploys a contract named "YourContract" using the deployer account and
 * constructor arguments set to the deployer address
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployYourContract: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  /*
    On localhost, the deployer account is the one that comes with Hardhat, which is already funded.

    When deploying to live networks (e.g `yarn deploy --network goerli`), the deployer account
    should have sufficient balance to pay for the gas fees for contract creation.

    You can generate a random account with `yarn generate` which will fill DEPLOYER_PRIVATE_KEY
    with a random private key in the .env file (then used on hardhat.config.ts)
    You can run the `yarn account` command to check your balance in every network.
  */
  //const { deployer } = await hre.getNamedAccounts();
  //const { deploy } = hre.deployments;

  const punkOwner = (await ethers.getSigners())[0];

  const cryptoPunksMarketContractFactory = await ethers.getContractFactory("CryptoPunksMarket");
  const punksContract = await cryptoPunksMarketContractFactory.deploy()
  await punksContract.deployed();
  console.log("Deployed CryptoPunksMarket at", punksContract.address);

  await punksContract.setInitialOwners(
    Array.from({ length: 100 }, () => punkOwner.address),
    Array.from({ length: 100 }, (_, index) => index)
  );
  await punksContract.allInitialOwnersAssigned();
  console.log("Initial punk owner set to", punkOwner.address);

  const raffleContractFactory = await ethers.getContractFactory("APunkForYouAndMe");
  const raffleContract = await raffleContractFactory.deploy();
  await raffleContract.deployed();
  console.log("Deployed APunkForYouAndMe at", raffleContract.address);

  const referralPointsCalculatorContractFactory = await ethers.getContractFactory("ReferralPointsCalculator");
  const calculatorContract = await referralPointsCalculatorContractFactory.deploy();
  console.log("Deployed ReferralPointsCalculator at", calculatorContract.address);
  
  await raffleContract.setPunksContract(punksContract.address);
  console.log(`Linked APunkForYouAndMe to CryptoPunksMarket`);

  await raffleContract.setEntryCalculator(calculatorContract.address);
  console.log(`Linked APunkForYouAndMe to ReferralPointsCalculator`);

  await calculatorContract.setReferrerLookup(raffleContract.address);
  console.log(`Linked ReferralPointsCalculator to APunkForYouAndMe`);

  const targetBalance = parseEther("150");
  await raffleContract.setTargetBalance(targetBalance);
  console.log(`Target balance set to ${formatEther(targetBalance)}`);
};

export default deployYourContract;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags YourContract
deployYourContract.tags = ["APunkForYouAndMe"];
