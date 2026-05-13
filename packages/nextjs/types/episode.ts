/**
 * Shape returned by SlopComputer (`getEpisodes`, `getEpisode`, `latest`,
 * `liveEpisode`). `contractAddr` is widened to `string` because
 * scaffold-eth's `GenericContract.abi: Abi` upcast loses abitype's address
 * narrowing.
 */
export type Episode = {
  readonly id: `0x${string}`;
  readonly name: string;
  readonly contractAddr: string;
  readonly url: string;
  readonly datetime: bigint;
  readonly nextId: `0x${string}`;
};

export const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const BGIPFS_GATEWAY = process.env.NEXT_PUBLIC_BGIPFS_GATEWAY || "https://community.bgipfs.com/ipfs";
const IPFS_PREFIX = "ipfs://";

export const isIpfsUrl = (url: string) => url.startsWith(IPFS_PREFIX);

/** Resolves an `ipfs://CID` to an HTTP gateway URL; passes other URLs through. */
export const watchUrl = (url: string) => (isIpfsUrl(url) ? `${BGIPFS_GATEWAY}/${url.slice(IPFS_PREFIX.length)}` : url);

/** YYYY-MM-DD from a unix-seconds bigint, or `"—"` for the zero-struct case. */
export const formatDate = (datetime: bigint) => {
  if (datetime === 0n) return "—";
  return new Date(Number(datetime) * 1000).toISOString().slice(0, 10);
};

export const isZeroEpisode = (ep: Episode | undefined) => !ep || ep.id === ZERO_BYTES32;
