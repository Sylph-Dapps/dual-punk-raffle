import { expect } from "chai";
import * as fs from "fs";
import { ethers } from "hardhat";

const {
  parseEther,
  formatEther,
} = ethers.utils;

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
  let punksContract: any;
  let punksReaderContract: any;
  let owner: any;
  
  before(async () => {
    owner = (await ethers.getSigners())[0];
  })

  beforeEach(async () => {
    const cryptoPunksMarketContractFactory = await ethers.getContractFactory("CryptoPunksMarket");
    punksContract = await cryptoPunksMarketContractFactory.deploy()
    await punksContract.deployed();
    //console.log("punksContract:", punksContract.address);

    const cryptoPunksMarketReaderContractFactory = await ethers.getContractFactory("CryptoPunksMarketReader");
    punksReaderContract = await cryptoPunksMarketReaderContractFactory.deploy();
    await punksReaderContract.deployed();
    await punksReaderContract.setPunksContract(punksContract.address);
    //console.log("punksReaderContract:", punksReaderContract.address);

    const raffleContractFactory = await ethers.getContractFactory("APunkForYouAndMe");
    raffleContract = await raffleContractFactory.deploy();
    await raffleContract.deployed();
    await raffleContract.setPunksContract(punksContract.address);
    //console.log("raffleContract:", raffleContract.address);
  });

  describe("setPunksContract", function() {
    it("should update the punksContract", async function() {
      const newAddress = "0xeD33259a056F4fb449FFB7B7E2eCB43a9B5685Bf";
      const contractAddress1 = await raffleContract.punksContract();
      expect(newAddress).to.not.equal(contractAddress1);
      await raffleContract.setPunksContract(newAddress);
      const contractAddress2 = await raffleContract.punksContract();
      expect(newAddress).to.equal(contractAddress2);
    });
    
    it("should only be callable by the owner", async function() {
      const other = (ethers.Wallet.createRandom()).connect(ethers.provider);
      await owner.sendTransaction({
        to: other.address,
        value: parseEther("1")
      });

      const connectedRaffleContract = raffleContract.connect(other);
      const newAddress = "0xeD33259a056F4fb449FFB7B7E2eCB43a9B5685Bf";
      const contractAddress1 = await connectedRaffleContract.punksContract();
      expect(newAddress).to.not.equal(contractAddress1);

      expect(connectedRaffleContract.setPunksContract(newAddress)).to.eventually.throw();

      const contractAddress2 = await raffleContract.punksContract();
      expect(newAddress).to.not.equal(contractAddress2);
    });

    //it.skip("should not be settable after the contract is sealed", async function() {});
  });

  describe("setTargetBalance", function() {
    it("should update the targetBalance", async function() {
      const b0 = await raffleContract.targetBalance();
      expect(b0).to.equal(0);

      const newTargetBalance = parseEther("1");
      await raffleContract.setTargetBalance(newTargetBalance);
      
      const b1 = await raffleContract.targetBalance();
      expect(b1).to.equal(newTargetBalance);
    });

    it("should only be callable by the owner", async function() {
      const other = (ethers.Wallet.createRandom()).connect(ethers.provider);
      await owner.sendTransaction({
        to: other.address,
        value: parseEther("1")
      });

      const connectedRaffleContract = raffleContract.connect(other);

      const b0 = await raffleContract.targetBalance();
      expect(b0).to.equal(0);

      const newTargetBalance = parseEther("1");
      expect(connectedRaffleContract.setTargetBalance(newTargetBalance)).to.eventually.throw();

      const b1 = await raffleContract.targetBalance();
      expect(b1).to.equal(b0);
    });

    it("should not be callable after the target balance is reached exactly", async function() { // Maybe it should?
      await raffleContract.setTargetBalance(parseEther("2"));
      await raffleContract.setTargetBalance(parseEther("0.1"));
      await raffleContract.setTargetBalance(parseEther("1"));
      await owner.sendTransaction({
        to: raffleContract.address,
        value: parseEther("1")
      });
      expect(raffleContract.setTargetBalance(parseEther("2"))).to.eventually.throw();
      expect(raffleContract.setTargetBalance(parseEther("1"))).to.eventually.throw();
      expect(raffleContract.setTargetBalance(parseEther("0.1"))).to.eventually.throw();
    });

    it("should not be callable after the target balance is exceeded", async function() { // Maybe it should?
      await raffleContract.setTargetBalance(parseEther("2"));
      await raffleContract.setTargetBalance(parseEther("0.1"));
      await raffleContract.setTargetBalance(parseEther("1"));
      await owner.sendTransaction({
        to: raffleContract.address,
        value: parseEther("10")
      });
      expect(raffleContract.setTargetBalance(parseEther("2"))).to.eventually.throw();
      expect(raffleContract.setTargetBalance(parseEther("1"))).to.eventually.throw();
      expect(raffleContract.setTargetBalance(parseEther("0.1"))).to.eventually.throw();
    });
  });

  describe.only("getNumDeposits", function() {
    it.skip("should return the number of deposits when each depositor is unique", async function() {});
    it.skip("should return the number of deposits when there are duplicates", async function() {});
    it.skip("should return the number of deposits when they all come from one person", async function() {});
  });

  describe("deposit", function() {
    it.skip("should update the total amount deposited", async function() {});
    it.skip("should add an item to the deposits array", async function() {});
    it.skip("should increment the sender's amount deposited", async function() {});
    it.skip("should not be callable after the target balance is reached", async function() {});
    it.skip("should not be callable after selectWinner is called", async function() {});
    it.skip("should reject sends less than a certain amount", async function() {});
    it.skip("should only allow EOAs to send", async function() {});
  });

  describe("selectWinner", function() {
    it.skip("should not be callable until the target balance is reached", async function() {});
    it.skip("should update the winner to be one of the depositors", async function() {});
    it.skip("should set the purchaseDeadline to be 30 days out", async function() {});
    it.skip("should be callable by anyone but only once per contract iteration", async function() {});
    it.skip("should pick every depositor at least once after some number of contract iterations", async function() {});
    it.skip("should prevent future deposits", async function() {});
  });

  describe("buyPunk", function() {
    it.skip("should be callable once by the owner and get them a punk", async function() {});
    it.skip("should be callable once by the winner and get them a punk", async function() {});
    it.skip("should not be callable by anyone else", async function() {});
    it.skip("should only allow the caller to use up to half the balance of the contract", async function() {});
    it.skip("should not be callable after the purchase deadline", async function() {});
    
    // TODO Maybe remove this?
    //it.skip("should trigger claims mode after being called by both the owner and the winner", async function() {});
  });

  describe("enterClaimsMode", function() {
    it.skip("should be callable by the owner before the targetBalance is reached", async function() {});
    it.skip("should not be callable by anyone after targetBalance is reached but before the purchase deadline passes", async function() {});
    it.skip("should be callable by anyone if the owner misses the deadline", async function() {});
    it.skip("should be callable by anyone if the winner misses the deadline", async function() {});
    it.skip("should be callable by anyone once the owner and winner have purchased punks", async function() {});
  });

  describe("claim", function() {
    it.skip("should only be callable by depositors once", async function() {});
    it.skip("should not be callable by the owner unless they are also a depositor", async function() {});
    it.skip("should not be callable by other non-depositors", async function() {});
    it.skip("should distribute a proportional amount of the ETH deposited", async function() {});
  });

  describe("A sample raffle", function() {
    it("should land the owner and the winner each a Cryptopunk", async function() {
      this.timeout(0);

      const INITIAL_ETH_PER_WALLET = parseEther("1.25");
      const DEPOSIT_AMOUNT = parseEther("1");
      const TARGET_BALANCE = parseEther("150");
      const PUNK_ID_1 = 42;
      const PUNK_ID_2 = 10;
      const PUNK_ID_3 = 5;
      const PUNK_COST_1 = parseEther("75");
      const PUNK_COST_2 = parseEther("60");
      const NUM_WALLETS = 150;
      const NUM_DRAWINGS = 1;

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
