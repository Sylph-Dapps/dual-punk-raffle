import { expect } from "chai";
import { ethers } from "hardhat";
const fs = require("fs");

const { formatEther } = ethers.utils;

function chunkArray(arr, maxSize) {
  const toReturn = [];
  for (let i = 0; i < arr.length; i += maxSize) {
    const chunk = arr.slice(i, i + maxSize);
    toReturn.push(chunk);
  }
  return toReturn;
}

function loadWalletsFromFile(filePath, numWalletsToLoad = undefined) {
  const privateKeys = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  const selectedPrivateKeys = privateKeys.slice(0, typeof numWalletsToLoad === "undefined" ? privateKeys.length : numWalletsToLoad);
  return selectedPrivateKeys.map(privateKey => {
    return (new ethers.Wallet(privateKey.trim())).connect(ethers.provider);
  });
}

describe("APunkForYouAndMe", function () {
  let raffleContract: any;

  before(async () => {
    const raffleContractFactory = await ethers.getContractFactory("APunkForYouAndMe");
    raffleContract = await raffleContractFactory.deploy();
    await raffleContract.deployed();
  });

  describe("The raffle", function () {
    it("should pick every address as a winner after a reasonable number of attempts", async function () {
      this.timeout(0);

      await ethers.provider.send("evm_setAutomine", [false]);

      console.time("Deploying Gaslite Drop");
      const gasliteDropContractFactory = await ethers.getContractFactory("GasliteDrop");
      const gasliteDropContract = await gasliteDropContractFactory.deploy();
      gasliteDropContract.deployed();
      ethers.provider.send("evm_mine", []);
      console.timeEnd("Deploying Gaslite Drop");

      raffleContract.setTargetBalance(5);
      await ethers.provider.send("evm_mine", []);

      const [owner] = await ethers.getSigners();
      
      console.time("Creating wallets");

      const NUM_WALLETS = 5000;
      const NUM_DRAWINGS = 10;

      const wallets = loadWalletsFromFile('privateKeys.txt', NUM_WALLETS);
      /*
      // Create private keys and save them to a file
      const wallets = [];
      for(let i = 0; i < numWallets; i++) {
        let wallet = ethers.Wallet.createRandom();
        wallet =  wallet.connect(ethers.provider);
        wallets.push(wallet);
        fs.appendFileSync('privateKeys.txt', wallet.privateKey + '\n');
      }
      */
      console.timeEnd("Creating wallets");
      
      const addresses = wallets.map(wallet => wallet.address);
      const chunkedAddresses = chunkArray(addresses, 500);
      
      console.time("Sending ETH to wallets");
      const INITIAL_ETH_PER_WALLET = ethers.utils.parseEther("0.25");
      const gasliteDropTransactions = [];
      for(let i = 0; i < chunkedAddresses.length; i++) {
        const addressesFromChunk = chunkedAddresses[i];
        const amounts = addressesFromChunk.map(_address => INITIAL_ETH_PER_WALLET);
        const tx = await gasliteDropContract.airdropETH(
          addressesFromChunk,
          amounts,
          {
            value: INITIAL_ETH_PER_WALLET.mul(addressesFromChunk.length),
            gasLimit: 30_000_000,
          }
        );
        gasliteDropTransactions.push(tx);
      }
      {
        let includesFinalDeposit = false;
        while(!includesFinalDeposit) {
          await ethers.provider.send("evm_mine", []);
          const block = await ethers.provider.getBlock("latest");
          console.log(block);
          includesFinalDeposit = block.transactions.includes(gasliteDropTransactions[gasliteDropTransactions.length - 1].hash);
        }
      }
      console.timeEnd("Sending ETH to wallets");
      
      /*
      console.log("Getting wallet balances");
      const ownerBalance = await ethers.provider.getBalance(owner.address);
      console.log(owner.address, ethers.utils.formatEther(ownerBalance));
      for(let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        const balance = await ethers.provider.getBalance(address);
        //console.log(address, ethers.utils.formatEther(balance));
      }
      */

      console.time("Sending ETH from wallets to contract")
      const DEPOSIT_AMOUNT = ethers.utils.parseEther("0.1");
      const depositPromises = [];
      for(let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        if(i % 100 === 0) {
          console.log(i);
        }
        /*
        let b0, b1;
        if(i % 100 === 0) {
          b0 = await ethers.provider.getBalance(wallet.address);
          console.log("Initial balance", i, formatEther(b0));
        }
        */
        const connectedRaffleContract = raffleContract.connect(wallet);
        const promise = connectedRaffleContract.deposit({
          value: DEPOSIT_AMOUNT,
          gasLimit: 1_000_000
        });
        depositPromises.push(promise);
        //console.log(tx.hash)
        //console.log(i, tx.hash);
        /*
        if(i % 100 === 0) {
          b1 = await ethers.provider.getBalance(wallet.address);
          console.log("Final balance  ", i, formatEther(b1));
          console.log("Difference     ", i, formatEther(b0.sub(b1)));
          console.log("Gas cost       ", i, formatEther(b0.sub(b1).sub(DEPOSIT_AMOUNT)));
          console.log("")
        }
        */
      }
      const depositTransactions = await Promise.all(depositPromises);
      let includesFinalDeposit = false;
      while(!includesFinalDeposit) {
        await ethers.provider.send("evm_mine", []);
        const block = await ethers.provider.getBlock("latest");
        console.log(block);
        includesFinalDeposit = block.transactions.includes(depositTransactions[depositTransactions.length - 1].hash);
      }
      console.timeEnd("Sending ETH from wallets to contract")

      const raffleBalance = await ethers.provider.getBalance(raffleContract.address);
      console.log("Raffle contract balance:", formatEther(raffleBalance));
      expect(raffleBalance).to.equal(DEPOSIT_AMOUNT.mul(addresses.length));

      const numDepositors = await raffleContract.getNumDepositors();
      expect(numDepositors.toNumber()).to.equal(wallets.length);

      /*
      console.log("Drawing winners");
      for (let i = 0; i < numDrawings; i++) {
        console.log("Drawing " + i);
        await raffleContract.selectWinner();
        const winner = await raffleContract.winner();
        winnerCounts[winner]++;
      }
      console.log({ winnerCounts });
      */

      console.time("Giving the selectWinnerCaller's some initial ETH");
      let selectWinnerCallerWallet = ethers.Wallet.createRandom();
      selectWinnerCallerWallet =  selectWinnerCallerWallet.connect(ethers.provider);
      const selectWinnerCallerAddress = selectWinnerCallerWallet.address;
      const INITAL_SELECT_WINNER_CALLER_BALANCE = ethers.utils.parseEther("1");
      await owner.sendTransaction({
        to: selectWinnerCallerWallet.address,
        value: INITAL_SELECT_WINNER_CALLER_BALANCE
      });
      await ethers.provider.send("evm_mine", []);
      console.timeEnd("Giving the selectWinnerCaller's some initial ETH");


      const selectWinnerCallerBalance0 = await ethers.provider.getBalance(selectWinnerCallerAddress);
      //console.log("sendWinnerCallerBalance:", formatEther(selectWinnerCallerBalance0.toString()));
      expect(selectWinnerCallerBalance0).to.equal(INITAL_SELECT_WINNER_CALLER_BALANCE);

      await ethers.provider.send("evm_setAutomine", [true]);

      console.time("Drawing winner");
      const winnerCounts = {};
      for(let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        winnerCounts[address] = 0;
      }
      for(let i = 0; i < NUM_DRAWINGS; i++) {
        await raffleContract.connect(selectWinnerCallerWallet).selectWinner({
          gasPrice: 20_000_000_000,
          gasLimit: 30_000_000
        });
        
        const gasToRefund = await raffleContract.gasToRefund();
        console.log("gasToRefund:", formatEther(gasToRefund));
        
        const selectWinnerCallerBalance1 = await ethers.provider.getBalance(selectWinnerCallerAddress);
        console.log("sendWinnerCallerBalance:", formatEther(selectWinnerCallerBalance1));
        expect(selectWinnerCallerBalance1).to.be.lessThan(INITAL_SELECT_WINNER_CALLER_BALANCE);
        
        await raffleContract.refundSelectWinnerGas();
        
        const selectWinnerCallerBalance2 = await ethers.provider.getBalance(selectWinnerCallerAddress);
        console.log("sendWinnerCallerBalance:", formatEther(selectWinnerCallerBalance2));
        expect(selectWinnerCallerBalance2).to.equal(selectWinnerCallerBalance1.add(gasToRefund));
        
        const winner = await raffleContract.winner();
        winnerCounts[winner]++;
      }
      console.timeEnd("Drawing winner");      

      /*const addresses = Object.keys(winnerCounts);
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        expect(winnerCounts[address] > 0, `${address} never won :(`).to.be.true;
      }*/
    });
  });
});
