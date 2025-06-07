import { beforeAll, describe, expect, it } from "vitest"

import { BeeClient } from "@/clients"
import { UserFollowingsManifest } from "@/manifest"

import type { BatchId, EthAddress } from "@/types"

describe("users followings manifest read", () => {
  const beeClient = new BeeClient("http://localhost:1633", {
    signer: "f6379d2f0229ca418812cf65cc5e26e727c968912442721139b74455dd7a0095",
  })
  const owner = beeClient.signer?.address as EthAddress
  let batchId: BatchId

  beforeAll(async () => {
    batchId =
      (await beeClient.stamps.fetchBestBatchId()) ??
      (await beeClient.stamps.create(17, 60 * 60 * 24 * 7)).batchID
    const userFollowings = new UserFollowingsManifest({ beeClient })
    userFollowings.addFollowing("0x0000000000000000000000000000000000000000" as EthAddress)
    userFollowings.addFollowing("0x0000000000000000000000000000000000000001" as EthAddress)
    userFollowings.addFollowing("0x0000000000000000000000000000000000000002" as EthAddress)
    await userFollowings.upload({ batchId })
  })

  it("should get the user followings owner", () => {
    const userFollowings = new UserFollowingsManifest({ beeClient })
    expect(userFollowings.owner).toBe(owner)
  })

  it("should download the user followings", async () => {
    const userFollowings = new UserFollowingsManifest({ beeClient })
    await userFollowings.download()
    expect(userFollowings.followings).toStrictEqual([
      "0x0000000000000000000000000000000000000002",
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000000",
    ])
  })
})

describe("users followings manifest write", () => {
  const beeClient = new BeeClient("http://localhost:1633", {
    signer: "f6379d2f0229ca418812cf65cc5e26e727c968912442721139b74455dd7a0095",
  })
  let batchId: BatchId

  beforeAll(async () => {
    batchId =
      (await beeClient.stamps.fetchBestBatchId()) ??
      (await beeClient.stamps.create(17, 60 * 60 * 24 * 7)).batchID
  })

  it("should add a following", async () => {
    const userFollowings = new UserFollowingsManifest({ beeClient })
    userFollowings.addFollowing("0x0000000000000000000000000000000000000000" as EthAddress)

    expect(userFollowings.followings).toStrictEqual(["0x0000000000000000000000000000000000000000"])
  })

  it("should remove a following", async () => {
    const userFollowings = new UserFollowingsManifest({ beeClient })
    userFollowings.addFollowing("0x0000000000000000000000000000000000000000" as EthAddress)
    userFollowings.addFollowing("0x0000000000000000000000000000000000000001" as EthAddress)
    userFollowings.addFollowing("0x0000000000000000000000000000000000000002" as EthAddress)
    userFollowings.removeFollowing("0x0000000000000000000000000000000000000001" as EthAddress)

    expect(userFollowings.followings).toStrictEqual([
      "0x0000000000000000000000000000000000000002",
      "0x0000000000000000000000000000000000000000",
    ])
  })

  it("should upload the user followings", async () => {
    const userFollowings = new UserFollowingsManifest({ beeClient })
    userFollowings.addFollowing("0x0000000000000000000000000000000000000000" as EthAddress)
    userFollowings.addFollowing("0x0000000000000000000000000000000000000001" as EthAddress)
    userFollowings.addFollowing("0x0000000000000000000000000000000000000002" as EthAddress)
    expect(async () => await userFollowings.upload({ batchId })).not.toThrow()
  })

  it("should update the user followings", async () => {
    const createFollowings = new UserFollowingsManifest({ beeClient })
    createFollowings.addFollowing("0x0000000000000000000000000000000000000000" as EthAddress)
    createFollowings.addFollowing("0x0000000000000000000000000000000000000001" as EthAddress)
    createFollowings.addFollowing("0x0000000000000000000000000000000000000002" as EthAddress)
    await createFollowings.upload({ batchId })

    const editFollowings = new UserFollowingsManifest(createFollowings.followings, { beeClient })
    await editFollowings.download()
    editFollowings.removeFollowing("0x0000000000000000000000000000000000000001" as EthAddress)
    await editFollowings.upload({ batchId })

    const readFollowings = new UserFollowingsManifest({ beeClient })
    await readFollowings.download()
    expect(readFollowings.followings).toStrictEqual([
      "0x0000000000000000000000000000000000000002",
      "0x0000000000000000000000000000000000000000",
    ])
  })
})
