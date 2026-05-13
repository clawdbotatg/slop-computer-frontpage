/**
 * Empty — slop.computer is frontend-only, with the live SlopComputer contract
 * registered in `externalContracts.ts` at its mainnet address.
 */
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const deployedContracts = {} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
