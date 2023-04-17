import {
  getSelectors,
  FacetCutAction,
  removeSelectors,
  findAddressPositionInFacets,
  Selectors,
} from "../scripts/libraries/diamond";

import { deployDiamond } from "../scripts/deploy";

import { assert, expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("DiamondTest", async () => {
  let diamondAddress: string;
  let diamondCutFacet: Contract;
  let diamondLoupeFacet: Contract;
  let ownershipFacet: Contract;
  let tx;
  let receipt;
  let result;
  const addresses: string[] = [];
  let signers: SignerWithAddress[];

  before(async () => {
    diamondAddress = await deployDiamond(); // deploy script deploys the Diamond and top level facets
    diamondCutFacet = await ethers.getContractAt(
      "DiamondCutFacet",
      diamondAddress
    );

    diamondLoupeFacet = await ethers.getContractAt(
      "DiamondLoupeFacet",
      diamondAddress
    );

    ownershipFacet = await ethers.getContractAt(
      "OwnershipFacet",
      diamondAddress
    );
  });

  it("should have three facets on deploy -- call to facetAddresses function", async () => {
    for (const address of await diamondLoupeFacet.facetAddresses()) {
      addresses.push(address);
    }

    assert.equal(addresses.length, 3);
  });

  it("facets should have the right function selectors -- call to facetFunctionSelectors function", async () => {
    let selectors = getSelectors(diamondCutFacet);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[0]);
    assert.sameMembers(result, selectors);

    selectors = getSelectors(diamondLoupeFacet);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[1]);
    assert.sameMembers(result, selectors);

    selectors = getSelectors(ownershipFacet);
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[2]);
    assert.sameMembers(result, selectors);
  });

  it("selectors should be associated to facets correctly -- multiple calls to facetAddress function", async () => {
    assert.equal(
      addresses[0],
      await diamondLoupeFacet.facetAddress("0x1f931c1c")
    );
    assert.equal(
      addresses[1],
      await diamondLoupeFacet.facetAddress("0xcdffacc6")
    );
    assert.equal(
      addresses[1],
      await diamondLoupeFacet.facetAddress("0x01ffc9a7")
    );
    assert.equal(
      addresses[2],
      await diamondLoupeFacet.facetAddress("0xf2fde38b")
    );
  });

  it("should add SpotPayment functions", async () => {
    const SpotPaymentFacetV1 = await ethers.getContractFactory(
      "SpotPaymentFacetV1"
    );
    const spotPaymentFacetV1 = await SpotPaymentFacetV1.deploy();
    await spotPaymentFacetV1.deployed();
    addresses.push(spotPaymentFacetV1.address);
    const selectors = getSelectors(spotPaymentFacetV1);

    tx = await diamondCutFacet.diamondCut(
      [
        {
          facetAddress: addresses[3],
          action: FacetCutAction.Add,
          functionSelectors: selectors,
        },
      ],
      ethers.constants.AddressZero,
      "0x",
      { gasLimit: 800000 }
    );
    receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`);
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3]);
    assert.sameMembers(result, selectors);
  });

  it("should test function call", async () => {
    signers = await ethers.getSigners();
    const myTestERC20Factory = await ethers.getContractFactory("MyTestERC20");
    const myTestERC20 = await myTestERC20Factory.deploy();
    await myTestERC20.deployed();

    const spotPaymentFacet = await ethers.getContractAt(
      "SpotPaymentFacetV1",
      diamondAddress
    );
    await myTestERC20.mint(signers[0].address, 200000);
    await myTestERC20.approve(diamondAddress, 20000);
    await spotPaymentFacet.transfer(
      signers[0].address,
      signers[1].address,
      myTestERC20.address,
      20000
    );
    expect(await myTestERC20.balanceOf(signers[0].address)).to.eq(180000);
    expect(await myTestERC20.balanceOf(signers[1].address)).to.eq(20000);
  });

  it("should replace transfer function", async () => {
    const SpotPaymentFacetV1 = await ethers.getContractFactory(
      "SpotPaymentFacetV1"
    );
    const spotPaymentFacetV1 = await SpotPaymentFacetV1.deploy();
    const selectors = getSelectors(spotPaymentFacetV1).get([
      "transfer(address,address,address,uint256)",
    ]);
    const testFacetAddress = spotPaymentFacetV1.address;
    tx = await diamondCutFacet.diamondCut(
      [
        {
          facetAddress: testFacetAddress,
          action: FacetCutAction.Replace,
          functionSelectors: selectors,
        },
      ],
      ethers.constants.AddressZero,
      "0x",
      { gasLimit: 800000 }
    );
    receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`);
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(testFacetAddress);
    assert.sameMembers(result, getSelectors(spotPaymentFacetV1));
  });

  it("should remove some spotPaymentFacet functions", async () => {
    const SpotPaymentFacetV1 = await ethers.getContractFactory(
      "SpotPaymentFacetV1"
    );
    const spotPaymentFacetV1 = await SpotPaymentFacetV1.deploy();
    const functionToTest = ["transfer(address,address,address,uint256)"];

    const selectors = getSelectors(spotPaymentFacetV1).get(functionToTest);

    tx = await diamondCutFacet.diamondCut(
      [
        {
          facetAddress: ethers.constants.AddressZero,
          action: FacetCutAction.Remove,
          functionSelectors: selectors,
        },
      ],
      ethers.constants.AddressZero,
      "0x",
      { gasLimit: 800000 }
    );
    receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`);
    }
    result = await diamondLoupeFacet.facetFunctionSelectors(
      spotPaymentFacetV1.address
    );
    assert.sameMembers(
      result,
      getSelectors(spotPaymentFacetV1).remove(functionToTest)
    );
  });

  it("remove all functions and facets except 'diamondCut' and 'facets'", async () => {
    let selectors: Selectors = [] as unknown as Selectors;
    let facets = await diamondLoupeFacet.facets();
    for (let i = 0; i < facets.length; i++) {
      selectors.push(...facets[i].functionSelectors);
    }
    selectors = removeSelectors(selectors, [
      "facets()",
      "diamondCut(tuple(address,uint8,bytes4[])[],address,bytes)",
    ]);
    tx = await diamondCutFacet.diamondCut(
      [
        {
          facetAddress: ethers.constants.AddressZero,
          action: FacetCutAction.Remove,
          functionSelectors: selectors,
        },
      ],
      ethers.constants.AddressZero,
      "0x",
      { gasLimit: 800000 }
    );
    receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`);
    }
    facets = await diamondLoupeFacet.facets();
    assert.equal(facets.length, 2);
    assert.equal(facets[0][0], addresses[0]);
    assert.sameMembers(facets[0][1], ["0x1f931c1c"]);
    assert.equal(facets[1][0], addresses[1]);
    assert.sameMembers(facets[1][1], ["0x7a0ed627"]);
  });

  it("add most functions and facets", async () => {
    const diamondLoupeFacetSelectors = getSelectors(diamondLoupeFacet).remove([
      "supportsInterface(bytes4)",
    ]);
    const SpotPaymentFacetV1 = await ethers.getContractFactory(
      "SpotPaymentFacetV1"
    );
    const spotPaymentFacetV1 = await SpotPaymentFacetV1.deploy();
    // Any number of functions from any number of facets can be added/replaced/removed in a
    // single transaction
    const cut = [
      {
        facetAddress: addresses[1],
        action: FacetCutAction.Add,
        functionSelectors: diamondLoupeFacetSelectors.remove(["facets()"]),
      },
      {
        facetAddress: addresses[2],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(ownershipFacet),
      },
      {
        facetAddress: addresses[3],
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(spotPaymentFacetV1),
      },
      // Add new contracts here
    ];
    tx = await diamondCutFacet.diamondCut(
      cut,
      ethers.constants.AddressZero,
      "0x",
      { gasLimit: 8000000 }
    );
    receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Diamond upgrade failed: ${tx.hash}`);
    }
    const facets = await diamondLoupeFacet.facets();
    const facetAddresses = await diamondLoupeFacet.facetAddresses();
    assert.equal(facetAddresses.length, 4);
    assert.equal(facets.length, 4);
    assert.sameMembers(facetAddresses, addresses);
    assert.equal(facets[0][0], facetAddresses[0], "first facet");
    assert.equal(facets[1][0], facetAddresses[1], "second facet");
    assert.equal(facets[2][0], facetAddresses[2], "third facet");
    assert.equal(facets[3][0], facetAddresses[3], "fourth facet");
    // Add new contract assertion here
    assert.sameMembers(
      facets[findAddressPositionInFacets(addresses[0], facets)][1],
      getSelectors(diamondCutFacet)
    );
    assert.sameMembers(
      facets[findAddressPositionInFacets(addresses[1], facets)][1],
      diamondLoupeFacetSelectors
    );
    assert.sameMembers(
      facets[findAddressPositionInFacets(addresses[2], facets)][1],
      getSelectors(ownershipFacet)
    );
    assert.sameMembers(
      facets[findAddressPositionInFacets(addresses[3], facets)][1],
      getSelectors(spotPaymentFacetV1)
    );
    // Add new contracts here
  });
});
