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
};
