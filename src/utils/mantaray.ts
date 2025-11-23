import { makeChunkedFile } from "@fairdatasociety/bmt-js"

import { bytesEqual } from "./bytes"
import { keccak256Hash, toHexString } from "./hex"
import { referenceToBytesReference } from "./reference"
import { EthernaSdkError, MantarayNode } from "@/classes"
import {
  MantarayEntryMetadataContentTypeKey,
  MantarayRootPath,
  MantarayWebsiteIndexDocumentPathKey,
} from "@/consts"

import type { MantarayFork, MarshalVersion } from "@/classes"
import type { BeeClient } from "@/clients"
import type { BytesReference, Reference } from "@/types/swarm"
import type { Bytes } from "@/types/utils"

/**
 * Throws an error if the given nodes properties are not equal
 *
 * @param a Mantaray node to compare
 * @param b Mantaray node to compare
 * @param accumulatedPrefix accumulates the prefix during the recursion
 * @throws Error if the two nodes properties are not equal recursively
 */
export const equalNodes = (
  a: MantarayNode,
  b: MantarayNode,
  accumulatedPrefix = "",
): void | never => {
  // node type comparisation
  if (a.type !== b.type) {
    throw new Error(
      `Nodes do not have same type at prefix "${accumulatedPrefix}"\na: ${a.type} <-> b: ${b.type}`,
    )
  }

  // node metadata comparisation
  if (!a.metadata !== !b.metadata) {
    throw new Error(
      `One of the nodes do not have metadata defined. \n a: ${a.metadata} \n b: ${b.metadata}`,
    )
  } else if (a.metadata && b.metadata) {
    let aMetadata, bMetadata: string
    try {
      aMetadata = JSON.stringify(a.metadata)
      bMetadata = JSON.stringify(b.metadata)
    } catch (e) {
      throw new Error(
        `Either of the nodes has invalid JSON metadata. \n a: ${a.metadata} \n b: ${b.metadata}`,
      )
    }

    if (aMetadata !== bMetadata) {
      throw new Error(`The node's metadata are different. a: ${aMetadata} \n b: ${bMetadata}`)
    }
  }

  // node entry comparisation
  if (a.entry === b.entry) {
    throw new Error(`Nodes do not have same entries. \n a: ${a.entry} \n b: ${a.entry}`)
  }

  if (!a.forks) return

  // node fork comparisation
  const aKeys = Object.keys(a.forks)

  if (!b.forks || aKeys.length !== Object.keys(b.forks).length) {
    throw new Error(
      `Nodes do not have same fork length on equality check at prefix ${accumulatedPrefix}`,
    )
  }

  for (const key of aKeys) {
    const aFork = a.forks[Number(key)] as MantarayFork
    const bFork = b.forks[Number(key)] as MantarayFork
    const prefix = aFork.prefix
    const prefixString = new TextDecoder().decode(prefix)

    if (!bytesEqual(prefix, bFork.prefix)) {
      throw new Error(
        `Nodes do not have same prefix under the same key "${key}" at prefix ${accumulatedPrefix}`,
      )
    }

    equalNodes(aFork.node, bFork.node, accumulatedPrefix + prefixString)
  }
}

/**
 * Get the reference from bytes data
 *
 * @param data The data
 * @returns The reference
 */
export function getReferenceFromData(data: Uint8Array): Reference {
  const chunkedFile = makeChunkedFile(data)
  return toHexString(chunkedFile.address()) as Reference
}

/**
 * Get the reference from json data
 *
 * @param data The data
 * @returns The reference
 */
export function jsonToReference(content: object): BytesReference {
  return textToReference(JSON.stringify(content))
}

/**
 * Get the reference from text data
 *
 * @param data The data
 * @returns The reference
 */
export function textToReference(content: string): BytesReference {
  return referenceToBytesReference(getReferenceFromData(new TextEncoder().encode(content)))
}

/**
 * Encode the path to bytes
 *
 * @param data The path
 * @returns The bytes
 */
export function encodePath(path: string): Uint8Array {
  return new TextEncoder().encode(path)
}

/**
 * Decode the path from bytes
 *
 * @param data The bytes
 * @returns The path
 */
