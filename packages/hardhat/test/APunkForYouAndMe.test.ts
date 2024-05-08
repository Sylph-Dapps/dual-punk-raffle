import * as fs from "fs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { differenceInDays } from "date-fns";

const {
  parseEther,
  formatEther,
} = ethers.utils;

const SECOND = 1;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const BEYOND_DEADLINE = DAY * 600; // Deadling is 30 days

function loadWalletsFromFile(filePath: string, numWalletsToLoad: any = undefined) {
  const privateKeys = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  const selectedPrivateKeys = privateKeys.slice(0, typeof numWalletsToLoad === "undefined" ? privateKeys.length : numWalletsToLoad);
  return selectedPrivateKeys.map(privateKey => {
    return (new ethers.Wallet(privateKey.trim())).connect(ethers.provider);
  });
}

function chunkArray(arr, maxSize) {
  const toReturn = [];
  for (let i = 0; i < arr.length; i += maxSize) {
    const chunk = arr.slice(i, i + maxSize);
    toReturn.push(chunk);
  }
  return toReturn;
}

// TODO test this
function getRandomBigNumber(min, max) {
  const range = max.sub(min).add(1); // Add 1 to include the max value in the range
  const randomNumber = BigNumber.from(ethers.utils.randomBytes(32)).mod(range).add(min);
  return randomNumber;
}

// Solidity returns dates in seconds but the Date constructor wants milliseconds so multiply by 1000 
function solidityDateToJS(num) {
  if(typeof num === 'number') {
    return new Date(num * 1000);
  } else {
    // It's a BigNumber
    return new Date(num.toNumber() * 1000);
  }
}

describe("getRandomBigNumber", () => {
  it("should return results within range", () => {
    const counts = {};
    for(let i = 0; i < 100; i++) {
      const r = getRandomBigNumber(
        BigNumber.from(1),
        BigNumber.from(10)
      );
      expect(r).to.be.lessThanOrEqual(10);
      expect(r).to.be.greaterThanOrEqual(1);

      if(!counts[r.toString()]) {
        counts[r.toString()] = 0;
      }
      counts[r.toString()]++;
    }

    for(let i = 1; i <= 10; i++) {
      expect(counts[i.toString()]).to.be.greaterThan(0);
    }
  })
});

