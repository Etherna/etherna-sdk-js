// Forked from: https://github.com/ethersphere/mantaray-js

import { MantarayFork } from "./mantaray-fork"
import { MantarayIndexBytes } from "./mantaray-index-bytes"
import { EthernaSdkError } from "./sdk-error"
import {
  bytesEqual,
  checkBytesReference,
  commonBytes,
  decodePath,
  encodePath,
  encryptDecrypt,
  findIndexOfArray,
  flattenBytesArray,
  fromBigEndian,
  fromHexString,
  getNodesWithPrefix as getNodesWithPrefixString,
  serializeReferenceLength,
  serializeVersion,
  toHexString,
} from "@/utils"

import type { ReadableMantarayNode } from "@/schemas/mantaray-schema"
import type { BytesReference } from "@/types/swarm"
import type { Bytes } from "@/types/utils"

export type MetadataMapping = Record<string, string>
export type ForkMapping = { [key: number]: MantarayFork }
export type MarshalVersion = (typeof marshalVersionValues)[number]
export type StorageLoader = (reference: BytesReference) => Promise<Uint8Array>
export type StorageSaver = (
  data: Uint8Array,
  options?: { ecrypt?: boolean },
) => Promise<BytesReference>
export interface StorageHandler {
  load: StorageLoader
  save: StorageSaver
}
export interface RecursiveSaveReturnType {
  reference: BytesReference
  changed: boolean
}

const PATH_SEPARATOR = "/"

const marshalVersionValues = ["0.1", "0.2"] as const

enum NodeType {
  value = 2,
  edge = 4,
  withPathSeparator = 8,
  withMetadata = 16,
  mask = 255,
}

class NotFoundError extends Error {
  constructor(remainingPathBytes: Uint8Array, checkedPrefixBytes?: Uint8Array) {
    const remainingPath = new TextDecoder().decode(remainingPathBytes)
    const prefixInfo = checkedPrefixBytes
      ? `Prefix on lookup: ${new TextDecoder().decode(checkedPrefixBytes)}`
      : "No fork on the level"
    super(
      `Path has not found in the manifest. Remaining path on lookup: ${remainingPath}. ${prefixInfo}`,
    )
  }
}

export class MantarayNode {
  /** Used with NodeType type */
  private _type?: number
  private _obfuscationKey?: Bytes<32>
  /** reference of a loaded manifest node. if undefined, the node can be handled as `dirty` */
  private _contentAddress?: BytesReference
  /** reference of an content that the manifest refers to */
  private _entry?: BytesReference
  private _metadata?: MetadataMapping
  /** Forks of the manifest. Has to be initialized with `{}` on load even if there were no forks */
  public forks?: ForkMapping

  /// Setters/getters

  public get contentAddress(): BytesReference | undefined {
    return this._contentAddress
  }
  public set contentAddress(contentAddress: BytesReference) {
    checkBytesReference(contentAddress)

    this._contentAddress = contentAddress
  }

  public get entry(): BytesReference | undefined {
    return this._entry
  }
  public set entry(entry: BytesReference) {
    checkBytesReference(entry)

    this._entry = entry

    if (!bytesEqual(entry, new Uint8Array(entry.length))) this.makeValue()

    this.makeDirty()
  }

  public get type(): number {
    if (this._type === undefined) {
      throw new EthernaSdkError("NOT_FOUND", "Property 'type' does not exist in the object")
    }

    if (this._type > 255) {
      throw new EthernaSdkError("INVALID_ARGUMENT", 'Property "type" in Node is greater than 255')
    }

    return this._type
  }

  public set type(type: number) {
    if (type > 255) {
      throw new EthernaSdkError(
        "INVALID_ARGUMENT",
        `Node type representation cannot be greater than 255`,
      )
    }

    this._type = type
  }

  public get obfuscationKey(): Bytes<32> | undefined {
    return this._obfuscationKey
  }

