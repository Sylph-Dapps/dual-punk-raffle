import { ethers } from "ethers";
import * as fs from "fs";

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
  writeWalletsToFile(20000);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
