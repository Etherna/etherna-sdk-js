// Forked from: https://github.com/ethersphere/bee

import { makeSpan } from "@fairdatasociety/bmt-js"
import { etc } from "@noble/secp256k1"

import { EthernaSdkError } from "@/classes"
import { CAC_PAYLOAD_OFFSET } from "@/consts"
import { bmtHash } from "@/utils/bmt"
import { serializeBytes } from "@/utils/bytes"

import type {
  ContentAddressedChunk,
  Data,
  FileUploadOptions,
  RequestDownloadOptions,
  RequestUploadOptions,
} from "./types"
import type { AxiosResponseHeaders, RawAxiosResponseHeaders } from "axios"

/**
 * Validates input and converts to Uint8Array
 *
 * @param data any string, ArrayBuffer or Uint8Array
 */
export function prepareData(
  data: string | File | Uint8Array,
): Blob | ReadableStream<Uint8Array> | never {
  if (typeof data === "string") return new Blob([data], { type: "text/plain" })

  if (data instanceof Uint8Array) {
    return new Blob([data as BlobPart], { type: "application/octet-stream" })
  }

  if (data instanceof File) {
    return data
  }

  throw new TypeError("unknown data type")
}

export function readFileHeaders(
  headers: RawAxiosResponseHeaders | AxiosResponseHeaders | Partial<Record<string, string>>,
) {
  const name = readContentDispositionFilename(headers["content-disposition"])
  const tagUid = readTagUid(headers["swarm-tag-uid"])
  const contentType = headers["content-type"] as string | undefined

  return {
    name,
    tagUid,
    contentType,
  }
}

export function extractUploadHeaders(options: RequestUploadOptions): Record<string, string> {
  if (!options.batchId) {
    throw new EthernaSdkError("MISSING_BATCH_ID", "Postage BatchID has to be specified!")
  }

  const headers: Record<string, string> = {
    ...options.headers,
    "swarm-postage-batch-id": options.batchId,
  }

  if (options.act != null) {
    headers["swarm-act"] = String(options.act)
  }

  if (options.pin != null) {
    headers["swarm-pin"] = String(options.pin)
  }

  if (options.encrypt != null) {
    headers["swarm-encrypt"] = options.encrypt.toString()
  }

  if (options.tag) {
    headers["swarm-tag"] = String(options.tag)
  }

  if (options.deferred != null) {
    headers["swarm-deferred-upload"] = options.deferred.toString()
  }

  if (options.actHistoryAddress) {
    headers["swarm-act-history-address"] = options.actHistoryAddress
  }

  return headers
}

export function extractFileUploadHeaders(options: FileUploadOptions): Record<string, string> {
  const headers = extractUploadHeaders(options)

  if (options?.size) headers["Content-Length"] = String(options.size)

  if (options?.contentType) headers["Content-Type"] = options.contentType

  return headers
}

export function extractDownloadHeaders(options: RequestDownloadOptions): Record<string, string> {
  const headers: Record<string, string> = {
    ...options.headers,
  }

  if (options.redundancyStrategy) {
    headers["swarm-redundancy-strategy"] = String(options.redundancyStrategy)
  }

  if (options.fallback != null) {
    headers["swarm-redundancy-fallback-mode"] = options.fallback.toString()
  }

  if (options.timeoutMs) {
    headers["swarm-chunk-retrieval-timeout"] = String(options.timeoutMs)
  }

  // if (options.actPublisher) {
  //   headers["swarm-act-publisher"] = new PublicKey(options.actPublisher as any).toCompressedHex()
  // }

  if (options.actHistoryAddress) {
    headers["swarm-act-history-address"] = options.actHistoryAddress
  }

  if (options.actTimestamp) {
    headers["swarm-act-timestamp"] = String(options.actTimestamp)
  }

  if (/*options.actPublisher || */ options.actHistoryAddress || options.actTimestamp) {
    headers["swarm-act"] = "true"
  }

  if (options.gasPrice) {
    headers["gas-price"] = String(options.gasPrice)
  }

  if (options.gasLimit) {
    headers["gas-limit"] = String(options.gasLimit)
  }

  return headers
}

function readContentDispositionFilename(header: string | undefined): string | null {
  const dispositionMatch = header?.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?;?/i)
  const filename = dispositionMatch?.[1]

  return filename ?? null
}

function readTagUid(header: string | undefined): number | undefined {
  if (!header) {
    return undefined
  }

  return parseInt(header, 10)
}

export function wrapBytesWithHelpers<T extends Record<string, unknown> = Record<string, unknown>>(
  data: Uint8Array,
): Data {
  return Object.assign(data, {
    text: () => new TextDecoder("utf-8").decode(data),
    json<J = T>() {
      return JSON.parse(new TextDecoder("utf-8").decode(data)) as J
    },
    hex: () => etc.bytesToHex(data),
  })
}

/**
 * Creates a content addressed chunk and verifies the payload size.
 *
 * @param payloadBytes the data to be stored in the chunk
 */
export function makeContentAddressedChunk(payloadBytes: Uint8Array): ContentAddressedChunk {
  const span = makeSpan(payloadBytes.length)
  const data = serializeBytes(span, payloadBytes)

  return {
    data,
    span: () => span,
    payload: () => data.slice(CAC_PAYLOAD_OFFSET),
    address: () => bmtHash(data),
  }
}