  public set obfuscationKey(obfuscationKey: Bytes<32>) {
    if (!(obfuscationKey instanceof Uint8Array)) {
      throw new EthernaSdkError(
        "INVALID_ARGUMENT",
        "Given obfuscationKey is not an Uint8Array instance.",
      )
    }

    if (obfuscationKey.length !== 32) {
      throw new EthernaSdkError(
        "INVALID_ARGUMENT",
        `Wrong obfuscationKey length. Entry only can be 32 length in bytes`,
      )
    }

    this._obfuscationKey = obfuscationKey
    this.makeDirty()
  }

  public get metadata(): MetadataMapping | undefined {
    return this._metadata
  }

  public set metadata(metadata: MetadataMapping) {
    this._metadata = metadata
    this.makeWithMetadata()

    // TODO: when the mantaray node is a pointer by its metadata then
    // the node has to be with `value` type even though it has zero address
    // should get info why is `withMetadata` as type is not enough
    if (metadata["website-index-document"] || metadata["website-error-document"]) {
      this.makeValue()
    }
    this.makeDirty()
  }

  public get readable(): ReadableMantarayNode {
    return {
      type: this._type,
      entry: this._entry ? toHexString(this._entry) : undefined,
      contentAddress: this._contentAddress ? toHexString(this._contentAddress) : undefined,
      metadata: this._metadata,
      forks: Object.keys(this.forks ?? {}).reduce((acc, key) => {
        const byte = new Uint8Array([+key])
        const nextKey = new TextDecoder().decode(byte)
        const fork = this.forks?.[+key] ?? new MantarayFork(new Uint8Array(0), new MantarayNode())

        return {
          ...acc,
          [nextKey]: {
            prefix: decodePath(fork.prefix),
            node: fork.node.readable,
          },
        }
      }, {}),
    }
  }

  public static fromReadable(readable: ReadableMantarayNode): MantarayNode {
    const node = new MantarayNode()
    if (readable.type != null) {
      node._type = readable.type
    }
    if (readable.entry) {
      node._entry = fromHexString(readable.entry) as BytesReference
    }
    if (readable.contentAddress) {
      node._contentAddress = fromHexString(readable.contentAddress) as BytesReference
    }
    if (readable.metadata) {
      node._metadata = readable.metadata
    }
    if (readable.forks) {
      node.forks = Object.keys(readable.forks).reduce((acc, key) => {
        const nextKey = new TextEncoder().encode(key)[0]
        const fork = readable.forks[key]
        if (!fork || !nextKey) {
          return acc
        }
        const forkNode = MantarayNode.fromReadable(fork.node)
        return {
          ...acc,
          [nextKey]: new MantarayFork(encodePath(fork.prefix), forkNode),
        }
      }, {})
    }
    return node
  }

  /// Node type related functions
  /// dirty flag is not necessary to be set

  public isValueType(): boolean {
    if (!this._type) {
      throw new EthernaSdkError("NOT_FOUND", "Property 'type' does not exist in the object")
    }
    const typeMask = this._type & NodeType.value

    return typeMask === NodeType.value
  }

  public isEdgeType(): boolean {
    if (!this._type) {
      throw new EthernaSdkError("NOT_FOUND", "Property 'type' does not exist in the object")
    }
    const typeMask = this._type & NodeType.edge

    return typeMask === NodeType.edge
  }

  public isWithPathSeparatorType(): boolean {
    if (!this._type) {
      throw new EthernaSdkError("NOT_FOUND", "Property 'type' does not exist in the object")
    }
    const typeMask = this._type & NodeType.withPathSeparator

    return typeMask === NodeType.withPathSeparator
  }

  public IsWithMetadataType(): boolean {
    if (!this._type) {
      throw new EthernaSdkError("NOT_FOUND", "Property 'type' does not exist in the object")
    }
    const typeMask = this._type & NodeType.withMetadata

    return typeMask === NodeType.withMetadata
  }

