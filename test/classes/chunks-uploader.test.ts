import { makeChunkedFile } from "@fairdatasociety/bmt-js"
import { beforeAll, describe, expect, it } from "vitest"

import { ChunksUploader } from "@/classes"
import { BeeClient } from "@/clients"

import type { BatchId } from "@/types"

describe("ChunksUploader", () => {
  const beeClient = new BeeClient("http://localhost:1633", {
    signer: "f6379d2f0229ca418812cf65cc5e26e727c968912442721139b74455dd7a0095",
  })
  let batchId: BatchId

  beforeAll(async () => {
    batchId =
      (await beeClient.stamps.fetchBestBatchId()) ??
      (await beeClient.stamps.create(17, 60 * 60 * 24 * 7)).batchID
  })

  it("should append a chunked file and return a reference", () => {
    const uploader = new ChunksUploader({ beeClient })
    const chunkedFile = makeChunkedFile(new TextEncoder().encode("Hello, world!"))
    const reference = uploader.append(chunkedFile)
    expect(reference).toBeDefined()
  })

  it("should append raw data and return a reference", () => {
    const uploader = new ChunksUploader({ beeClient })
    const reference = uploader.append(
      new Uint8Array([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21,
      ]),
    )
    expect(reference).toBeDefined()
  })

  it("should resume uploading with options", () => {
    const uploader = new ChunksUploader({ beeClient })
    uploader.append(
      new Uint8Array([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21,
      ]),
    )
    expect(() => uploader.resume({ batchId })).not.toThrow()
  })

  it("should throw when drain is called before resume", async () => {
    const uploader = new ChunksUploader({ beeClient })
    uploader.append(
      new Uint8Array([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21,
      ]),
    )
    expect(async () => await uploader.drain()).rejects.toThrowError(
      "Call .resume() before .drain()",
    )
  })

  it("should drain all pending uploads", async () => {
    const uploader = new ChunksUploader({ beeClient })
    uploader.append(
      new Uint8Array([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21,
      ]),
    )
    uploader.resume({ batchId })
    const promise = uploader.drain()
    await promise
  })

  it("should emit progress event when progress is made", async () => {
    const uploader = new ChunksUploader({ beeClient })
    let progress = 0
    uploader.on("progress", (value) => {
      progress = value
    })
    uploader.append(
      new Uint8Array([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21,
      ]),
    )
    uploader.resume({ batchId })
    await uploader.drain()

    expect(progress).toBe(100)
  })

  it("should emit done event when uploading is complete", async () => {
    const uploader = new ChunksUploader({ beeClient })
    let isDone = false
    uploader.on("done", () => {
      isDone = true
    })
    uploader.append(
      new Uint8Array([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21,
      ]),
    )
    uploader.resume({ batchId })
    await uploader.drain()

    expect(isDone).toBe(true)
  })
})
