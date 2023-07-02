export default {
  companyName: "HashLeap",
  wssUrl: {
    bsc_testnet: String(process.env.BSC_TESTNET_WSS_URL),
    goerli: String(process.env.GOERLI_WSS_URL),
    sepolia: String(process.env.SEPOLIA_WSS_URL),
    mainnet: String(process.env.MAINNET_WSS_URL),
  },
  rpcUrl: {
    bsc_testnet: String(process.env.BSC_TESTNET_RPC_URL),
    goerli: String(process.env.GOERLI_RPC_URL),
    sepolia: String(process.env.SEPOLIA_RPC_URL),
    mainnet: String(process.env.MAINNET_RPC_URL),
  },
  privateKeys: {
    deployer: String(process.env.ACCOUNT_PRIVATE_KEY), // transfer asap to a secure account
    nonDeployer: String(process.env.NON_DEPLOYER_ACCOUNT_PRIVATE_KEY), // mainly used in testing scripts / tasks
    etherscan: String(process.env.ETHERSCAN_PRIVATE_KEY),
    bscscan: String(process.env.BSCSCAN_PRIVATE_KEY),
  },
  apiKeys: {
    infura: [
      String(process.env.INFURA_API_KEY),
      String(process.env.INFURA_API_SECRET),
    ],
  },
  contractAddresses: {
    diamond: {
      sepolia: "",
      bsc_testnet: "0xaC504dBF800Aa13d1E4d6043D032F4aF334Bc112",
    },
    diamondInit: {
      sepolia: "",
      bsc_testnet: "0xf356F0Ef85676615cD66b069946b1C52930986df",
    },
    diamondCutFacet: {
      sepolia: "",
      bsc_testnet: "0x737BE9d77be7589E154F273C887a4545a861bA36",
    },
    diamondLoupeFacet: {
      sepolia: "",
      bsc_testnet: "0x80d0ED42F76115cAF3CF6A79ad2f89A22833fC6E",
    },
    ownershipFacet: {
      sepolia: "",
      bsc_testnet: "0x6112C62F8f0C3A2B4c559C8210E0DfB5Ed16bDFB",
    },
    spotPaymentFacet: {
      sepolia: "",
      bsc_testnet: "0x67A6b5b908d3FDE6AFF074c18a405a825b3dde5C",
    },
    subscriptionFacet: {
      sepolia: "",
      bsc_testnet: "0x1e4edc37c23c7C587Fa7140d09814C4ed459A57D",
    },
    crossChainPayment: {
      sepolia: "",
      bsc_testnet: "",
    },
  },
};