  private makeValue() {
    if (!this._type) this._type = NodeType.value
    this._type |= NodeType.value
  }

  private makeEdge() {
    if (!this._type) this._type = NodeType.edge
    this._type |= NodeType.edge
  }

  private makeWithPathSeparator() {
    if (!this._type) this._type = NodeType.withPathSeparator
    this._type |= NodeType.withPathSeparator
  }

  private makeWithMetadata() {
    if (!this._type) this._type = NodeType.withMetadata
    this._type |= NodeType.withMetadata
  }

  private makeNotWithPathSeparator() {
    if (!this._type) {
      throw new EthernaSdkError("NOT_FOUND", "Property 'type' does not exist in the object")
    }
    this._type = (NodeType.mask ^ NodeType.withPathSeparator) & this._type
  }

  private updateWithPathSeparator(path: Uint8Array) {
    // TODO: it is not clear why the `withPathSeparator` is not related to the first path element -> should get info about it
    // if (new TextDecoder().decode(path).includes(PATH_SEPARATOR)) {
    if (new TextDecoder().decode(path).slice(1).includes(PATH_SEPARATOR)) {
      this.makeWithPathSeparator()
    } else {
      this.makeNotWithPathSeparator()
    }
  }

  /// BL methods

  /**
   *
   * @param path path sting represented in bytes. can be 0 length, then `entry` will be the current node's entry
   * @param entry
   * @param metadata
   * @param storage
   */
  public addFork(path: Uint8Array, entry: BytesReference, metadata: MetadataMapping = {}): void {
    if (path.length === 0) {
      this.entry = entry

      if (Object.keys(metadata).length > 0) {
        this.metadata = metadata
      }
      this.makeDirty()

      return
    }

    if (this.isDirty() && !this.forks) {
      this.forks = {}
    }

    if (!this.forks) {
      throw Error(`Fork mapping is not defined in the manifest`)
    }

    const pathFirstByte = path[0]

    if (pathFirstByte == null) {
      throw Error(`Path is empty`)
    }

    const fork = this.forks[pathFirstByte]

    if (!fork) {
      const newNode = new MantarayNode()

      if (this._obfuscationKey) {
        newNode.obfuscationKey = this._obfuscationKey
      }

      if (path.length > MantarayFork.nodeForkSizes.prefixMaxSize()) {
        const prefix = path.slice(0, MantarayFork.nodeForkSizes.prefixMaxSize())
        const rest = path.slice(MantarayFork.nodeForkSizes.prefixMaxSize())
        newNode.addFork(rest, entry, metadata)
        newNode.updateWithPathSeparator(prefix)
        this.forks[pathFirstByte] = new MantarayFork(prefix, newNode)
        this.makeDirty()
        this.makeEdge()

        return
      }

      newNode.entry = entry

      if (Object.keys(metadata).length > 0) {
        newNode.metadata = metadata
      }

      newNode.updateWithPathSeparator(path)
      this.forks[pathFirstByte] = new MantarayFork(path, newNode)
      this.makeDirty()
      this.makeEdge()

      return
    }

    const commonPath = commonBytes(fork.prefix, path)
    const restPath = fork.prefix.slice(commonPath.length)
    const restPathFirstByte = restPath[0]

    let newNode = fork.node

    if (restPathFirstByte) {
      // move current common prefix node
      newNode = new MantarayNode()
      newNode.obfuscationKey = this._obfuscationKey ?? (new Uint8Array(32) as Bytes<32>)

      fork.node.updateWithPathSeparator(restPath)
      newNode.forks = {}
      newNode.forks[restPathFirstByte] = new MantarayFork(restPath, fork.node)
      newNode.makeEdge()

      // if common path is full path new node is value type
      if (path.length === commonPath.length) {
        newNode.makeValue()
      }
    }

    // NOTE: special case on edge split
    // newNode will be the common path edge node
    // TODO: change it on Bee side! -> newNode is the edge (parent) node of the newly created path, so `commonPath` should be passed instead of `path`
    // newNode.updateWithPathSeparator(path)
    newNode.updateWithPathSeparator(commonPath)
    // newNode's prefix is a subset of the given `path`, here the desired fork will be added with the truncated path
    newNode.addFork(path.slice(commonPath.length), entry, metadata)
    this.forks[pathFirstByte] = new MantarayFork(commonPath, newNode)
    this.makeEdge()

    this.makeDirty()
  }

