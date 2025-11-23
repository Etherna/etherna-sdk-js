import type { EthAddress } from "./eth"

type SyncSigner = (digest: string | Uint8Array) => string
type AsyncSigner = (digest: string | Uint8Array) => Promise<string>

export type Signer = {
  sign: SyncSigner | AsyncSigner
  address: EthAddress
}
