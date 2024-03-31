import { ethers } from "hardhat";

const selectWinner = async function () {
  const raffleContractFactory = await ethers.getContractFactory("APunkForYouAndMe");
  const raffleContract = raffleContractFactory.attach("0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9");

  await raffleContract.selectWinner();
  const winner = await raffleContract.winner();
  console.log("Winner:", winner);
};

async function main() {
  await selectWinner();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