export function decodePath(path: Uint8Array): string {
  return new TextDecoder().decode(path)
}

/**
 * Check if the reference is zero bytes
 *
 * @param ref The reference
 * @returns True if the reference is zero bytes
 */
export function isZeroBytesReference(ref: BytesReference | Reference): boolean {
  if (typeof ref === "string") {
    return Array.from(ref).every((char) => char === "0")
  }
  return ref.every((byte) => byte === 0)
}

/**
 * Get all paths from the mantaray node
 *
 * @param node The mantaray node
 * @returns The paths in a nested object
 */
export function getAllPaths(node: MantarayNode) {
  const paths: Record<string, MantarayNode> = {}

  for (const fork of Object.values(node.forks ?? {})) {
    const prefix = decodePath(fork.prefix)
    const isEnd = !fork.node.forks || Object.keys(fork.node.forks).length === 0

    if (isEnd) {
      paths[prefix] = fork.node
    } else {
      const subPaths = getAllPaths(fork.node)
      for (const [subPath, subNode] of Object.entries(subPaths)) {
        paths[prefix + subPath] = subNode
      }
    }
  }

  return paths
}

/**
 * Find all nodes with a prefix
 *
 * @param node The mantaray node
 * @param prefix The prefix to search for
 * @returns An array of nodes with the prefix
 */
export function getNodesWithPrefix(node: MantarayNode, prefix: string): MantarayNode[] {
  const allPaths = getAllPaths(node)
  const entries = Object.entries(allPaths)
  return entries.filter(([path]) => path.startsWith(prefix)).map(([_, node]) => node)
}

/**
 * The hash length has to be 31 instead of 32 that comes from the keccak hash function
 */
export function serializeVersion(version: MarshalVersion): Bytes<31> {
  const versionName = "mantaray"
  const versionSeparator = ":"
  const hashBytes = keccak256Hash(versionName + versionSeparator + version)

  return hashBytes.slice(0, 31) as Bytes<31>
}

export function serializeReferenceLength(entry: BytesReference): Bytes<1> {
  const referenceLength = entry.length

  if (referenceLength !== 32 && referenceLength !== 64) {
    throw new EthernaSdkError(
      "INVALID_ARGUMENT",
      `Wrong referenceLength. It can be only 32 or 64. Got: ${referenceLength}`,
    )
  }
  const bytes = new Uint8Array(1)
  bytes[0] = referenceLength

  return bytes as Bytes<1>
}

/**
 * Checks for separator character in the node and its descendants prefixes
 */
export function checkForSeparator(node: MantarayNode): boolean {
  const PATH_SEPARATOR_BYTE = 47

  for (const fork of Object.values(node.forks ?? {})) {
    const pathIncluded = fork.prefix.some((v) => v === PATH_SEPARATOR_BYTE)

    if (pathIncluded) return true

    if (checkForSeparator(fork.node)) return true
  }

  return false
}

export async function getBzzNodeInfo(
  reference: Reference,
  beeClient: BeeClient,
  signal?: AbortSignal,
): Promise<{ entry: BytesReference; contentType?: string } | null> {
  try {
    const node = new MantarayNode()
    await node.load(async (reference) => {
      const bmtData = await beeClient.bytes.download(toHexString(reference), {
        signal,
      })
      return bmtData
    }, referenceToBytesReference(reference))

    if (signal?.aborted) return null

    const fork = node.getForkAtPath(encodePath(MantarayRootPath))
    const metadata = fork?.node.metadata
    const indexEntry = metadata?.[MantarayWebsiteIndexDocumentPathKey]

    if (!fork?.node.entry) {
      throw new EthernaSdkError("NOT_FOUND", "No root fork found")
    }

    const isZero = isZeroBytesReference(fork.node.entry)

    if (isZero && !indexEntry) {
      throw new EthernaSdkError("NOT_FOUND", "No root entry found")
    }

    return {
      entry: isZero ? referenceToBytesReference(indexEntry as Reference) : fork.node.entry,
      contentType: fork.node.metadata?.[MantarayEntryMetadataContentTypeKey],
    }
  } catch (error) {
    return null
  }
}