  /**
   * Gives back a MantarayFork under the given path
   *
   * @param path valid path within the MantarayNode
   * @returns MantarayFork with the last unique prefix and its node
   * @throws error if there is no node under the given path
   */
  public getForkAtPath(path: Uint8Array): MantarayFork {
    if (path.length === 0) {
      throw new EthernaSdkError("INVALID_ARGUMENT", `Path is empty`)
    }

    if (!this.forks) {
      throw Error(`Fork mapping is not defined in the manifest`)
    }

    const pathFirstByte = path[0]

    if (pathFirstByte == null) {
      throw Error(`Path is empty`)
    }

    const fork = this.forks[pathFirstByte]

    if (!fork) {
      throw new NotFoundError(path)
    }

    const prefixIndex = findIndexOfArray(path, fork.prefix)

    if (prefixIndex === -1) {
      throw new NotFoundError(path, fork.prefix)
    }

    const rest = path.slice(fork.prefix.length)

    if (rest.length === 0) return fork

    return fork.node.getForkAtPath(rest)
  }

  /**
   * Check if node exists under the given path
   *
   * @param path valid path within the MantarayNode
   * @returns True if exists, false otherwise
   */
  public hasForkAtPath(path: Uint8Array): boolean {
    const pathFirstByte = path[0]

    if (pathFirstByte == null) {
      throw new EthernaSdkError("INVALID_ARGUMENT", `Path is empty`)
    }

    if (!this.forks) return false

    const fork = this.forks[pathFirstByte]

    if (!fork) return false

    const prefixIndex = findIndexOfArray(path, fork.prefix)

    if (prefixIndex === -1) return false

    const rest = path.slice(fork.prefix.length)

    if (rest.length === 0) return true

    return fork.node.hasForkAtPath(rest)
  }

  /**
   * Get all forks with a path prefix
   * @param prefix path prefix
   * @returns List of forks
   */
  public getNodesWithPrefix(prefix: Uint8Array): MantarayNode[] {
    return getNodesWithPrefixString(this, decodePath(prefix))
  }

  /**
   * Removes a path from the node
   *
   * @param path Uint8Array of the path of the node intended to remove
   */
  public removePath(path: Uint8Array): void {
    const pathFirstByte = path[0]

    if (pathFirstByte == null) {
      throw Error(`Path is empty`)
    }

    if (!this.forks) {
      throw new EthernaSdkError("INVALID_ARGUMENT", `Fork mapping is not defined in the manifest`)
    }

    const fork = this.forks[pathFirstByte]

    if (!fork) {
      throw new NotFoundError(path)
    }

    const prefixIndex = findIndexOfArray(path, fork.prefix)

    if (prefixIndex === -1) {
      throw new NotFoundError(path, fork.prefix)
    }

    const rest = path.slice(fork.prefix.length)

    if (rest.length === 0) {
      // full path matched
      this.makeDirty()

      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this.forks[pathFirstByte]

      return
    }

    fork.node.removePath(rest)
  }

  public async load(storageLoader: StorageLoader, reference: BytesReference): Promise<void> {
    if (!reference) throw Error("Reference is undefined at manifest load")

    await this.recursiveLoad(storageLoader, reference)

    this.contentAddress = reference
  }

  /**
   * Saves dirty flagged ManifestNodes and its forks recursively
   * @returns Reference of the top manifest node.
   */
  public async save(storageSaver: StorageSaver): Promise<BytesReference> {
    const { reference } = await this.recursiveSave(storageSaver)

    return reference
  }

