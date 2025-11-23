import { etc } from "@noble/secp256k1"
import { beforeAll, describe, expect, it } from "vitest"

import { BeeClient } from "@/clients"
import { makeContentAddressedChunk } from "@/clients/bee/utils"
import { getReferenceFromData, keccak256Hash } from "@/utils"

import type { BatchId, EthAddress, Reference } from "@/types"

const signer = "f6379d2f0229ca418812cf65cc5e26e727c968912442721139b74455dd7a0095"
const bee = new BeeClient("http://localhost:1633", { signer })

// describe("bee client auth", () => {
//   it.concurrent("should authenticate and refresh token", async () => {
//     const token = await bee.auth.authenticate("", "hello")
//     expect(token).not.toBeNull()

//     const newToken = await bee.auth.refreshToken(token)
//     expect(newToken).not.toBeNull()
//   })
// })

describe("bee client bytes", () => {
  it("should upload raw data", async () => {
    const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId
    const message = "Etherna is awesome!"
    const { reference } = await bee.bytes.upload(new TextEncoder().encode(message), {
      batchId,
    })

    expect(reference).toBe("abc87bc2334e955d0ee85aa11df4b958622ea2cd62518fa30185899a34bc9e54")

    const data = await bee.bytes.download(reference)

    expect(data.text()).toEqual(message)
  })
})

describe("bee client bzz", () => {
  it("should upload a file", async () => {
    const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId
    const message = "Etherna is awesome!"
    const { reference } = await bee.bzz.upload(message, {
      batchId,
      contentType: "text/plain",
    })

    expect(reference).toBe("eaed5799d72b668ca6ac08a9466bdbcb0b4ab6bc80c2cd3251641bd084304109")

    const file = await bee.bzz.download(reference)

    expect(file.data.text()).toEqual(message)
  })
})

describe("bee client chainstate", () => {
  it.concurrent("should fetch the current price", async () => {
    const price = await bee.chainstate.getCurrentPrice()

    expect(price).toBeDefined()
    expect(price).greaterThan(0)
  })
})

describe("bee client chunk", () => {
  it("should upload a chunk", async () => {
    const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId
    const message = "Etherna is awesome!"
    const { reference } = await bee.chunk.upload(new TextEncoder().encode(message), {
      batchId,
    })

    expect(reference).toBe("a21fad9af8c1b315713dd91b05bb8bd60b8d96cbf15140702911ab66727d30f1")

    const data = await bee.chunk.download(reference)

    expect(data.text()).toEqual(message)
  })
})

describe("bee client feeds", () => {
  it("should create a feed", async () => {
    const owner = bee.signer?.address as EthAddress
    const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId
    const feedData = { id: "feed", msg: "Hello Etherna" }
    const feedDataSerialized = JSON.stringify(feedData)

    const { reference } = await bee.bzz.upload(feedDataSerialized, {
      batchId,
      contentType: "application/json",
    })

    const feed = bee.feed.makeFeed("topic", owner, "sequence")

    // write
    const feedWriter = bee.feed.makeWriter(feed)
    await feedWriter.upload(reference, { batchId })
    // read
    const feedReader = bee.feed.makeReader(feed)
    const feedDownloadResp = await feedReader.download()

    expect(feedDownloadResp.reference).toEqual(reference)

    const feedDataDownloaded = await bee.bzz.download(feedDownloadResp.reference)

    expect(feedDataDownloaded.data.json()).toEqual(feedData)
  })

  it("should create an epoch feed", async () => {
    const owner = bee.signer?.address as EthAddress
    const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId
    const feedData = { id: "feed", msg: "Hello Etherna" }
    const feedDataSerialized = JSON.stringify(feedData)

    const { reference } = await bee.bzz.upload(feedDataSerialized, {
      batchId,
      contentType: "application/json",
    })

    const feed = bee.feed.makeFeed("topic", owner, "epoch")

    // write
    const feedWriter = bee.feed.makeWriter(feed)
    await feedWriter.upload(reference, { batchId })
    // read
    const feedReader = bee.feed.makeReader(feed)
    const feedDownloadResp = await feedReader.download()

    expect(feedDownloadResp.reference).toEqual(reference)

    const feedDataDownloaded = await bee.bzz.download(feedDownloadResp.reference)

    expect(feedDataDownloaded.data.json()).toEqual(feedData)
  })

  it("should make a correct feed root manifest", async () => {
    const owner = bee.signer?.address as EthAddress
    const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId
    const feedSequence = bee.feed.makeFeed("topic", owner, "sequence")
    const feedEpoch = bee.feed.makeFeed("topic", owner, "epoch")

    const sequenceRootManifest = await bee.feed.createRootManifest(feedSequence, { batchId })
    const epochRootManifest = await bee.feed.createRootManifest(feedEpoch, { batchId })

    const { reference: madeSequenceRootManifest } = await bee.feed.makeRootManifest(feedSequence)
    const { reference: madeEpochRootManifest } = await bee.feed.makeRootManifest(feedEpoch)

    expect(sequenceRootManifest).toEqual(madeSequenceRootManifest)
    expect(epochRootManifest).toEqual(madeEpochRootManifest)
  })

  it("should parse a feed from the root manifest", async () => {
    const owner = bee.signer?.address as EthAddress
    const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId
    const feedSequence = bee.feed.makeFeed("topic", owner, "sequence")
    const feedEpoch = bee.feed.makeFeed("topic", owner, "epoch")

    const madeSequenceRootManifest = await bee.feed.makeRootManifest(feedSequence)
    const madeEpochRootManifest = await bee.feed.makeRootManifest(feedEpoch)

    await madeSequenceRootManifest.save({ batchId })
    await madeEpochRootManifest.save({ batchId })

    const parsedSequenceFeed = await bee.feed.parseFeedFromRootManifest(
      madeSequenceRootManifest.reference,
    )
    const parsedEpochFeed = await bee.feed.parseFeedFromRootManifest(
      madeEpochRootManifest.reference,
    )

    expect(parsedSequenceFeed).toEqual(feedSequence)
    expect(parsedEpochFeed).toEqual(feedEpoch)
  })
})

