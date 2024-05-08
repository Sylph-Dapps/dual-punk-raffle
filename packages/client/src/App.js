import React, {
  useEffect,
  useState,
} from 'react';
import { ethers } from 'ethers';
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import {
  createWeb3Modal,
  defaultConfig,
  useWeb3Modal,
  useWeb3ModalAccount,
  useWeb3ModalProvider,
  useDisconnect,
} from '@web3modal/ethers5/react';
import APunkForYouAndMe from './abis/APunkForYouAndMe.json';
import CopyIcon from './components/CopyIcon';
import DisconnectIcon from './components/DisconnectIcon';

import './App.scss';

const {
  parseEther,
  formatEther,
} = ethers.utils;

function cleanFormatEther(ether) {
  const v = formatEther(ether);
  // If the value formats to a value with just a 0 in the tenths place return only the integer part
  if(v.split(".")[1] === "0") {
    return v.split(".")[0]
  } else {
    return v;
  }
}

const BASE_URL = `https://apunkforyouandme.xyz`;
const LOCALHOST_NETWORK_ID = 31337;
const MAINNET_NETWORK_ID = 1;

const NETWORKS = {
  [LOCALHOST_NETWORK_ID]: {
    NETWORK_NAME: "Localhost",
    NETWORK_ID: LOCALHOST_NETWORK_ID,
    RAFFLE_CONTRACT_ADDRESS: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    EXPLORER_URL: "https://etherscan.io",
  },
  /*
  [BASE_GOERLI_NETWORK_ID]: {
    NETWORK_NAME: "Base Goerli",
    NETWORK_ID: BASE_GOERLI_NETWORK_ID,
    STORAGE_ADDRESS: "0x57da1ed69e97a35c163d262f6bb0fd109d4affa2",
    MINTER_ADDRESS: "0x8d8d8bc062cbac57c2d9d4d6fe346138d9d518f5",
  },
  [BASE_NETWORK_ID]: {
    NETWORK_NAME: "Base",
    NETWORK_ID: BASE_NETWORK_ID,
    STORAGE_ADDRESS: "0xB18A12b3B64cB374DE0fe51a41478Aa13F2DE5E3",
    MINTER_ADDRESS: "0x9EDe365aCF1d835Fa5976299E94f1D463b4E113C",
  }
  */
};
const NETWORK = NETWORKS[LOCALHOST_NETWORK_ID];

// Web3Modal setup
const projectId = 'ce0dbf03dd757d00d278f8bf6ec4afd0';
const mainnet = {
  chainId: MAINNET_NETWORK_ID,
  name: 'Ethereum',
  currency: 'ETH',
  explorerUrl: 'https://etherscan.io',
  rpcUrl: 'https://cloudflare-eth.com'
};
const hardhat = {
  chainId: LOCALHOST_NETWORK_ID,
  name: 'Localhost',
  currency: 'ETH',
  //explorerUrl: 'https://etherscan.io',
  rpcUrl: 'http://localhost:8545'
}
const ethersConfig = defaultConfig({
  metadata: {
    name: "A Punk For You And Me",
    description: 'A raffle for a cryptopunk',
    //url: 'https://onchainicecream.com', // origin must match your domain & subdomain
    url: 'http://localhost:3000',
    icons: ['https://avatars.mywebsite.com/']
  }
});
createWeb3Modal({
  ethersConfig,
  chains: [
    hardhat,
    //mainnet,
  ],
  projectId,
  enableAnalytics: true // Optional - defaults to your Cloud configuration
});

// Get the referral address from the URL query params
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
let referralAddress = '';
if (urlParams.has('r')) {
  referralAddress = urlParams.get('r');
}

const router = createBrowserRouter([
  { path: "*", Component: Root },
]);

let raffleContract;
let ethersProvider;

function formatAddress(address) {
  return address.substring(0,6) + "...";
}