  public isDirty(): boolean {
    return this._contentAddress === undefined
  }

  public makeDirty(): void {
    this._contentAddress = undefined
  }

  public serialize(): Uint8Array {
    if (!this._obfuscationKey) this.obfuscationKey = new Uint8Array(32) as Bytes<32>

    if (!this.forks) {
      if (!this._entry) {
        throw new EthernaSdkError("NOT_FOUND", "Field 'entry' is not defined in the object")
      }
      this.forks = {} //if there were no forks initialized it is not indended to be
    }

    if (!this._entry) this._entry = new Uint8Array(32) as Bytes<32> // at directoties

    /// Header
    const version: MarshalVersion = "0.2"
    const versionBytes: Bytes<31> = serializeVersion(version)
    const referenceLengthBytes: Bytes<1> = serializeReferenceLength(this._entry)

    /// Entry is already in byte version

    /// ForksIndexBytes
    const index = new MantarayIndexBytes()
    for (const forkIndex of Object.keys(this.forks)) {
      index.setByte(Number(forkIndex))
    }
    const indexBytes = index.getBytes

    /// Forks
    const forkSerializations: Uint8Array[] = []

    index.forEach((byte) => {
      const fork = this.forks?.[byte]

      if (!fork) throw Error(`Fork indexing error: fork has not found under ${byte} index`)
      forkSerializations.push(fork.serialize())
    })

    const obfuscationKey =
      this._obfuscationKey ?? new Uint8Array(MantarayFork.nodeHeaderSizes.obfuscationKey)

    const bytes = new Uint8Array([
      ...obfuscationKey,
      ...versionBytes,
      ...referenceLengthBytes,
      ...this._entry,
      ...indexBytes,
      ...flattenBytesArray(forkSerializations),
    ])

    /// Encryption
    /// perform XOR encryption on bytes after obfuscation key
    encryptDecrypt(obfuscationKey, bytes, obfuscationKey.length)

    return bytes
  }