describe("bee client offers", () => {
  let offeredReference1: Reference
  let offeredReference2: Reference

  // beforeAll(async () => {
  //   const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId
  //   ;[offeredReference1, offeredReference2] = await Promise.all([
  //     bee.bzz.upload("Hello Offered World 1!", { batchId }).then((res) => res.reference),
  //     bee.bzz.upload("Hello Offered World 2!", { batchId }).then((res) => res.reference),
  //   ])

  //   await Promise.all([bee.offers.offer(offeredReference1), bee.offers.offer(offeredReference2)])
  // })

  it.concurrent("should fetch all resource offers", async () => {
    expect(async () => await bee.offers.downloadOffers(offeredReference1)).rejects.toThrowError(
      "This operation is not supported by Bee client",
    )
  })

  it.concurrent("should fetch all resources offered by current user", async () => {
    expect(async () => await bee.offers.downloadOfferedResources()).rejects.toThrowError(
      "This operation is not supported by Bee client",
    )
  })

  it.concurrent("should fetch multiple resources offers", async () => {
    expect(
      async () => await bee.offers.batchAreOffered([offeredReference1, offeredReference2]),
    ).rejects.toThrowError("This operation is not supported by Bee client")
  })

  it.concurrent("should create an offer", async () => {
    expect(async () => await bee.offers.offer(offeredReference1)).rejects.toThrowError(
      "This operation is not supported by Bee client",
    )
  })

  it.concurrent("should cancel an offer", async () => {
    expect(async () => await bee.offers.cancelOffer(offeredReference1)).rejects.toThrowError(
      "This operation is not supported by Bee client",
    )
  })
})

describe("bee client pins", () => {
  let pinnedReference: Reference

  beforeAll(async () => {
    const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId
    pinnedReference = (await bee.bzz.upload("Hello World!", { batchId, pin: true })).reference
  })

  it.concurrent("should fetch all pinned resources", async () => {
    const pins = await bee.pins.download()
    expect(pins.references).toContain(pinnedReference)
  })

  it.concurrent("should fetch users pinning a resource", async () => {
    expect(async () => await bee.pins.downloadPinUsers(pinnedReference)).rejects.toThrowError(
      "Fetch pin users is only supported by the etherna gateway",
    )
  })

  it.concurrent("should pin a resource", async () => {
    const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId
    const { reference } = await bee.bzz.upload("Hello World 1!", { batchId, pin: false })

    await bee.pins.pin(reference)

    const pins = await bee.pins.download()
    expect(pins.references).toContain(reference)
  })

  it.concurrent("should unpin a resource", async () => {
    const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId
    const { reference } = await bee.bzz.upload("Hello World 2!", { batchId, pin: true })

    await bee.pins.unpin(reference)

    const pins = await bee.pins.download()
    expect(pins.references).not.toContain(reference)
  })
})

