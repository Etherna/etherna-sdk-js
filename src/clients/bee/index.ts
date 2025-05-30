// Forked from: https://github.com/ethersphere/bee

import { BaseClient } from "../base-client"
import { Auth } from "./auth"
import { Bytes } from "./bytes"
import { Bzz } from "./bzz"
import { ChainState } from "./chainstate"
import { Chunk } from "./chunk"
import { Feed } from "./feeds"
import { Offers } from "./offers"
import { Pins } from "./pins"
import { Soc } from "./soc"
import { Stamps } from "./stamps"
import { System } from "./system"
import { Tags } from "./tags"
import { User } from "./user"
import { EthAddress } from "@/types"
import { isEthAddress, makeInjectedWalletSigner, makePrivateKeySigner } from "@/utils"

import type { BaseClientOptions } from "../base-client"
import type { Signer } from "@/types/signer"

export type BeeChain = { name: "custom" | "gnosis" | "sepolia" | "goerli"; blockTime: number }

const ChainBlockTime: Record<BeeChain["name"], number> = {
  custom: 2,
  gnosis: 5,
  sepolia: 2,
  goerli: 15,
}

export interface BeeClientOptions extends BaseClientOptions {
  type?: "bee" | "etherna"
  signer?: Signer | string
  chain?: BeeChain
}

export class BeeClient extends BaseClient {
  signer?: Signer
  type: "bee" | "etherna"
  chain: BeeChain

  auth: Auth
  bytes: Bytes
  bzz: Bzz
  chainstate: ChainState
  chunk: Chunk
  feed: Feed
  pins: Pins
  soc: Soc
  stamps: Stamps
  tags: Tags
  offers: Offers
  user: User
  system: System

  constructor(
    public url: string,
    opts?: BeeClientOptions,
  ) {
    super(url, opts)

    this.signer =
      typeof opts?.signer === "string" ? makePrivateKeySigner(opts.signer) : opts?.signer
    this.type = opts?.type ?? "bee"
    this.chain = {
      name: opts?.chain?.name ?? "gnosis",
      blockTime: opts?.chain?.blockTime ?? ChainBlockTime[opts?.chain?.name ?? "gnosis"],
    }

    this.auth = new Auth(this)
    this.bytes = new Bytes(this)
    this.bzz = new Bzz(this)
    this.chainstate = new ChainState(this)
    this.chunk = new Chunk(this)
    this.feed = new Feed(this)
    this.pins = new Pins(this)
    this.soc = new Soc(this)
    this.stamps = new Stamps(this)
    this.tags = new Tags(this)
    this.offers = new Offers(this)
    this.user = new User(this)
    this.system = new System(this)
  }

  updateSigner(signer: Signer | EthAddress | string | undefined) {
    this.signer =
      typeof signer === "string"
        ? isEthAddress(signer)
          ? makeInjectedWalletSigner(signer)
          : makePrivateKeySigner(signer)
        : signer
  }
}