function Root() {
  //const [signer, setSigner] = useState(null);

  // Contract state variables
  const [contractBalance, setContractBalance] = useState(null);
  const [contractTargetBalance, setContractTargetBalance] = useState(null);

  // User stats from contract
  const [amountDeposited, setAmountDeposited] = useState(null);
  const [points, setPoints] = useState(null);
  const [percent, setPercent] = useState(null);

  // UI state variables
  const [contribution, setContribution] = useState("");
  const [depositing, setDepositing] = useState(false);

  // Web3 modal hooks
  const { open } = useWeb3Modal();
  const { disconnect } = useDisconnect()
  const { address } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();

  useEffect(() => {
    async function setWalletFields() {
      if(walletProvider) {
        ethersProvider = new ethers.providers.Web3Provider(walletProvider);
        const signer = await ethersProvider.getSigner();
        //setSigner(signer);

        if(!signer) {
          return;
        }

        raffleContract = new ethers.Contract(
          NETWORK.RAFFLE_CONTRACT_ADDRESS,
          APunkForYouAndMe.abi,
          signer
        );

        loadContractState();
      }
    }
    setWalletFields();
  }, [address, walletProvider]);

  async function loadContractState() {
    const points = await raffleContract.getPointsForAddress(address);
    setPoints(points);

    const amountDeposited = await raffleContract.getAmountDeposited(address);
    setAmountDeposited(amountDeposited);

    const contractBalance = await ethersProvider.getBalance(raffleContract.address);
    setContractBalance(contractBalance);

    const contractTargetBalance = await raffleContract.targetBalance();
    setContractTargetBalance(contractTargetBalance);

    const b = Number(cleanFormatEther(contractBalance));
    setPercent((b/contractTargetBalance) * 100);
  }

  const handleContributionChange = event => {
    setContribution(event.target.value);
  };

  const handleSendEthClick = async () => {
    try {
      const tx = await raffleContract.deposit({
        value: parseEther(contribution.toString())
      });

      setDepositing(true);
      await tx.wait();
      setDepositing(false);
    } catch (error) {
      console.error("Error minting:", error);
    }
    loadContractState();
  };

  const handleDisconnectClick = () => {
    setPoints(null);
    setAmountDeposited(null);
    setContractBalance(null);
    disconnect();
  };

  const yourReferralUrl = `${BASE_URL}/?r=${address}`;

  const copyReflink = () => {
    navigator.clipboard.writeText(yourReferralUrl);
  }

  const targetMet = contractBalance >= contractTargetBalance; 
  const controlsContainerClassName = address ? "controls-container connected" : "controls-container";

  return (
    <div className="App">
      <header>A Punk For You And Me</header>

      <h2>We ❤️ Punks</h2>
      <p>You know you want one. And I do, too. Lets work together and see what we can do about that.</p>

      <div className={controlsContainerClassName}>
        <div className="controls">
          {!depositing &&
            <div>
              {!address &&
                <button onClick={open}>Connect wallet</button>
              }
              {address &&
                <>
                  <div className="items">
                    <div className="item">
                      {address &&
                        <div className="address-info">
                          <>
                            Connected as {formatAddress(address)}
                          </>
                          <DisconnectIcon onClick={handleDisconnectClick}/>
                        </div>
                      }
                      { !targetMet &&
                        <>
                          <div className="contribution-controls">
                            <div className="field-label">
                              ETH to contribute:
                            </div>
                            <div className="input-row">
                              <input 
                                type="text"
                                value={contribution}
                                onChange={handleContributionChange}
                              />
                              <button onClick={handleSendEthClick}>Send</button>
                              
                            </div>
                          </div>
                          {referralAddress &&
                            <div className="ref-info">
                              Referred by {formatAddress(referralAddress)}
                            </div>
                          }
                        </>
                      }
                    </div>
                  </div>
                </>
              }
            </div>
          }
          {depositing &&
            <div>Sending...</div>
          }
        </div>
        { contractBalance !== null &&
          <div className="items">
            <div className="item">
              <div className="label">Contract balance:</div>
              <div className="value">{cleanFormatEther(contractBalance)} ETH</div>
              {!targetMet &&
                <div>
                  [{Array.from(Array(20).keys()).map(n => {
                    if (percent < (n+1)*5) {
                      return "░";
                    } else {
                      return "▓ ";
                    }
                  })}]
                </div>
              }
              {targetMet &&
                <h3>🎉 We've met the target! The draw will happen soon! 🎉</h3>
              }
            </div>
          </div>
        }
        { (amountDeposited || points) &&
          <div className="items">
            {amountDeposited !== null &&
              <div className="item">
                <div className="label">Your contribution:</div>
                <div className="value">{cleanFormatEther(amountDeposited)} ETH</div>
              </div>
            }
            {points !== null &&
              <div className="item">
                <div className="label">Your points:</div>
                <div className="value">{cleanFormatEther(points)}</div>
              </div>
            }
          </div>
        }
        {(points > 0) && address &&
          <div className="items">
            <div className="item reflink">
              <div className="label">Your referral link:</div>
              <div className="value">
                <a href={yourReferralUrl} target="_blank" rel="noreferrer">{yourReferralUrl}</a>
                <CopyIcon onClick={copyReflink}/>
              </div>
            </div>
          </div>
        }
      </div>

      <h2>How this works</h2>
      <p>You get points proportional to the amount of ETH you contribute and for any ETH contributed using your referral code.</p>
      <p>Once <a href={`${NETWORK.EXPLORER_URL}/address/${NETWORK.RAFFLE_CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">the contract's</a> balance reaches <strong>150 ETH</strong>, a random address will be selected from the contributors as the winner. Your odds are proportional to your points.</p>
      <p><strong>The winner will be allocated 75 ETH from the contract to purchase a punk from the <a href="https://cryptopunks.app/cryptopunks/forsale" target="_blank" rel="noreferrer">Cryptopunks marketplace</a>.</strong></p>
      <p>The other 75 ETH will be allocated to me to be used in the same way.</p>
      <p>The contract enforces that the random selection of the winner is fair and that the funds can only be used to purchase punks.</p>
      <p>Any leftover ETH after the punks have been purchased can be claimed by the other contributors proportional to their contributions.</p>

      <h2>Early Contributor Period</h2>
      <p>For a limited time, you get double points when you contribute, no referral code required.</p>
      <h2>Referral Period</h2>
      <p>Eventually the double points bonus for contributors will be replaced with a referral system. It will work like this:</p>
      <ul>
        <li>If you use someone's referral code when you contribute, you get double points.</li>
        <li>If someone uses your referral code, you get bonus points equal to 10% of the contribution's base amount.</li>
        <li>If someone uses your referral code and then someone uses their referral code, you get a bonus equal to 2% of that contribution's points.</li>
      </ul>
      <p>Note: All bonus points from referrals are capped by your personal contribution.</p>

      <h2>Example:</h2>
      <ul>
        <li>The Early Contributor Period is opened.</li>
        <li>Alice contributes 3 ETH. She gets 6 ETH worth of points.</li>
        <li>Time passes, the Early Contributor Period closes, and the Referral Period opens.</li>
        <li>Bob contributes 1 ETH. He gets 1 ETH worth of points.</li>
        <li>Charlie uses Alice's referral code when contributing 1 ETH. He gets 2 ETH worth of points, and Alice gets an additional 0.1 ETH worth of points.</li>
        <li>Dave apes in using Charlie's referral code. He contributes 25 ETH, getting 50 ETH worth of points. Charlie's 10% bonus would be 2.5 ETH worth of points, but he only contributed 1 ETH so he only gets 1 ETH worth of bonus points. Alice's 2% "grandreferral" bonus nets her an additional 0.5 ETH in points.</li>
        <li>More punk appreciatooors contribute, getting the contract to 150 ETH.</li>
        <li>The drawing is held, and Dave wins!</li>
        <li>I purchase my punk through the contract, working with 75 ETH. But the punk only ends up costing 60 ETH, so the other 15 ETH sticks around in the contract.</li>
        <li>Dave uses all 75 ETH of his allocation on his punk.</li>
        <li>The Withdraw Period begins. 15 ETH of the original 150 is in the contract, so everyone can reclaim 10% of what they contributed. Alice can claim 0.3 ETH, Bob and Charlie can claim 0.1 ETH each, and so on. Actually, they get back slightly more than those values because they also split the percentage of the remaining ETH that came from Dave. Dave is okay with that though. He is taking home a Cryptopunk after all!</li>
        <li>Dave and I change our PFP's and we are eternally grateful to you for playing <i>A Punk For You and Me</i> 🙏</li>
      </ul>
    </div>
  );
};

function App() {
  return <RouterProvider router={router} />;
}

export default App;