describe("APunkForYouAndMe", function () {
  let gasliteDropContract: any;
  let punksContract: any;
  let punksReaderContract: any;
  let calculatorContract: any;
  let raffleContract: any;
  let owner: any;
  
  before(async () => {
    owner = (await ethers.getSigners())[0];

    const gasliteDropContractFactory = await ethers.getContractFactory("GasliteDrop");
    gasliteDropContract = await gasliteDropContractFactory.deploy();
    gasliteDropContract.deployed();
  })

  beforeEach(async () => {
    const cryptoPunksMarketContractFactory = await ethers.getContractFactory("CryptoPunksMarket");
    punksContract = await cryptoPunksMarketContractFactory.deploy()
    await punksContract.deployed();

    const cryptoPunksMarketReaderContractFactory = await ethers.getContractFactory("CryptoPunksMarketReader");
    punksReaderContract = await cryptoPunksMarketReaderContractFactory.deploy();
    await punksReaderContract.deployed();
    await punksReaderContract.setPunksContract(punksContract.address);

    const referralPointsCalculatorContractFactory = await ethers.getContractFactory("ReferralPointsCalculator");
    calculatorContract = await referralPointsCalculatorContractFactory.deploy();

    const raffleContractFactory = await ethers.getContractFactory("APunkForYouAndMe");
    raffleContract = await raffleContractFactory.deploy();
    await raffleContract.deployed();
    await raffleContract.setPunksContract(punksContract.address);
    await raffleContract.setEntryCalculator(calculatorContract.address);

    await calculatorContract.setReferrerLookup(raffleContract.address);
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

      await expect(connectedRaffleContract.setPunksContract(newAddress)).to.eventually.be.rejected;

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
      await expect(connectedRaffleContract.setTargetBalance(newTargetBalance)).to.eventually.be.rejected;

      const b1 = await raffleContract.targetBalance();
      expect(b1).to.equal(b0);
    });
    /*
    it("should not be callable after the target balance is reached exactly", async function() { // Maybe it should?
      await raffleContract.setTargetBalance(parseEther("2"));
      await raffleContract.setTargetBalance(parseEther("0.1"));
      await raffleContract.setTargetBalance(parseEther("1"));
      await owner.sendTransaction({
        to: raffleContract.address,
        value: parseEther("1")
      });
      await expect(raffleContract.setTargetBalance(parseEther("2"))).to.eventually.be.rejected;
      await expect(raffleContract.setTargetBalance(parseEther("1"))).to.eventually.be.rejected;
      await expect(raffleContract.setTargetBalance(parseEther("0.1"))).to.eventually.be.rejected;
    });

    it("should not be callable after the target balance is exceeded", async function() { // Maybe it should?
      await raffleContract.setTargetBalance(parseEther("2"));
      await raffleContract.setTargetBalance(parseEther("0.1"));
      await raffleContract.setTargetBalance(parseEther("1"));
      await owner.sendTransaction({
        to: raffleContract.address,
        value: parseEther("10")
      });
      await expect(raffleContract.setTargetBalance(parseEther("2"))).to.eventually.be.rejected;
      await expect(raffleContract.setTargetBalance(parseEther("1"))).to.eventually.be.rejected;
      await expect(raffleContract.setTargetBalance(parseEther("0.1"))).to.eventually.be.rejected;
    });
    */
  });

  describe("getNumEntries", function() {
    beforeEach(async () => {
      await raffleContract.setTargetBalance(parseEther("100"));
    });

    it("should return the number of deposits when each depositor is unique", async function() {
      const DEPOSIT_AMOUNT = parseEther("1");
      
      const signers = await ethers.getSigners();
      for(let i = 1; i < signers.length; i++) {
        const signer = signers[i];
        await raffleContract.connect(signer).deposit({
          value: DEPOSIT_AMOUNT,
          gasLimit: 1_000_000
        });
      }
      
      const numEntries = await raffleContract.getNumEntries();
      expect(numEntries).to.equal(signers.length - 1);
    });
    it("should return the number of deposits when there are duplicates", async function() {
      const DEPOSIT_AMOUNT = parseEther("1");

      const signers = await ethers.getSigners();
      signers.push(signers[1]);
      signers.push(signers[1]);
      signers.push(signers[1]);
      signers.push(signers[2]);
      signers.push(signers[2]);

      for(let i = 1; i < signers.length; i++) {
        const signer = signers[i];
        await raffleContract.connect(signer).deposit({
          value: DEPOSIT_AMOUNT,
          gasLimit: 1_000_000
        });
      }
      
      const numEntries = await raffleContract.getNumEntries();
      expect(numEntries).to.equal(signers.length - 1);
    });
    it("should return the number of deposits when they all come from one person", async function() {
      const DEPOSIT_AMOUNT = parseEther("1");

      let signers = await ethers.getSigners();
      signers = [signers[1]];
      signers = signers.concat(signers).concat(signers).concat(signers);

      for(let i = 0; i < signers.length; i++) {
        const signer = signers[i];
        await raffleContract.connect(signer).deposit({
          value: DEPOSIT_AMOUNT,
          gasLimit: 1_000_000
        });
      }
      
      const numEntries = await raffleContract.getNumEntries();
      expect(numEntries).to.equal(signers.length);
    });
  });

  describe("deposit", function() {
    beforeEach(async () => {
      await raffleContract.setTargetBalance(parseEther("250"));
    });

    it("should not be callable by the owner", async function() {
      await expect(raffleContract.deposit({
        value: parseEther("1"),
      })).to.eventually.be.rejected;
      await expect(owner.sendTransaction({
        to: raffleContract.address,
        value: parseEther("1")
      })).to.eventually.be.rejected;
    });
    it("should update the total amount deposited", async function() {
      const signers = await ethers.getSigners();
      const depositAmounts = signers.map(signer => {
        return getRandomBigNumber(
          parseEther("0.0001"),
          parseEther("1")
        );
      });

      let runningTotal = BigNumber.from(0);
      for(let i = 1; i < signers.length; i++) {
        const signer = signers[i];
        const depositAmount = depositAmounts[i];
        await raffleContract.connect(signer).deposit({
          value: depositAmount,
          gasLimit: 1_000_000
        });
        runningTotal = runningTotal.add(depositAmount);

        const raffleBalance = await ethers.provider.getBalance(raffleContract.address);
        expect(raffleBalance).to.equal(runningTotal);
      }
    });
    it("should add an item to the deposits array", async function() {
      const signers = (await ethers.getSigners());
      signers.shift(); // Remove the owner

      const depositAmounts = signers.map(signer => {
        return getRandomBigNumber(
          parseEther("0.0001"),
          parseEther("2")
        );
      });

      for(let j = 0; j < 5; j++) {
        for(let i = 0; i < signers.length; i++) {
          const signer = signers[i];
          const depositAmount = depositAmounts[i];
          await raffleContract.connect(signer).deposit({
            value: depositAmount,
            gasLimit: 1_000_000
          });
  
          const numEntries = await raffleContract.getNumEntries();
          expect(numEntries).to.equal((i + 1) + (j * (signers.length)));
        }
      }
    });
    it("should increment the sender's amount deposited", async function() {
      const signers = await ethers.getSigners();
      const depositAmounts = signers.map(signer => {
        return getRandomBigNumber(
          parseEther("0.0001"),
          parseEther("0.1")
        );
      });

      for(let j = 0; j < 5; j++) {
        for(let i = 1; i < signers.length; i++) {
          const signer = signers[i];
          const depositAmount = depositAmounts[i];
          await raffleContract.connect(signer).deposit({
            value: depositAmount,
            gasLimit: 1_000_000
          });
  
          const amountDeposited = await raffleContract.getAmountDeposited(signer.address);
          expect(amountDeposited).to.equal(depositAmounts[i].mul((j + 1)));
        }
      }
    });
    it("should not be callable after the target balance is reached", async function() {
      // TOOD Maybe it should stay open until someone calls a function to close it?
      const player = (await ethers.getSigners())[1];
      await raffleContract.connect(player).deposit({
        value: parseEther("249"),
        gasLimit: 1_000_000
      });
      await raffleContract.connect(player).deposit({
        value: parseEther("10"),
        gasLimit: 1_000_000
      });
      await expect(raffleContract.connect(player).deposit({
        value: parseEther("0.01"),
        gasLimit: 1_000_000
      })).to.eventually.be.rejected;
    });
    it("should reject sends less than a certain amount", async function() {
      await expect(raffleContract.deposit({
        value: parseEther("0.000001"),
        gasLimit: 1_000_000
      })).to.eventually.be.rejected;
    });
    it("should only allow EOAs to send", async function() {
      // Fail using GaslightDrop
      await expect(
        gasliteDropContract.airdropETH(
          [raffleContract.address],
          [parseEther("1")],
          {
            value: parseEther("1"),
            gasLimit: 30_000_000,
          }
        )
      ).to.eventually.be.rejected;

      // Fail using a custom contract
      const etherForwarderContractFactory = await ethers.getContractFactory("EtherForwarder");
      const etherForwarderContract = await etherForwarderContractFactory.deploy();
      await etherForwarderContract.deployed();
      
      // Make sure sending to a non-raffle contract works
      await etherForwarderContract.setAddress(owner.address);
      await etherForwarderContract.send({
        value: parseEther("1")
      });

      // Fail using the EtherForwarder
      await etherForwarderContract.setAddress(raffleContract.address);
      await expect(
        etherForwarderContract.send({
          value: parseEther("1")
        })
      ).to.eventually.be.rejected;
    });
    it("should not be callable after selectWinner is called", async function() {
      const player = (await ethers.getSigners())[1];
      await raffleContract.connect(player).deposit({
        value: parseEther("250"),
        gasLimit: 1_000_000
      });
      await raffleContract.selectWinner();

      await expect(
        // TODO this call will fail both because the winner is set and because the target has been reached.
        // Consider having the winner and owner buy punks and potentially entering claimsMode before calling
        // this so the balance will be less.
        raffleContract.deposit({
          value: parseEther("250"),
          gasLimit: 1_000_000
        })
      ).to.eventually.be.rejected;
    });
    it("should update totalPoints and addressesToPoints", async function() {
      const signers = await ethers.getSigners();
      const depositAmount = parseEther("1");

      const pointsLookup: Record<string, BigNumber> = {};
      const computeTotalPoints = () => {
        let total = BigNumber.from(0);
        Object.values(pointsLookup).forEach((amount: any) => total = total.add(amount));
        return total;
      }

      // A plain ordinary deposit
      const ogDepositor = signers[1];
      await raffleContract.connect(ogDepositor).deposit({
        value: depositAmount,
      });
      pointsLookup[ogDepositor.address] = depositAmount.add(0);
      expect(
        await raffleContract.getPointsForAddress(ogDepositor.address)
      ).to.equal(pointsLookup[ogDepositor.address]);
      expect(
        await raffleContract.totalPoints()
      ).to.equal(computeTotalPoints());

      // This should reject because you cannot use a referrer that hasn't deposited
      const referral = signers[2];
      await expect(raffleContract.connect(referral).depositWithReferrer("0x1000000000000000000000000000000000000000", {
        value: depositAmount,
      })).to.eventually.be.rejected;

      // Using the zero address is worth checking too
      await expect(raffleContract.connect(referral).depositWithReferrer("0x0000000000000000000000000000000000000000", {
        value: depositAmount,
      })).to.eventually.be.rejected;
      
      // Cannot refer yourself
      await expect(raffleContract.connect(referral).depositWithReferrer(referral.address, {
        value: depositAmount,
      })).to.eventually.be.rejected;
      
      // Deposit with a valid referrer should work
      await raffleContract.connect(referral).depositWithReferrer(ogDepositor.address, {
        value: depositAmount,
      });
      pointsLookup[referral.address] = depositAmount.mul(2);
      pointsLookup[ogDepositor.address] = pointsLookup[ogDepositor.address].add(depositAmount.div(10));
      expect(
        await raffleContract.getPointsForAddress(referral.address),
        "Using a referral should earn them double points"
      ).to.equal(pointsLookup[referral.address]);
      expect(
        await raffleContract.getPointsForAddress(ogDepositor.address),
        "The OG depositor's points should have a bonus because someone used their referral code"
      ).to.equal(pointsLookup[ogDepositor.address]);
      expect(
        await raffleContract.totalPoints(),
        "The depositor's and the referrer's points should be added to the totalPoints"
      ).to.equal(computeTotalPoints());

      // Deposit with a valid referrer that was also referred should work
      const grandReferral = signers[3];
      await raffleContract.connect(grandReferral).depositWithReferrer(referral.address, {
        value: depositAmount,
      });
      pointsLookup[grandReferral.address] = depositAmount.mul(2);
      pointsLookup[referral.address] = pointsLookup[referral.address].add(depositAmount.div(10));
      pointsLookup[ogDepositor.address] = pointsLookup[ogDepositor.address].add(depositAmount.div(50));
      expect(
        await raffleContract.getPointsForAddress(grandReferral.address),
        "Using a referral should earn them double points even with a grand referral"
      ).to.equal(pointsLookup[grandReferral.address]);
      expect(
        await raffleContract.getPointsForAddress(referral.address),
        "The referrer should have a bonus because someone used their referral code"
      ).to.equal(pointsLookup[referral.address]);
      expect(
        await raffleContract.getPointsForAddress(ogDepositor.address),
        "The grandreferrer should have a bonus because someone used their referral code"
      ).to.equal(pointsLookup[ogDepositor.address]);
      expect(
        await raffleContract.totalPoints(),
        "The total points should match our tracking"
      ).to.equal(computeTotalPoints());

      // Deposit with a huge amount
      const whale = signers[4];
      const whaleDepositAmount = depositAmount.mul("100");
      await raffleContract.connect(whale).depositWithReferrer(referral.address, {
        value: whaleDepositAmount,
      });

      // The whale pushed up against the point caps for the referral and the ogDepositer.
      const referralDepositAmount = await raffleContract.getAmountDeposited(referral.address);
      expect(referralDepositAmount).to.equal(depositAmount);
      expect(referralDepositAmount).to.be.lessThan(whaleDepositAmount);

      const ogDepositAmount = await raffleContract.getAmountDeposited(ogDepositor.address);
      expect(ogDepositAmount).to.equal(depositAmount);
      expect(ogDepositAmount).to.be.lessThan(whaleDepositAmount);

      pointsLookup[whale.address] = whaleDepositAmount.mul(2);
      pointsLookup[referral.address] = pointsLookup[referral.address].add(referralDepositAmount);
      pointsLookup[ogDepositor.address] = pointsLookup[ogDepositor.address].add(ogDepositAmount);
      expect(
        await raffleContract.getPointsForAddress(whale.address),
        "Using a referral should earn the whale double points"
      ).to.equal(pointsLookup[whale.address]);
      expect(
        await raffleContract.getPointsForAddress(referral.address),
        "The referrer should have a bonus because a whale used their referral code, but it should not be more than they deposited themselves"
      ).to.equal(pointsLookup[referral.address]);
      expect(
        await raffleContract.getPointsForAddress(ogDepositor.address),
        "The grandreferrer should have a bonus because a whale used their referees code, but it should not be more than they deposited themselves"
      ).to.equal(pointsLookup[ogDepositor.address]);
      expect(
        await raffleContract.totalPoints(),
        "The total points should match our tracking"
      ).to.equal(computeTotalPoints());

      // Now with a medium-large amount. This will exercise the grandreferral getting capped
      // but the direct referral not getting capped.
      const bigFish = signers[5];
      const bigFishAmount = depositAmount.mul("75");
      await raffleContract.connect(bigFish).depositWithReferrer(whale.address, {
        value: bigFishAmount,
      });

      // The big fish pushed up against the point caps for the referral but not for the whale
      const whaleDepositAmountFromContract = await raffleContract.getAmountDeposited(whale.address);
      expect(whaleDepositAmountFromContract).to.equal(whaleDepositAmount);
      expect(whaleDepositAmountFromContract).to.be.greaterThan(bigFishAmount.div(10));
      
      const referralDepositAmountFromContract = await raffleContract.getAmountDeposited(referral.address);
      expect(referralDepositAmountFromContract).to.equal(depositAmount);
      expect(referralDepositAmountFromContract).to.be.lessThan(bigFishAmount.div(50));

      pointsLookup[bigFish.address] = bigFishAmount.mul(2);
      pointsLookup[whale.address] = pointsLookup[whale.address].add(bigFishAmount.div(10)); // Didn't reach cap
      pointsLookup[referral.address] = pointsLookup[referral.address].add(referralDepositAmount); // Capped
      
      expect(
        await raffleContract.getPointsForAddress(bigFish.address),
        "Big fish used a referral code so gets double points"
      ).to.equal(pointsLookup[bigFish.address]);
      expect(
        await raffleContract.getPointsForAddress(whale.address),
        "Whale should get bonus points at the normal rate because their bonus doesn't hit their cap"
      ).to.equal(pointsLookup[whale.address]);
      expect(
        await raffleContract.getPointsForAddress(referral.address),
        "The referral's points should be capped"
      ).to.equal(pointsLookup[referral.address]);
      expect(
        await raffleContract.getPointsForAddress(ogDepositor.address),
        "ogDepositor is far enough upstream that they don't get a reward"
      ).to.equal(pointsLookup[ogDepositor.address]);
      expect(
        await raffleContract.totalPoints(),
        "The total points should match our tracking"
      ).to.equal(computeTotalPoints());

      // Now with a gigantic amount. This will exercies the direct referral getting
      // capped but the grandreferral not getting capped.
      const giganticWhale = signers[6];
      const giganticWhaleAmount = depositAmount.mul("1500");
      await raffleContract.connect(giganticWhale).depositWithReferrer(bigFish.address, {
        value: giganticWhaleAmount,
      });

      // The giganticWhale pushs up against the point caps for their direct referral (bigFish)
      // but not for their grandreferral (whale).
      expect(
        await raffleContract.getAmountDeposited(bigFish.address)
      ).to.equal(bigFishAmount);
      expect(
        await raffleContract.getAmountDeposited(bigFish.address)
      ).to.be.lessThan(giganticWhaleAmount.div(10));
      expect(
        await raffleContract.getAmountDeposited(whale.address)
      ).to.equal(whaleDepositAmount);
      expect(
        await raffleContract.getAmountDeposited(whale.address)
      ).to.be.greaterThan(giganticWhaleAmount.div(50));

      pointsLookup[giganticWhale.address] = giganticWhaleAmount.mul(2);
      pointsLookup[bigFish.address] = pointsLookup[bigFish.address].add(bigFishAmount); // Reached cap
      pointsLookup[whale.address] = pointsLookup[whale.address].add(giganticWhaleAmount.div(50)); // Didn't reach cap
      
      expect(
        await raffleContract.getPointsForAddress(giganticWhale.address),
        "Gigantic whaled used a referral code so gets double points"
      ).to.equal(pointsLookup[giganticWhale.address]);
      expect(
        await raffleContract.getPointsForAddress(bigFish.address),
        "Big fish should get bonus points capped based on gigantic whale's deposit size"
      ).to.equal(pointsLookup[bigFish.address]);
      expect(
        await raffleContract.getPointsForAddress(whale.address),
        "Whale should get the grandreferral bonus"
      ).to.equal(pointsLookup[whale.address]);
      expect(
        await raffleContract.getPointsForAddress(referral.address),
        "referral is far enough upstream that they don't get a reward"
      ).to.equal(pointsLookup[referral.address]);
      expect(
        await raffleContract.getPointsForAddress(ogDepositor.address),
        "ogDepositor is far enough upstream that they don't get a reward"
      ).to.equal(pointsLookup[ogDepositor.address]);
      expect(
        await raffleContract.totalPoints(),
        "The total points should match our tracking"
      ).to.equal(computeTotalPoints());

    });
  });

  describe("selectWinner", async function() {
    const player = (await ethers.getSigners())[1];

    it("should not be callable until the target balance is reached", async function() {
      await raffleContract.setTargetBalance(parseEther("3"));
      await expect(raffleContract.selectWinner()).to.eventually.be.rejected;
      await raffleContract.connect(player).deposit({
        value: parseEther("1")
      });
      await expect(raffleContract.selectWinner()).to.eventually.be.rejected;

      // Different way to deposit
      await player.sendTransaction({
        to: raffleContract.address,
        value: parseEther("1")
      });
      await expect(raffleContract.selectWinner()).to.eventually.be.rejected;

      await player.sendTransaction({
        to: raffleContract.address,
        value: parseEther("1")
      });
      await raffleContract.selectWinner();
    });
    it("should update the winner to be one of the depositors", async function() {
      await raffleContract.setTargetBalance(parseEther("3"));
      await raffleContract.connect(player).deposit({
        value: parseEther("3")
      });
      await raffleContract.selectWinner();
      const winner = await raffleContract.winner();
      expect(winner).to.equal(owner.address);
    });
    it("should set the purchaseDeadline to be 30 days out", async function() { // TODO Decide how long to actually set the purchaseDeadline
      await raffleContract.setTargetBalance(parseEther("3"));
      await raffleContract.connect(player).deposit({
        value: parseEther("3")
      });
      await raffleContract.selectWinner();
      const purchaseDeadline = solidityDateToJS(await raffleContract.purchaseDeadline());
      const difference = differenceInDays(purchaseDeadline, new Date);
      expect(difference).to.equal(365);
    });
    it("should be callable by anyone but only once per contract iteraction", async function() {
      // There are other tests that call selectWinner using the deployer address,
      // so this one tests using another address.
      let selectWinnerCallerWallet = ethers.Wallet.createRandom();
      selectWinnerCallerWallet =  selectWinnerCallerWallet.connect(ethers.provider);
      await owner.sendTransaction({
        to: selectWinnerCallerWallet.address,
        value: parseEther("2")
      });

      await raffleContract.setTargetBalance(parseEther("1"));
      await raffleContract.connect(selectWinnerCallerWallet).deposit({
        value: parseEther("1")
      });
      await raffleContract.connect(selectWinnerCallerWallet).selectWinner();
      const winner = await raffleContract.winner();
      expect(winner).to.equal(selectWinnerCallerWallet.address);
    });
    it("should prevent future deposits and changing of the target balance", async function() {
      await raffleContract.setTargetBalance(parseEther("1"));
      await raffleContract.connect(player).deposit({
        value: parseEther("1")
      });
      await raffleContract.selectWinner();
      await expect(
        raffleContract.connect(player).deposit({
          value: parseEther("1")
        })
      ).to.eventually.be.rejected;

      await expect(
        raffleContract.setTargetBalance(parseEther("2"))
      ).to.eventually.be.rejected;
    });
  });

  describe("buyPunk", function() {
    const NUM_WALLETS = 5;
    const NUM_DEPOSITS_PER_WALLET = 4;
    const wallets = loadWalletsFromFile('privateKeys.txt', NUM_WALLETS);
    const punkHolder = ethers.Wallet.createRandom().connect(ethers.provider);

    before(async function() {
      // Send each wallet initial funds
      for(let i = 0; i < wallets.length; i++) {
        await owner.sendTransaction({
          to: wallets[i].address,
          value: parseEther("50")
        });
      }

      // Give punkHolder some ETH 
      await owner.sendTransaction({
        to: punkHolder.address,
        value: parseEther("1")
      });
    })

    beforeEach(async function() {
      // Give the punkHolder the punks
      await punksContract.setInitialOwners(
        Array.from({ length: 100 }, () => punkHolder.address),
        Array.from({ length: 100 }, (_, index) => index)
      );
      await punksContract.allInitialOwnersAssigned();
      
      // Set the target balance for the raffle
      await raffleContract.setTargetBalance(parseEther((NUM_WALLETS * NUM_DEPOSITS_PER_WALLET).toString()));
      
      // Make raffle entries
      for(let i = 0; i < NUM_DEPOSITS_PER_WALLET; i++) {
        for(let j = 0; j < NUM_WALLETS; j++) {
          await raffleContract.connect(wallets[j]).deposit({
            value: parseEther("1")
          });
        }
      }

      // Pick winner
      await raffleContract.selectWinner();
    });

    it("should be callable once by the owner and get them a punk", async function() {
      const PUNK_COST = parseEther("4");
      await punksContract.connect(punkHolder).offerPunkForSale(0, PUNK_COST);

      expect(
        await punksReaderContract.callStatic.ownerOf(0)
      ).to.equal(punkHolder.address);
      expect(
        await raffleContract.ownerPurchased()
      ).to.be.false;
      await raffleContract.buyPunk(0, PUNK_COST);
      expect(
        await punksReaderContract.callStatic.ownerOf(0)
      ).to.equal(owner.address);
      expect(
        await raffleContract.ownerPurchased()
      ).to.be.true;
      
      // Can't buy a second punk
      punksContract.connect(punkHolder).offerPunkForSale(1, PUNK_COST)
      await expect(
        raffleContract.buyPunk(1, PUNK_COST)
      ).to.eventually.be.rejected;
    });
    it("should be callable once by the winner and get them a punk", async function() {
      const PUNK_COST = parseEther("4");
      await punksContract.connect(punkHolder).offerPunkForSale(0, PUNK_COST);

      const winnerAddress = await raffleContract.winner();
      const winner = wallets.find(w => w.address === winnerAddress);
      expect(
        await punksReaderContract.callStatic.ownerOf(0)
      ).to.equal(punkHolder.address);
      expect(
        await raffleContract.ownerPurchased()
      ).to.be.false;
      await raffleContract.connect(winner).buyPunk(0, PUNK_COST);
      expect(
        await punksReaderContract.callStatic.ownerOf(0)
      ).to.equal(winner.address);
      expect(
        await raffleContract.winnerPurchased()
      ).to.be.true;
      
      // Can't buy a second punk
      punksContract.connect(punkHolder).offerPunkForSale(1, PUNK_COST)
      await expect(
        raffleContract.connect(winner).buyPunk(1, PUNK_COST)
      ).to.eventually.be.rejected;
    });
    it("should not be callable by anyone else", async function() {
      const PUNK_COST = parseEther("1");
      await punksContract.connect(punkHolder).offerPunkForSale(0, PUNK_COST);
      await punksContract.connect(punkHolder).offerPunkForSale(1, PUNK_COST);
      await punksContract.connect(punkHolder).offerPunkForSale(2, PUNK_COST);

      const winnerAddress = await raffleContract.winner();
      const winner = wallets.find(w => w.address === winnerAddress);

      // Try to buy for everyone else other than the winner;
      for(let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        if(wallet.address === winnerAddress) {
          continue;
        }

        await expect(
          raffleContract.connect(wallet).buyPunk(0, PUNK_COST)
        ).to.eventually.be.rejected;
      }

      // Buy the punks for the owner and winner
      await raffleContract.buyPunk(0, PUNK_COST);
      await raffleContract.connect(winner).buyPunk(1, PUNK_COST);

      // ... and try to buy for everyone else again
      for(let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        if(wallet.address === winnerAddress) {
          continue;
        }

        await expect(
          raffleContract.connect(wallet).buyPunk(2, PUNK_COST)
        ).to.eventually.be.rejected;
      }
    });
    it("should only allow the caller to use up to half the balance of the contract", async function() {
      await punksContract.connect(punkHolder).offerPunkForSale(0, parseEther("11"));
      await expect(
        raffleContract.buyPunk(0, parseEther("11"))
      ).to.eventually.be.rejected;
      await punksContract.connect(punkHolder).offerPunkForSale(0, parseEther("10"));
      await raffleContract.buyPunk(0, parseEther("10"));
      expect(
        await punksReaderContract.callStatic.ownerOf(0)
      ).to.equal(owner.address);

      const winnerAddress = await raffleContract.winner();
      const winner = wallets.find(w => w.address === winnerAddress);
      await punksContract.connect(punkHolder).offerPunkForSale(1, parseEther("20"));
      await expect(
        raffleContract.connect(winner).buyPunk(1, parseEther("10"))
      ).to.eventually.be.rejected;
      await expect(
        raffleContract.connect(winner).buyPunk(1, parseEther("20"))
      ).to.eventually.be.rejected;
      await punksContract.connect(punkHolder).offerPunkForSale(1, parseEther("5"));
      await raffleContract.connect(winner).buyPunk(1, parseEther("10"));
      expect(
        await punksReaderContract.callStatic.ownerOf(1)
      ).to.equal(winner.address);
    });
    it("should not be callable after the purchase deadline", async function() {
      const winnerAddress = await raffleContract.winner();
      const winner = wallets.find(w => w.address === winnerAddress);

      await punksContract.connect(punkHolder).offerPunkForSale(0, parseEther("1"));
      await punksContract.connect(punkHolder).offerPunkForSale(1, parseEther("1"));
      
      await ethers.provider.send("evm_increaseTime", [BEYOND_DEADLINE]);
      await ethers.provider.send("evm_mine");

      await expect(
        raffleContract.buyPunk(0, parseEther("1"))
      ).to.eventually.be.rejected;
      await expect(
        raffleContract.connect(winner).buyPunk(1, parseEther("1"))
      ).to.eventually.be.rejected;
    });
  });

  describe("enterClaimsMode", function() {
    let nonOwner;

    before(async function() {
      nonOwner = (await ethers.getSigners())[1];
    });

    it("should be callable by the owner before the targetBalance is reached", async function() {
      let inClaimsMode;
      inClaimsMode = await raffleContract.inClaimsMode();
      expect(inClaimsMode).to.be.false;
      await raffleContract.enterClaimsMode();
      inClaimsMode = await raffleContract.inClaimsMode();
      expect(inClaimsMode).to.be.true;
    });
    it("should be callable by the owner before the winner is selected", async function() {
      await raffleContract.setTargetBalance(parseEther("3"));
      await raffleContract.connect(nonOwner).deposit({
        value: parseEther("3")
      });

      let inClaimsMode;
      inClaimsMode = await raffleContract.inClaimsMode();
      expect(inClaimsMode).to.be.false;
      await raffleContract.enterClaimsMode();
      inClaimsMode = await raffleContract.inClaimsMode();
      expect(inClaimsMode).to.be.true;
    });
    it("should not be callable by anyone other than the owner before the targetBalance is reached", async function() {
      let inClaimsMode;
      inClaimsMode = await raffleContract.inClaimsMode();
      expect(inClaimsMode).to.be.false;
      await expect(raffleContract.connect(nonOwner).enterClaimsMode()).to.eventually.be.rejected;
      inClaimsMode = await raffleContract.inClaimsMode();
      expect(inClaimsMode).to.be.false;
    });
    it("should not be callable by anyone after the winner is picked but before punks are purchased or the deadline passes", async function() {
      await raffleContract.setTargetBalance(parseEther("3"));
      await raffleContract.connect(nonOwner).deposit({
        value: parseEther("3")
      });
      await raffleContract.selectWinner();

      let inClaimsMode;
      inClaimsMode = await raffleContract.inClaimsMode();
      expect(inClaimsMode).to.be.false;

      await expect(raffleContract.connect(nonOwner).enterClaimsMode()).to.eventually.be.rejected;
      inClaimsMode = await raffleContract.inClaimsMode();
      expect(inClaimsMode).to.be.false;

      await expect(raffleContract.enterClaimsMode()).to.eventually.be.rejected;
      inClaimsMode = await raffleContract.inClaimsMode();
      expect(inClaimsMode).to.be.false;

      /*
      const t0 = solidityDateToJS((await ethers.provider.getBlock('latest')).timestamp);
      await ethers.provider.send("evm_increaseTime", [DEFINITELY_BEYOND_DEADLINE]);
      await ethers.provider.send("evm_mine");
      const t1 = solidityDateToJS((await ethers.provider.getBlock('latest')).timestamp);
      console.log({t0, t1});
      */
      await ethers.provider.send("evm_increaseTime", [BEYOND_DEADLINE]);
      await ethers.provider.send("evm_mine");
      await raffleContract.connect(nonOwner).enterClaimsMode();
      inClaimsMode = await raffleContract.inClaimsMode();
      expect(inClaimsMode).to.be.true;
    });
    it("should be callable by anyone if the owner misses the deadline", async function() {
      const PUNK_COST = parseEther("1.5");
      const punkHolder = ethers.Wallet.createRandom().connect(ethers.provider);
      await owner.sendTransaction({
        to: punkHolder.address,
        value: parseEther("1")
      });
      await punksContract.setInitialOwners(
        Array.from({ length: 100 }, () => punkHolder.address),
        Array.from({ length: 100 }, (_, index) => index)
      );
      await punksContract.allInitialOwnersAssigned();
      await punksContract.connect(punkHolder).offerPunkForSale(0, PUNK_COST);

      await raffleContract.setTargetBalance(parseEther("3"));
      await raffleContract.connect(nonOwner).deposit({
        value: parseEther("3")
      });
      await raffleContract.selectWinner();
      
      // Winner buys punk but owner does not
      await raffleContract.connect(nonOwner).buyPunk(0, PUNK_COST);
      expect(
        await punksReaderContract.callStatic.ownerOf(0)
      ).to.equal(nonOwner.address);

      await ethers.provider.send("evm_increaseTime", [BEYOND_DEADLINE]);
      await ethers.provider.send("evm_mine");
      expect(await raffleContract.inClaimsMode()).to.be.false;
      await raffleContract.connect(nonOwner).enterClaimsMode();
      expect(await raffleContract.inClaimsMode()).to.be.true;
    });
    it("should be callable by anyone if the winner misses the deadline", async function() {
      const PUNK_COST = parseEther("1.5");
      const punkHolder = ethers.Wallet.createRandom().connect(ethers.provider);
      await owner.sendTransaction({
        to: punkHolder.address,
        value: parseEther("1")
      });
      await punksContract.setInitialOwners(
        Array.from({ length: 100 }, () => punkHolder.address),
        Array.from({ length: 100 }, (_, index) => index)
      );
      await punksContract.allInitialOwnersAssigned();
      await punksContract.connect(punkHolder).offerPunkForSale(0, PUNK_COST);

      await raffleContract.setTargetBalance(parseEther("3"));
      await raffleContract.connect(nonOwner).deposit({
        value: parseEther("3")
      });
      await raffleContract.selectWinner();
      
      // Owner buys punk but winner does not
      await raffleContract.buyPunk(0, PUNK_COST);
      expect(
        await punksReaderContract.callStatic.ownerOf(0)
      ).to.equal(owner.address);

      await ethers.provider.send("evm_increaseTime", [BEYOND_DEADLINE]);
      await ethers.provider.send("evm_mine");
      expect(await raffleContract.inClaimsMode()).to.be.false;
      await raffleContract.connect(nonOwner).enterClaimsMode();
      expect(await raffleContract.inClaimsMode()).to.be.true;
    });
    it("should be callable by anyone once the owner and winner have purchased punks", async function() {
      const PUNK_COST = parseEther("1.5");
      const punkHolder = ethers.Wallet.createRandom().connect(ethers.provider);
      await owner.sendTransaction({
        to: punkHolder.address,
        value: parseEther("1")
      });
      await punksContract.setInitialOwners(
        Array.from({ length: 100 }, () => punkHolder.address),
        Array.from({ length: 100 }, (_, index) => index)
      );
      await punksContract.allInitialOwnersAssigned();
      await punksContract.connect(punkHolder).offerPunkForSale(0, PUNK_COST);
      await punksContract.connect(punkHolder).offerPunkForSale(1, PUNK_COST);

      const winner = (await ethers.getSigners())[2];
      await raffleContract.setTargetBalance(parseEther("3"));
      await raffleContract.connect(winner).deposit({
        value: parseEther("3")
      });
      await raffleContract.selectWinner();
      
      await raffleContract.buyPunk(0, PUNK_COST);
      expect(
        await punksReaderContract.callStatic.ownerOf(0)
      ).to.equal(owner.address);

      await raffleContract.connect(winner).buyPunk(1, PUNK_COST);
      expect(
        await punksReaderContract.callStatic.ownerOf(1)
      ).to.equal(winner.address);

      expect(await raffleContract.inClaimsMode()).to.be.false;
      await raffleContract.connect(nonOwner).enterClaimsMode();
      expect(await raffleContract.inClaimsMode()).to.be.true;
    });
  });

  describe("claim", function() {
    const NUM_WALLETS = 5;
    const NUM_DEPOSIT_ROUNDS = 4;
    let totalDepositedPerRound = 0;
    for(let i = 0; i < NUM_WALLETS; i++) {
      totalDepositedPerRound += i + 1;
    }

    const wallets = loadWalletsFromFile('privateKeys.txt', NUM_WALLETS);
    const punkHolder = ethers.Wallet.createRandom().connect(ethers.provider);
    let winner;
    
    before(async function() {
      // Send each wallet initial funds
      for(let i = 0; i < wallets.length; i++) {
        await owner.sendTransaction({
          to: wallets[i].address,
          value: parseEther("50"),
        });
      }

      // Give punkHolder some ETH
      await owner.sendTransaction({
        to: punkHolder.address,
        value: parseEther("1")
      });
    });

    beforeEach(async function() {
      // Give the punkHolder the punks
      await punksContract.setInitialOwners(
        Array.from({ length: 100 }, () => punkHolder.address),
        Array.from({ length: 100 }, (_, index) => index)
      );
      await punksContract.allInitialOwnersAssigned();

      // List the punks
      const PUNK_COST = parseEther((totalDepositedPerRound * NUM_DEPOSIT_ROUNDS / 4).toString());
      await punksContract.connect(punkHolder).offerPunkForSale(0, PUNK_COST);
      expect(
        await punksReaderContract.callStatic.ownerOf(0)
      ).to.equal(punkHolder.address);
      await punksContract.connect(punkHolder).offerPunkForSale(1, PUNK_COST);
      expect(
        await punksReaderContract.callStatic.ownerOf(1)
      ).to.equal(punkHolder.address);

      // Set the target balance for the raffle
      await raffleContract.setTargetBalance(
        parseEther((totalDepositedPerRound * NUM_DEPOSIT_ROUNDS).toString())
      );
      
      // Make raffle entries
      for(let i = 0; i < NUM_DEPOSIT_ROUNDS; i++) {
        for(let j = 0; j < NUM_WALLETS; j++) {
          await raffleContract.connect(wallets[j]).deposit({
            // Each wallet will deposit <their position in the array + 1> ETH per tx
            value: parseEther("1").mul(j + 1)
          });
        }
      }

      // Pick winner
      await raffleContract.selectWinner();
      const winnerAddress = await raffleContract.winner();
      winner = wallets.find(w => w.address === winnerAddress);
    
      // Owner buys punk
      await raffleContract.buyPunk(0, PUNK_COST);
      expect(
        await punksReaderContract.callStatic.ownerOf(0)
      ).to.equal(owner.address);

      // Winner buys punk
      await raffleContract.connect(winner).buyPunk(1, PUNK_COST);
      expect(
        await punksReaderContract.callStatic.ownerOf(1)
      ).to.equal(winner.address);

      expect(await raffleContract.inClaimsMode()).to.be.false;
      await raffleContract.enterClaimsMode();
    });

    it("should only be callable by depositors once", async function() {
      expect(await raffleContract.inClaimsMode()).to.be.true;

      let processedWinner = false;
      let processedAnyoneElse = false;
      for(let i = 0; i < NUM_WALLETS; i++) {
        if(wallets[i] === winner) {
          await expect(
            raffleContract.connect(winner).claim(),
            "The winner doesn't get to claim"
          ).to.eventually.be.rejected;
          processedWinner = true;
        } else {
          await raffleContract.connect(wallets[i]).claim();
          processedAnyoneElse = true;
        }
      }
      expect(processedWinner).to.be.true;
      expect(processedAnyoneElse).to.be.true;

      for(let i = 0; i < NUM_WALLETS; i++) {
        await expect(raffleContract.connect(wallets[i]).claim()).to.eventually.be.rejected;
      }
    });
    it("should not be callable by non-depositors", async function() {
      const wallets = loadWalletsFromFile('privateKeys.txt', 1000);
      await owner.sendTransaction({
        to: wallets[999].address,
        value: parseEther("1")
      });

      await expect(raffleContract.connect(wallets[999]).claim()).to.eventually.be.rejected;
      await expect(raffleContract.claim()).to.eventually.be.rejected;
    });
    it("should distribute a proportional amount of the ETH remaining based on deposits", async function() {
      const totalDeposited = await raffleContract.totalDeposited();
      const winnerDepositAmount = await raffleContract.getAmountDeposited(winner.address);
      const postPunkPurchasesBalance = await raffleContract.postPunkPurchasesBalance();

      // beforeEach had accounts deposit 1, 2, 3, 4, and 5 ETH four times each for a total of 60 ETH.
      // The amount spent on the two punks totaled 30 ETH.
      // Since the winner's ETH deposit is staying in the contract that leaves either:
      // - Winner contributed 1 ETH per round: 26 ETH
      // - Winner contributed 2 ETH per round: 22 ETH
      // - Winner contributed 3 ETH per round: 18 ETH
      // - Winner contributed 4 ETH per round: 14 ETH
      // - Winner contributed 5 ETH per round: 10 ETH
      const descalingFactor = 1_000_000_000_000;
      const numerator = (totalDeposited.sub(winnerDepositAmount)).div(descalingFactor);
      const denominator = postPunkPurchasesBalance.div(descalingFactor);
      const ratio = numerator / denominator;

      for(let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        const amountDeposited = await raffleContract.getAmountDeposited(wallet.address);
        const claimableAmount = await raffleContract.getClaimAmount(wallet.address);

        if(wallet === winner) {
          expect(claimableAmount).to.equal(0);
          await expect(raffleContract.connect(winner).claim()).to.eventually.be.rejected;
        } else {
          // Because we're doing stupid stuff with division and decimals and big numbers these
          // claimableAmount * ratio is not always exactly equal to the amount deposited, but it
          // gets within a few gwei.
          expect(
            Math.ceil(claimableAmount.div(descalingFactor).toNumber() * ratio) - amountDeposited.div(descalingFactor),
            "The claimableAmount should be the amount amountDeposited times the ratio"
          ).to.be.lessThan(2);

          const b0 = await ethers.provider.getBalance(wallet.address);
          const tx = await raffleContract.connect(wallet).claim();
          const receipet = await tx.wait();
          const totalGas = receipet.cumulativeGasUsed.mul(receipet.effectiveGasPrice);
          const b1 = await ethers.provider.getBalance(wallet.address);
          const claimedAmount = b1.add(totalGas).sub(b0);
          expect(claimedAmount).to.equal(claimableAmount);
        }
      }
    });
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
        const promise = raffleContract.connect(wallet).deposit({
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

      await raffleContract.enterClaimsMode();

      const totalDeposited = await raffleContract.totalDeposited();
      const postPunkPurchasesBalance = await raffleContract.postPunkPurchasesBalance();
      const claimableAmountPerAddress = postPunkPurchasesBalance.div(participantAddresses.length - 1); /* -1 because the winner doesn't get a claim */
      console.log({
        totalDeposited: formatEther(totalDeposited),
        PUNK_COST_1: formatEther(PUNK_COST_1),
        PUNK_COST_2: formatEther(PUNK_COST_2),
        postPunkPurchasesBalance: formatEther(postPunkPurchasesBalance),
        numLosers: participantAddresses.length - 1,
        claimableAmountPerAddress: formatEther(claimableAmountPerAddress),
      });
      expect(
        totalDeposited.sub(PUNK_COST_1).sub(PUNK_COST_2),
        "The postPunkPurchasesBalance should be correct"
      ).to.equal(postPunkPurchasesBalance);

      const addresses = Object.keys(addressesToWallets);
      let processedWinner = false;
      let processedAnyoneElse = false;
      for (let i = 0; i < addresses.length; i++) {
        const wallet = addressesToWallets[addresses[i]];
        const claimableAmount = await raffleContract.getClaimAmount(wallet.address);
        const b0 = await ethers.provider.getBalance(wallet.address);
        if(addresses[i] === winner) {
          expect(claimableAmount).to.equal(0);
          await expect(raffleContract.connect(winner).claim()).to.eventually.be.rejected;
          processedWinner = true;
        } else {
          expect(
            claimableAmount,
            "The claimble amount reported by the contract should match the value we calculated in the test"
          ).to.equal(claimableAmountPerAddress);

          const tx = await raffleContract.connect(wallet).claim();
          const receipet = await tx.wait();
          const totalGas = receipet.cumulativeGasUsed.mul(receipet.effectiveGasPrice);
          const b1 = await ethers.provider.getBalance(wallet.address);
          const claimedAmount = b1.add(totalGas).sub(b0);
          processedAnyoneElse = true;
          /*
          console.log({
            b0: formatEther(b0),
            gasUsed: formatEther(totalGas),
            b1: formatEther(b1),
            refunded: formatEther(claimedAmount)
          });
          */
          expect(
            claimedAmount,
            "The amount claimed should be the value we calculated in the test"
          ).to.equal(claimableAmountPerAddress);
        }
      }
      expect(processedWinner, "The winner should be processed").to.be.true;
      expect(processedAnyoneElse, "At least one other should be processed").to.be.true;

      const amountRemaining = postPunkPurchasesBalance.sub(claimableAmountPerAddress.mul(wallets.length - 1));
      console.log("Remaining balance after claims:", formatEther(amountRemaining));
      expect(
        amountRemaining,
        "Only dust should be left that could not be divided among all claimers should be left"
      ).is.lessThan(wallets.length - 1);

      const rcb0 = await ethers.provider.getBalance(raffleContract.address);
      expect(rcb0).to.equal(amountRemaining);

      // The owner can't sweep for 60 days.
      await expect(
        raffleContract.sweep()
      ).to.eventually.be.rejected;

      // Advance time so sweeping is possible
      await ethers.provider.send("evm_increaseTime", [BEYOND_DEADLINE]);
      await ethers.provider.send("evm_mine");

      const ownerBalance1 = await ethers.provider.getBalance(owner.address);
      const tx = await raffleContract.sweep();
      const receipet = await tx.wait();
      const totalGas = receipet.cumulativeGasUsed.mul(receipet.effectiveGasPrice);
      const ownerBalance2 = await ethers.provider.getBalance(owner.address);

      console.log("Owner balance before sweep:", formatEther(ownerBalance1));
      console.log("Gas spent:", formatEther(totalGas));
      console.log("Owner balance after sweep:", formatEther(ownerBalance2));
      console.log("Amount swept:", formatEther(ownerBalance2.sub(ownerBalance1).add(totalGas)));

      expect(ownerBalance1.sub(totalGas).add(amountRemaining)).to.be.equal(ownerBalance2);

      const rcb1 = await ethers.provider.getBalance(raffleContract.address);
      console.log("Final contract balance:", formatEther(rcb1));
      expect(rcb1).to.equal(0);

      /*const addresses = Object.keys(winnerCounts);
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        expect(winnerCounts[address] > 0, `${address} never won :(`).to.be.true;
      }*/
    });
  });
});

