import externalContracts from "~~/contracts/externalContracts";

/**
 * GET /abi.json — the SlopComputer contract ABI + address, so an agent
 * following skill.md can make onchain reads without hand-rolling ABI
 * encoding from the docs. Static in both build modes.
 */
export const dynamic = "force-static";

export async function GET() {
  const { address, abi } = externalContracts[1].SlopComputer;
  return Response.json(
    { name: "SlopComputer", chainId: 1, address, abi },
    { headers: { "access-control-allow-origin": "*" } },
  );
}
