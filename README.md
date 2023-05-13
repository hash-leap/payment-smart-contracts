# Payment Contracts

This repo contains payment flow __Smart Contracts__ for the chains that HashLeap supports.

Our smart contracts are upgradeable since we want to iterate on them while testing different features. This brings the added challenge of making sure that we check the correctness of the contract on eash deploy properly. We may move away from upgrades as our contracts mature.

We use __Diamond Pattern__ (Multifaceted Proxy) for upgrading the contracts as it has some benefits over the proxy pattern. However, it is more complicated to use and implement. To read more on Diamond Pattern go to the ethereum EIP pages https://eips.ethereum.org/EIPS/eip-2535

Our base Payment contract is SpotPaymentFacetV1.

# Tests

We use `hardhat` and `hardhat-gas-reporter` for testing.

Run `npx hardhat test` to run all the tests

# Deployment

To deploy the diamond for the first time run

```
npx hardhat --network sepolia run scripts/deploy.ts
```

To deploy the base facet run 

```
npx hardhat run --network sepolia  scripts/deploySpotPaymentFacet.ts
```

# Example

We have a test contract currently deployed to https://testnet.bscscan.com/address/0x9a67df050425c5083e95d8caf781f5101f8cce5f
