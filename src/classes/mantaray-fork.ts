// Forked from: https://github.com/ethersphere/mantaray-js

import { MantarayNode } from "./mantaray-node"
import { toBigEndianFromUint16 } from "@/utils"

import type { MetadataMapping } from "./mantaray-node"
import type { BytesReference } from "@/types/swarm"
import type { Bytes } from "@/types/utils"

const PADDING_BYTE = 0x0a

export class MantarayFork {
  /**
   * @param prefix the non-branching part of the subpath
   * @param node in memory structure that represents the Node
   */
  constructor(
    public prefix: Uint8Array,
    public node: MantarayNode,
  ) {}

  static nodeForkSizes = {
    nodeType: 1,
    prefixLength: 1,
    /** Bytes length before `reference` */
    preReference: 32,
    metadata: 2,
    header: (): number =>
      MantarayFork.nodeForkSizes.nodeType + MantarayFork.nodeForkSizes.prefixLength, // 2
    prefixMaxSize: (): number =>
      MantarayFork.nodeForkSizes.preReference - MantarayFork.nodeForkSizes.header(), // 30
  } as const

  static nodeHeaderSizes = {
    obfuscationKey: 32,
    versionHash: 31,
    /** Its value represents how long is the `entry` in bytes */
    refBytes: 1,
    full: (): number => {
      return (
        MantarayFork.nodeHeaderSizes.obfuscationKey +
        MantarayFork.nodeHeaderSizes.versionHash +
        MantarayFork.nodeHeaderSizes.refBytes
      )
    },
  } as const

  private createMetadataPadding(metadataSizeWithSize: number): Uint8Array {
    let padding = new Uint8Array(0)

    if (metadataSizeWithSize < MantarayFork.nodeHeaderSizes.obfuscationKey) {
      const paddingLength = MantarayFork.nodeHeaderSizes.obfuscationKey - metadataSizeWithSize
      padding = new Uint8Array(paddingLength)
      for (let i = 0; i < padding.length; i++) {
        padding[i] = PADDING_BYTE
      }
    } else if (metadataSizeWithSize > MantarayFork.nodeHeaderSizes.obfuscationKey) {
      const paddingLength =
        MantarayFork.nodeHeaderSizes.obfuscationKey -
        (metadataSizeWithSize % MantarayFork.nodeHeaderSizes.obfuscationKey)
      padding = new Uint8Array(paddingLength)
      for (let i = 0; i < padding.length; i++) {
        padding[i] = PADDING_BYTE
      }
    }

    return padding
  }

  public serialize(): Uint8Array {
    const nodeType = this.node.type

    const prefixLengthBytes = new Uint8Array(1)
    prefixLengthBytes[0] = this.prefix.length

    const prefixBytes = new Uint8Array(MantarayFork.nodeForkSizes.prefixMaxSize())
    prefixBytes.set(this.prefix)

    const entry: BytesReference | undefined = this.node.contentAddress

    if (!entry)
      throw new Error("cannot serialize MantarayFork because it does not have contentAddress")

    const data = new Uint8Array([nodeType, ...prefixLengthBytes, ...prefixBytes, ...entry])

    if (this.node.IsWithMetadataType()) {
      const jsonString = JSON.stringify(this.node.metadata)
      const metadataBytes = new TextEncoder().encode(jsonString)

      const metadataSizeWithSize = metadataBytes.length + MantarayFork.nodeForkSizes.metadata
      const padding = this.createMetadataPadding(metadataSizeWithSize)

      const metadataBytesSize = toBigEndianFromUint16(metadataBytes.length + padding.length)

      return new Uint8Array([...data, ...metadataBytesSize, ...metadataBytes, ...padding])
    }

    return data
  }

  public static deserialize(
    data: Uint8Array,
    obfuscationKey: Bytes<32>,
    options?: {
      withMetadata?: {
        refBytesSize: number
        metadataByteSize: number
      }
    },
  ): MantarayFork {
    const nodeType = data[0] as number
    const prefixLength = data[1] as number

    if (prefixLength === 0 || prefixLength > MantarayFork.nodeForkSizes.prefixMaxSize()) {
      throw new Error(
        `Prefix length of fork is greater than ${MantarayFork.nodeForkSizes.prefixMaxSize()}. Got: ${prefixLength}`,
      )
    }

    const headerSize = MantarayFork.nodeForkSizes.header()
    const prefix = data.slice(headerSize, headerSize + prefixLength)
    const node = new MantarayNode()
    node.obfuscationKey = obfuscationKey

    const withMetadata = options?.withMetadata

    if (withMetadata) {
      const { refBytesSize, metadataByteSize } = withMetadata

      if (metadataByteSize > 0) {
        node.entry = data.slice(
          MantarayFork.nodeForkSizes.preReference,
          MantarayFork.nodeForkSizes.preReference + refBytesSize,
        ) as Bytes<32> | Bytes<64>

        const startMetadata =
          MantarayFork.nodeForkSizes.preReference +
          refBytesSize +
          MantarayFork.nodeForkSizes.metadata
        const metadataBytes = data.slice(startMetadata, startMetadata + metadataByteSize)

        const jsonString = new TextDecoder().decode(metadataBytes)
        node.metadata = JSON.parse(jsonString) as MetadataMapping
      }
    } else {
      node.entry = data.slice(MantarayFork.nodeForkSizes.preReference) as Bytes<32> | Bytes<64>
    }
    node.type = nodeType

    return new MantarayFork(prefix, node)
  }
}