describe("APunkForYouAndMe - Multiple iterations", function() {

  let gasliteDropContract: any;
  let punksContract: any;
  //let punksReaderContract: any;
  let owner: any;
  //let punkHolder: any;
  
  before(async () => {
    owner = (await ethers.getSigners())[0];

    const gasliteDropContractFactory = await ethers.getContractFactory("GasliteDrop");
    gasliteDropContract = await gasliteDropContractFactory.deploy();
    gasliteDropContract.deployed();
  })

  beforeEach(async () => {
    const cryptoPunksMarketContractFactory = await ethers.getContractFactory("CryptoPunksMarket");
    punksContract = await cryptoPunksMarketContractFactory.deploy()
    await punksContract.deployed();

    /*
    const cryptoPunksMarketReaderContractFactory = await ethers.getContractFactory("CryptoPunksMarketReader");
    punksReaderContract = await cryptoPunksMarketReaderContractFactory.deploy();
    await punksReaderContract.deployed();
    await punksReaderContract.setPunksContract(punksContract.address);
 
    const owner = (await ethers.getSigners())[0];
    punkHolder = ethers.Wallet.createRandom().connect(ethers.provider);

    await owner.sendTransaction({
      to: punkHolder.address,
      value: parseEther("1")
    });

    await punksContract.setInitialOwners(
      Array.from({ length: 100 }, () => punkHolder.address),
      Array.from({ length: 100 }, (_, index) => index)
    );
    await punksContract.allInitialOwnersAssigned();
    */
  });

  describe("buyPunk", async function() {
    it("should pick every depositor at least once", async function() {
      const NUM_ITERATIONS = 30;
      const NUM_WALLETS = 5;

      const wallets = loadWalletsFromFile('privateKeys.txt', NUM_WALLETS);
      for(let i = 0; i < wallets.length; i++) {
        await owner.sendTransaction({
          to: wallets[i].address,
          value: parseEther((NUM_ITERATIONS + 1).toString())
        });
      }

      const winCounts = {};
      wallets.forEach(w => winCounts[w.address] = 0);

      for(let i = 0; i < NUM_ITERATIONS; i++) {
        // Deploy basic points calculator
        const calculatorContractFactory = await ethers.getContractFactory("BasicPointsCalculator");
        const calculatorContract = await calculatorContractFactory.deploy();
        
        // Deploy raffle contract
        const raffleContractFactory = await ethers.getContractFactory("APunkForYouAndMe");
        const raffleContract = await raffleContractFactory.deploy();
        await raffleContract.deployed();
        await raffleContract.setPunksContract(punksContract.address);
        await raffleContract.setTargetBalance(parseEther(NUM_WALLETS.toString()));
        await raffleContract.setEntryCalculator(calculatorContract.address);

        // Make raffle entries
        for(let j = 0; j < NUM_WALLETS; j++) {
          await raffleContract.connect(wallets[j]).deposit({
            value: parseEther("1")
          });
        }

        // Make raffle entries
        const pointsPerAddress = {};
        for(let j = 0; j < NUM_WALLETS; j++) {
          const numPoints = await raffleContract.getPointsForAddress(wallets[j].address);
          expect(numPoints).to.equal(parseEther("2")); // BasicPointsCalculator gives 2 points per 1 wei
        }

        // Pick winner
        await raffleContract.selectWinner();
        const winnerAddress = await raffleContract.winner();
        winCounts[winnerAddress]++;
      }

      console.log({winCounts})
      for(let i = 0; i < wallets.length; i++) {
        expect(winCounts[wallets[i].address]).to.be.greaterThan(0);
      }
    });
    it("should give odds to people with more points", async function() {
      const NUM_ITERATIONS = 30;
      const NUM_WALLETS = 5;

      const wallets = loadWalletsFromFile('privateKeys.txt', NUM_WALLETS);
      for(let i = 0; i < wallets.length; i++) {
        await owner.sendTransaction({
          to: wallets[i].address,
          value: parseEther(((NUM_ITERATIONS * 10) + 1).toString())
        });
      }

      const winCounts = {};
      wallets.forEach(w => winCounts[w.address] = 0);

      for(let i = 0; i < NUM_ITERATIONS; i++) {
        const calculatorContractFactory = await ethers.getContractFactory("ReferralPointsCalculator");
        const calculatorContract = await calculatorContractFactory.deploy();
        
        // Deploy raffle contract
        const raffleContractFactory = await ethers.getContractFactory("APunkForYouAndMe");
        const raffleContract = await raffleContractFactory.deploy();
        await raffleContract.deployed();
        await raffleContract.setPunksContract(punksContract.address);
        await raffleContract.setTargetBalance(parseEther("14"));
        await raffleContract.setEntryCalculator(calculatorContract.address);

        await calculatorContract.setReferrerLookup(raffleContract.address);

        // Make raffle entries
        for(let j = 0; j < NUM_WALLETS; j++) {
          await raffleContract.connect(wallets[j]).deposit({
            value: j === 0 ? parseEther("10") : parseEther("1")
          });
        }

        // Pick winner
        await raffleContract.selectWinner();
        const winnerAddress = await raffleContract.winner();
        winCounts[winnerAddress]++;
      }

      let whaleBidderWins = 0;
      let everyoneElseWins = 0;
      Object.keys(winCounts).forEach(address => {
        if(address == wallets[0].address) {
          whaleBidderWins += winCounts[address];
        } else {
          everyoneElseWins += winCounts[address];
        }
      })

      // Whale is putting in 10 while everyone else is putting in a total of 4,
      // so the whale should win a little more than half the time. For the purposes
      // of this test though we can more definitively say they will win more often
      // than everyone else combined.
      expect(whaleBidderWins > everyoneElseWins).to.be.true;
    });
  });
});