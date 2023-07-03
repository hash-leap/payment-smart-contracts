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
    bsc: String(process.env.BSC_RPC_URL),
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
      bsc: "0x664FB0022a4340dFEEf7Ff8484dA0b16F71D3780",
    },
    diamondInit: {
      sepolia: "",
      bsc_testnet: "0xf356F0Ef85676615cD66b069946b1C52930986df",
      bsc: "0xf4431456189211C8922FE38ec6A4e17e8F7f87C7",
    },
    diamondCutFacet: {
      sepolia: "",
      bsc_testnet: "0x737BE9d77be7589E154F273C887a4545a861bA36",
      bsc: "0xacfeBD4265b00E50e1eD6A8deCAd0e9D078a9cB0",
    },
    diamondLoupeFacet: {
      sepolia: "",
      bsc_testnet: "0x80d0ED42F76115cAF3CF6A79ad2f89A22833fC6E",
      bsc: "0x55D5133Ce4f7226a08bE7e4A8b31D8d914CD82A4",
    },
    ownershipFacet: {
      sepolia: "",
      bsc_testnet: "0x6112C62F8f0C3A2B4c559C8210E0DfB5Ed16bDFB",
      bsc: "0x946937E169a8c033123161468b745f26E4ebcdd6",
    },
    spotPaymentFacet: {
      sepolia: "",
      bsc_testnet: "0x67A6b5b908d3FDE6AFF074c18a405a825b3dde5C",
      bsc: "0x1F8f69EbD2aC44E9Fc5f097a16655e55a4482e14",
    },
    subscriptionFacet: {
      sepolia: "",
      bsc_testnet: "0x1e4edc37c23c7C587Fa7140d09814C4ed459A57D",
      bsc: "0xc815196866060B0E3f8982274f9Db7F841eF60A6",
    },
    crossChainPayment: {
      sepolia: "",
      bsc_testnet: "",
      bsc: "",
    },
  },
};
