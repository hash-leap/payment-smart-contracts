/* global ethers */
import { Contract } from "ethers";
import { ethers } from "hardhat";

const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

export interface Selectors extends Array<string> {
  contract: Contract;
  remove: (functionNames: string[]) => Selectors;
  get: (functionNames: string[]) => Selectors;
}

// get function selectors from ABI
function getSelectors(contract: Contract): Selectors {
  const signatures = Object.keys(contract.interface.functions);
  const selectors: Selectors = signatures.reduce((acc, val) => {
    if (val !== "init(bytes)") {
      acc.push(contract.interface.getSighash(val));
    }
    return acc;
  }, [] as string[]) as Selectors;
  selectors.contract = contract;
  selectors.remove = remove;
  selectors.get = get;

  return selectors;
}

// get function selector from function signature
function getSelector(func: string): string {
  const abiInterface = new ethers.utils.Interface([func]);
  return abiInterface.getSighash(ethers.utils.Fragment.from(func));
}

// used with getSelectors to remove selectors from an array of selectors
// functionNames argument is an array of function signatures
function remove(this: Selectors, functionNames: string[]): Selectors {
  const selectors = this.filter((v) => {
    for (const functionName of functionNames) {
      if (v === this.contract.interface.getSighash(functionName)) {
        return false;
      }
    }
    return true;
  }) as Selectors;
  selectors.contract = this.contract;
  selectors.remove = this.remove;
  selectors.get = this.get;
  return selectors;
}

// used with getSelectors to get selectors from an array of selectors
// functionNames argument is an array of function signatures
function get(this: Selectors, functionNames: string[]): Selectors {
  const selectors = this.filter((v) => {
    for (const functionName of functionNames) {
      if (v === this.contract.interface.getSighash(functionName)) {
        return true;
      }
    }
    return false;
  }) as Selectors;
  selectors.contract = this.contract;
  selectors.remove = this.remove;
  selectors.get = this.get;
  return selectors;
}

// remove selectors using an array of signatures
function removeSelectors(
  selectors: Selectors,
  signatures: string[]
): Selectors {
  const iface = new ethers.utils.Interface(
    signatures.map((v) => "function " + v)
  );
  const removeSelectors = signatures.map((v) => iface.getSighash(v));
  selectors = selectors.filter(
    (v) => !removeSelectors.includes(v)
  ) as Selectors;
  return selectors;
}

// find a particular address position in the return value of diamondLoupeFacet.facets()
function findAddressPositionInFacets(
  facetAddress: string,
  facets: Contract[]
): number {
  for (let i = 0; i < facets.length; i++) {
    if (facets[i].facetAddress === facetAddress) {
      return i;
    }
  }
  throw new Error(`Could not find facet address ${facetAddress} in facets`);
}

export {
  getSelectors,
  getSelector,
  FacetCutAction,
  remove,
  removeSelectors,
  findAddressPositionInFacets,
};
