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
      sepolia: "0xc7398ea77acc285bd44588f0a0440ec32bb4126b",
      bsc_testnet: "0x9a67df050425c5083e95d8caf781f5101f8cce5f",
    },
    diamondInit: {
      sepolia: "0x77ee2c8b32b958689a47f26d0b794cd686213ffb",
      bsc_testnet: "0x4fae96605bde241d7ba2958e91d2788d858e9814",
    },
    diamondCutFacet: {
      sepolia: "0xa33FA76265444dCe21e480041a7B7d371A3d28E6",
      bsc_testnet: "0x1f136935C071358e0f1233E6111CE6914B8a555B",
    },
    diamondLoupeFacet: {
      sepolia: "0xf46bcc8a98b51cab23e1f49c01b47e94fd1befa0",
      bsc_testnet: "0x53ab87ab2cb4f8207794c15751b6b80cdbf19c8e",
    },
    ownershipFacet: {
      sepolia: "0x25ed614bd9dd47676df94fc8d98c2e4bf6d0b8e4",
      bsc_testnet: "0x5ed241d67d856c138bdd4c4191ee188b24e800bf",
    },
    spotPaymentFacet: {
      sepolia: "0x7B6C3B617Fd3D46d4c7784598cF72D41f2d208C7",
      bsc_testnet: "0xd9d13A65138Afd6439109F2134D78797f4ac2907",
    },
    subscriptionFacet: {
      bsc_testnet: "",
    },
    crossChainPayment: {
      bsc_testnet: "0xD58B0ee3f7f8bC6E46B287aaA4f83a55cEC176F2",
    },
  },
};
