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

function writeWalletsToFile() {
  const wallets = [];
  for(let i = 0; i < 20000; i++) {
    let wallet = ethers.Wallet.createRandom();
    wallet =  wallet.connect(ethers.provider);
    wallets.push(wallet);
    fs.appendFileSync('privateKeys.txt', wallet.privateKey + '\n');
  }
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
  let punksContract: any;
  let punksReaderContract: any;

  beforeEach(async () => {
    const cryptoPunksMarketContractFactory = await ethers.getContractFactory("CryptoPunksMarket");
    punksContract = await cryptoPunksMarketContractFactory.deploy()
    await punksContract.deployed();
    console.log("punksContract:", punksContract.address);

    const cryptoPunksMarketReaderContractFactory = await ethers.getContractFactory("CryptoPunksMarketReader");
    punksReaderContract = await cryptoPunksMarketReaderContractFactory.deploy();
    await punksReaderContract.deployed();
    await punksReaderContract.setPunksContract(punksContract.address);
    console.log("punksReaderContract:", punksReaderContract.address);

    const raffleContractFactory = await ethers.getContractFactory("APunkForYouAndMe");
    raffleContract = await raffleContractFactory.deploy();
    await raffleContract.deployed();
    await raffleContract.setPunksContract(punksContract.address);
    console.log("raffleContract:", raffleContract.address);
  });

  describe("The raffle", function () {
    it("should pick every address as a winner after a reasonable number of attempts", async function () {
      this.timeout(0);

      const INITIAL_ETH_PER_WALLET = ethers.utils.parseEther("1.25");
      const DEPOSIT_AMOUNT = ethers.utils.parseEther("1");
      const TARGET_BALANCE = ethers.utils.parseEther("150");
      const PUNK_ID_1 = 42;
      const PUNK_ID_2 = 10;
      const PUNK_ID_3 = 5;
      const PUNK_COST_1 = ethers.utils.parseEther("75");
      const PUNK_COST_2 = ethers.utils.parseEther("60");
      const NUM_WALLETS = 150;
      const NUM_DRAWINGS = 1;

      const [owner] = await ethers.getSigners();
      await raffleContract.setTargetBalance(TARGET_BALANCE);

      console.log("owner:", owner.address);

      console.time("Giving the punk claimer some initial ETH");
      let punkHolder = ethers.Wallet.createRandom();
      console.log("punkHolder:", punkHolder.address);
      punkHolder =  punkHolder.connect(ethers.provider);
      await owner.sendTransaction({
        to: punkHolder.address,
        value: INITIAL_ETH_PER_WALLET
      });
      console.timeEnd("Giving the punk claimer some initial ETH");

      console.time("Assigning punks");
      await punksContract.setInitialOwners(
        Array.from({ length: 100 }, () => punkHolder.address), // punkClaimerWallet address 100 times
        Array.from({ length: 100 }, (_, index) => index) // 0-99
      )
      await punksContract.allInitialOwnersAssigned();
      expect(
        await punksContract.allPunksAssigned()
      ).to.be.true;
      expect(
        await punksReaderContract.callStatic.ownerOf(0)
      ).to.equal(punkHolder.address);
      expect(
        await punksReaderContract.callStatic.ownerOf(1)
      ).to.equal(punkHolder.address);
      console.timeEnd("Assigning punks");
      
      console.time("Listing punks for sale");
      const connectedPunksContract = punksContract.connect(punkHolder);
      await connectedPunksContract.offerPunkForSale(PUNK_ID_1, PUNK_COST_1);
      await connectedPunksContract.offerPunkForSale(PUNK_ID_2, PUNK_COST_2);
      console.timeEnd("Listing punks for sale");

      console.time("Deploying Gaslite Drop");
      const gasliteDropContractFactory = await ethers.getContractFactory("GasliteDrop");
      const gasliteDropContract = await gasliteDropContractFactory.deploy();
      gasliteDropContract.deployed();
      console.timeEnd("Deploying Gaslite Drop");

      console.time("Creating wallets");
      const wallets = loadWalletsFromFile('privateKeys.txt', NUM_WALLETS);
      console.timeEnd("Creating wallets");
      
      const participantAddresses = wallets.map(wallet => wallet.address);
      const addressesToWallets = {};
      wallets.map(wallet => addressesToWallets[wallet.address] = wallet);
      const chunkedAddresses = chunkArray(participantAddresses, 500);

      console.time("Sending ETH to wallets");
      await ethers.provider.send("evm_setAutomine", [false]);
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
      const depositPromises = [];
      for(let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        if(i % 100 === 0) {
          //console.log(i);
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
        includesFinalDeposit = block.transactions.includes(depositTransactions[depositTransactions.length - 1].hash);
      }
      await ethers.provider.send("evm_setAutomine", [true]);
      console.timeEnd("Sending ETH from wallets to contract")

      const raffleBalance = await ethers.provider.getBalance(raffleContract.address);
      console.log("Raffle contract balance:", formatEther(raffleBalance));
      expect(raffleBalance).to.equal(DEPOSIT_AMOUNT.mul(participantAddresses.length));

      //const numDepositors = await raffleContract.getNumDepositors();
      //expect(numDepositors.toNumber()).to.equal(wallets.length);

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

      console.time("Creating the selectWinner caller address");
      let selectWinnerCallerWallet = ethers.Wallet.createRandom();
      selectWinnerCallerWallet =  selectWinnerCallerWallet.connect(ethers.provider);
      await owner.sendTransaction({
        to: selectWinnerCallerWallet.address,
        value: INITIAL_ETH_PER_WALLET
      });
      console.timeEnd("Creating the selectWinner caller address");


      /*
      console.log("---")
      const numDeposits = await raffleContract.getNumDeposits()
      console.log(numDeposits.toString())
      const d = await raffleContract.deposits(0);
      console.log(d.depositor, d.start.toString(), d.end.toString())
      console.log("---")
      */

      console.time("Drawing winner");
      let winner;
      const winnerCounts = {};
      for(let i = 0; i < participantAddresses.length; i++) {
        const address = participantAddresses[i];
        winnerCounts[address] = 0;
      }
      for(let i = 0; i < NUM_DRAWINGS; i++) {
        await raffleContract.connect(selectWinnerCallerWallet).selectWinner({
          gasPrice: "20000000000"
        });
        
        winner = await raffleContract.winner();
        winnerCounts[winner]++;
      }
      console.timeEnd("Drawing winner");
      
      //console.log(winnerCounts);
      console.log("Winner:", winner);

      console.time("Owner buying punk");
      expect(
        await raffleContract.ownerPurchased()
      ).to.be.false;
      await raffleContract.buyPunk(PUNK_ID_1, PUNK_COST_1);
      expect(
        await punksReaderContract.callStatic.ownerOf(PUNK_ID_1)
      ).to.equal(owner.address);
      expect(
        await raffleContract.ownerPurchased()
      ).to.be.true;
      console.timeEnd("Owner buying punk");

      console.time("Winner buying punk");
      const winnerWallet = addressesToWallets[winner];
      const winnerPunksContract = raffleContract.connect(winnerWallet);
      expect(
        await raffleContract.winnerPurchased()
      ).to.be.false;
      await winnerPunksContract.buyPunk(PUNK_ID_2, PUNK_COST_2);
      expect(
        await punksReaderContract.callStatic.ownerOf(PUNK_ID_2)
      ).to.equal(winner);
      expect(
        await raffleContract.winnerPurchased()
      ).to.be.true;
      expect(
        await punksReaderContract.callStatic.ownerOf(PUNK_ID_3)
        ).to.equal(punkHolder.address);
      console.timeEnd("Winner buying punk");

      const totalDeposited = await raffleContract.totalDeposited();
      const postPunkPurchasesBalance = await raffleContract.postPunkPurchasesBalance();
      const claimableAmountPerAddress = postPunkPurchasesBalance.div(participantAddresses.length);
      console.log({
        totalDeposited: formatEther(totalDeposited),
        PUNK_COST_1: formatEther(PUNK_COST_1),
        PUNK_COST_2: formatEther(PUNK_COST_2),
        postPunkPurchasesBalance: formatEther(postPunkPurchasesBalance),
        numParticipants: participantAddresses.length,
        claimableAmountPerAddress: formatEther(claimableAmountPerAddress),
      });
      expect(
        totalDeposited.sub(PUNK_COST_1).sub(PUNK_COST_2)
      ).to.equal(postPunkPurchasesBalance);

      const addresses = Object.keys(addressesToWallets);
      for (let i = 0; i < addresses.length; i++) {
        const wallet = addressesToWallets[addresses[i]];
        const b0 = await ethers.provider.getBalance(wallet.address);
        const tx = await raffleContract.connect(wallet).claim();
        const receipet = await tx.wait();
        const totalGas = receipet.cumulativeGasUsed.mul(receipet.effectiveGasPrice);
        const b1 = await ethers.provider.getBalance(wallet.address);
        const claimedAmount = b1.add(totalGas).sub(b0);
        /*
        console.log({
          b0: formatEther(b0),
          gasUsed: formatEther(totalGas),
          b1: formatEther(b1),
          refunded: formatEther(claimedAmount)
        });
        */
        expect(claimedAmount).to.equal(claimableAmountPerAddress);
      }

      const rcb0 = await ethers.provider.getBalance(raffleContract.address);
      console.log(rcb0.toString());

      /*const addresses = Object.keys(winnerCounts);
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        expect(winnerCounts[address] > 0, `${address} never won :(`).to.be.true;
      }*/
    });
  });
});
