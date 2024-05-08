# A Punk For You And Me

APunkForYouAndMe accepts ETH deposits until a particular target amount is reached. When that happens a raffle is run that selects a depositor as the winner. The selected depositor and the owner of the contract can then use the collected ETH to each buy a Cryptopunk from the punks marketplace contract.

The raffle is weighted based on each user's accumulated points. There are two phases and they are controlled by swapping out the `pointsCalculator` implementation in the APunkForYouAndMe contract.
1. BasicPointsCalculator - Each 1 wei deposited earns 2 points
2. ReferralPointsCalculator - Users can refer other users and boost their points and their referrals points. Users who use another depositor's referal code get 2 points per 1 wei. The referrer gets extra points equal to 10% of their referral's deposit amount. If someone who used a referral then refers someone else, the original "grand-referrer" gets an extra 2% of the deposit amount bonus to their ponts. Users who do not use a referal code get 1 point per wei during this phase.

Once both users have purchased their punks or one year has elapsed since the winner was selected, the contract can be put into claims mode. In claims mode the remaining ETH can then be withdrawn by depositors in prorportion to the amount they originally deposited. E.g. If the target is 150 ETH, 100 people each deposit 1.5 ETH, and the winner and the owner each buy a punk for 60 ETH that leaves 30 ETH in the contract. Each depositor can then withdraw 0.3 ETH.

The owner can sweep the contract of any unwithdrawn funds two months after claims mode starts. The plan is to bridge these funds to an L2 and gaslite drop them back to users who would otherwise be priced out of calling the claim method on mainnet.

The other contracts in the repo assist with testing:
- CryptoPunksMarket - A copy of the CryptoPunksMarket contract from mainnet with instances of 10000 dialed down to 100 for easier scaffolding in tests.
- CryptoPunksMarketReader - points at CryptoPunksMarket to give an easy way to tell which address owns which punk
- EtherForwarder - A small proxy contract for testing that only EOAs can interact with APunkForYouAndMe
- GasliteDrop - Hardhat chokes trying to spin up hundreds of accounts at startup. It's faster to create empty ones and give them ETH using GasliteDrop.