  public deserialize(data: Uint8Array): void {
    const nodeHeaderSize = MantarayFork.nodeHeaderSizes.full()

    if (data.length < nodeHeaderSize) {
      throw Error(
        `The serialised input is too short, received = ${data.length}, expected >= ${nodeHeaderSize}`,
      )
    }

    this._obfuscationKey = new Uint8Array(
      data.slice(0, MantarayFork.nodeHeaderSizes.obfuscationKey),
    ) as Bytes<32>
    // perform XOR decryption on bytes after obfuscation key
    encryptDecrypt(this._obfuscationKey, data, this._obfuscationKey.length)

    const versionHash = data.slice(
      MantarayFork.nodeHeaderSizes.obfuscationKey,
      MantarayFork.nodeHeaderSizes.obfuscationKey + MantarayFork.nodeHeaderSizes.versionHash,
    )

    if (bytesEqual(versionHash, serializeVersion("0.1"))) {
      throw new EthernaSdkError("INVALID_ARGUMENT", "Version 0.1 is not supported")
    } else if (bytesEqual(versionHash, serializeVersion("0.2"))) {
      const refBytesSize = data[nodeHeaderSize - 1] ?? 0
      let entry = data.slice(nodeHeaderSize, nodeHeaderSize + refBytesSize)

      // FIXME: in Bee. if one uploads a file on the bzz endpoint, the node under `/` gets 0 refsize
      if (refBytesSize === 0) {
        entry = new Uint8Array(32)
      }
      this.entry = entry as BytesReference
      let offset = nodeHeaderSize + refBytesSize
      const indexBytes = data.slice(offset, offset + 32) as Bytes<32>

      // Currently we don't persist the root nodeType when we marshal the manifest, as a result
      // the root nodeType information is lost on Unmarshal. This causes issues when we want to
      // perform a path 'Walk' on the root. If there is at least 1 fork, the root node type
      // is an edge, so we will deduce this information from index byte array
      if (!bytesEqual(indexBytes, new Uint8Array(32))) {
        this.makeEdge()
      }

      this.forks = {}

      const indexForks = new MantarayIndexBytes()
      indexForks.setBytes = indexBytes
      offset += 32

      indexForks.forEach((byte) => {
        let fork: MantarayFork

        if (data.length < offset + MantarayFork.nodeForkSizes.nodeType) {
          throw Error(`There is not enough size to read nodeType of fork at offset ${offset}`)
        }

        const nodeType = data.slice(offset, offset + MantarayFork.nodeForkSizes.nodeType)
        let nodeForkSize = MantarayFork.nodeForkSizes.preReference + refBytesSize

        const nodeTypeByte = nodeType[0]

        if (nodeTypeByte == null) {
          throw Error(`nodeType is not defined`)
        }

        const isWithMetadataType = (nodeTypeByte & NodeType.withMetadata) === NodeType.withMetadata
        const obfuscationKey =
          this._obfuscationKey ??
          (new Uint8Array(MantarayFork.nodeHeaderSizes.obfuscationKey) as Bytes<32>)

        if (isWithMetadataType) {
          if (
            data.length <
            offset +
              MantarayFork.nodeForkSizes.preReference +
              refBytesSize +
              MantarayFork.nodeForkSizes.metadata
          ) {
            throw Error(`Not enough bytes for metadata node fork at byte ${byte}`)
          }

          const metadataByteSize = fromBigEndian(
            data.slice(
              offset + nodeForkSize,
              offset + nodeForkSize + MantarayFork.nodeForkSizes.metadata,
            ),
          )
          nodeForkSize += MantarayFork.nodeForkSizes.metadata + metadataByteSize

          fork = MantarayFork.deserialize(
            data.slice(offset, offset + nodeForkSize),
            obfuscationKey,
            {
              withMetadata: { refBytesSize, metadataByteSize },
            },
          )
        } else {
          if (data.length < offset + MantarayFork.nodeForkSizes.preReference + refBytesSize) {
            throw Error(`There is not enough size to read fork at offset ${offset}`)
          }

          fork = MantarayFork.deserialize(data.slice(offset, offset + nodeForkSize), obfuscationKey)
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.forks![byte] = fork

        offset += nodeForkSize
      })
    } else {
      throw Error("Wrong mantaray version")
    }
  }

  private async recursiveLoad(
    storageLoader: StorageLoader,
    reference: BytesReference,
  ): Promise<BytesReference | undefined> {
    const data = await storageLoader(reference)
    this.deserialize(data)

    if (!this.forks) {
      return this._entry
    }

    for (const fork in this.forks) {
      const forkPath = this.forks[fork]

      if (forkPath == null) {
        throw Error("forkPath is not defined")
      }

      const contentAddress = forkPath.node._entry

      if (!contentAddress) {
        throw Error("contentAddress is not defined")
      }

      const entry = await forkPath.node.recursiveLoad(storageLoader, contentAddress)

      if (!entry) {
        throw Error("entry is not defined")
      }

      forkPath.node.contentAddress = contentAddress
      forkPath.node.entry = entry
    }

    return this._entry
  }

  private async recursiveSave(storageSaver: StorageSaver): Promise<RecursiveSaveReturnType> {
    // save forks first recursively
    const savePromises: Promise<RecursiveSaveReturnType>[] = []

    if (!this.forks) this.forks = {} // there were no intention to define fork(s)
    for (const fork of Object.values(this.forks)) {
      savePromises.push(fork.node.recursiveSave(storageSaver))
    }
    const savedReturns = await Promise.all(savePromises)

    if (this._contentAddress && savedReturns.every((v) => !v.changed)) {
      return { reference: this._contentAddress, changed: false }
    }

    // save the actual manifest as well
    const data = this.serialize()
    const reference = await storageSaver(data)

    this.contentAddress = reference

    return { reference, changed: true }
  }
}
