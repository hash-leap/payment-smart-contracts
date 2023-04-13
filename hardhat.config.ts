import "@nomiclabs/hardhat-waffle";
import "solidity-coverage";
import { task } from "hardhat/config";
import * as dotenv from "dotenv";
dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (_, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("account", "Prints the account at the index")
  .addParam("index", "Account index number")
  .setAction(async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    console.log(accounts[taskArgs.index].address);
  });
// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.18",
  defaultNetwork: "localhost",
  networks: {
    hardhat: {
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL,
      accounts: [process.env.ACCOUNT_PRIVATE_KEY]
    }, 
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_PRIVATE_KEY
  },
  paths: {
    artifacts: "./src/artifacts",
    tests: "tests"
  },
};