describe("bee client soc", () => {
  const message = "Etherna is awesome!"
  const messageData = new TextEncoder().encode(message)

  it.concurrent("should create a single owner chunk", async () => {
    const cac = makeContentAddressedChunk(messageData)
    const identifier = keccak256Hash("etherna")
    const soc = await bee.soc.makeSingleOwnerChunk(cac, identifier)

    expect(etc.bytesToHex(soc.data)).toEqual(
      "08b086a7f24adfa7c484ac56869d9463c873a5b182d147ba2c0041ae9fb015f63d" +
        "3b74bc4d87b75e610b4654efa6220404ebe0f3ec329e4a03e0f3a9375a839f02d9" +
        "14b03cbf6caef4599856103f4aeeac60295c5b8804d6c8724aeb9db579f01b1300" +
        "00000000000045746865726e6120697320617765736f6d6521",
    )
    expect(etc.bytesToHex(soc.signature())).toEqual(
      "3d3b74bc4d87b75e610b4654efa6220404ebe0f3ec329e4a03e0f3a9375a839f02d914b03cbf6caef4599856103f4aeeac60295c5b8804d6c8724aeb9db579f01b",
    )
  })

  it("should upload a single owner chunk", async () => {
    const identifier = keccak256Hash("etherna")

    const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId
    const { reference } = await bee.soc.upload(identifier, messageData, {
      batchId,
    })

    expect(reference).length(64)

    const chunkData = await bee.chunk.download(reference)
    const owner = bee.signer?.address as EthAddress
    const socData = await bee.soc.download(identifier, owner)

    expect(chunkData).toEqual(socData.data)
    expect(etc.bytesToHex(socData.payload())).toEqual(etc.bytesToHex(messageData))
  })
})

describe("bee client stamps", { timeout: 1000 * 60 * 5 }, () => {
  // it.sequential("should create a postage stamp", async () => {
  //   const createdBatch = await bee.stamps.create(17, "1000000")

  //   expect(createdBatch.batchID).toHaveLength(64)
  //   expect(createdBatch.depth).toEqual(17)
  //   expect(createdBatch.amount).toEqual("1000000")

  //   const batch = await bee.stamps.download(createdBatch.batchID)

  //   expect(batch.depth).toEqual(17)
  //   expect(batch.amount).toEqual("1000000")
  // })

  it.sequential("should topup a postage stamp", async () => {
    const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId

    expect(batchId).toBeDefined()

    let batch = await bee.stamps.download(batchId)
    const initialAmount = batch.amount

    await bee.stamps.topup(batchId, {
      by: { type: "amount", amount: "1000000" },
      waitUntilUpdated: true,
    })

    batch = await bee.stamps.download(batchId)

    expect(batch.amount).toEqual((BigInt(initialAmount) + BigInt(1000000)).toString())
  })

  it.sequential("should dilute a postage stamp", async () => {
    const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId

    expect(batchId).toBeDefined()

    let batch = await bee.stamps.download(batchId)
    const initialDepth = batch.depth

    await bee.stamps.dilute(batchId, {
      depth: batch.depth + 1,
      waitUntilUpdated: true,
    })

    batch = await bee.stamps.download(batchId)

    expect(batch.depth).toEqual(initialDepth + 1)
  })

  it.sequential("should expand a postage stamp", async () => {
    const batchId = (await bee.stamps.fetchBestBatchId()) as BatchId

    expect(batchId).toBeDefined()

    let batch = await bee.stamps.download(batchId)
    const initialAmount = batch.amount
    const initialDepth = batch.depth

    await bee.stamps.expand(batchId, {
      depth: batch.depth + 1,
      waitUntilUpdated: true,
    })

    batch = await bee.stamps.download(batchId)

    expect(batch.depth).toEqual(initialDepth + 1)

    if (batch.batchTTL !== -1) {
      expect(BigInt(batch.amount)).toBeGreaterThan(BigInt(initialAmount))
    }
  })
})

describe("bee client system", () => {
  it.concurrent("should fetch current byte price", async () => {
    expect(async () => await bee.system.fetchCurrentBytePrice()).rejects.toThrowError(
      "This operation is not supported by Bee client",
    )
  })
})

describe("bee client tags", () => {
  const tagReference = getReferenceFromData(new TextEncoder().encode("Etherna is awesome!"))
  let tag: number

  beforeAll(async () => {
    tag = (await bee.tags.create(tagReference)).uid
  })

  it.concurrent("should fetch all tags", async () => {
    const tags = await bee.tags.downloadAll()
    expect(tags.tags.length).toBeGreaterThan(0)
  })

  it.concurrent("should fetch a tag", async () => {
    const fetchedTag = await bee.tags.download(tag)

    expect(fetchedTag.uid).toEqual(tag)
  })

  it.concurrent("should create a tag", async () => {
    expect(async () => await bee.tags.create(tagReference)).not.toThrow()
  })

  it.concurrent("should delete a tag", async () => {
    expect(async () => await bee.tags.delete(tag)).not.toThrow()
  })
})

describe("bee client user", () => {
  it.concurrent("should fetch current user", async () => {
    expect(async () => await bee.user.downloadCurrentUser()).rejects.toThrowError(
      "This operation is not supported by Bee client",
    )
  })

  it.concurrent("should fetch current user credits", async () => {
    expect(async () => await bee.user.downloadCredit()).rejects.toThrowError(
      "This operation is not supported by Bee client",
    )
  })
})
