import { ethers } from "ethers";
import * as fs from "fs";

const {
  parseEther,
  formatEther,
} = ethers.utils;

function writeWalletsToFile(count) {
  const wallets = [];
  for(let i = 0; i < count; i++) {
    let wallet = ethers.Wallet.createRandom();
    wallet =  wallet.connect(ethers.provider);
    wallets.push(wallet);
    fs.appendFileSync('privateKeys.txt', wallet.privateKey + '\n');
  }
}

async function main() {
  //writeWalletsToFile(20000);

  let x = ethers.BigNumber.from(1);
  for(let i = 0; i < 75; i++) {
    console.log(i, formatEther(x));
    x = x.mul(2);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
