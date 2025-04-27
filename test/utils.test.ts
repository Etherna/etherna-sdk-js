import { describe, expect, it } from "vitest"

import { makePrivateKeySigner } from "@/utils"

describe("signer", () => {
  const privateKey = "f6379d2f0229ca418812cf65cc5e26e727c968912442721139b74455dd7a0095"
  const address = "0x3bF4951467539bE005774fD41D2599937B1B65A2"
  const message = "etherna rocks!"
  const validSignature =
    "b3e70d91fc4a21751d9b0f0bf9e9e935d45a774c80311982d3f6c4ac254613845f53de01356a8791cccfc1b22949469982e6e7e5231ea96d23d681cf28d756741c"

  it("should generate the correct address from the private key", async () => {
    const signer = makePrivateKeySigner(privateKey)

    expect(signer.address.toLowerCase()).toEqual(address.toLowerCase())
  })

  it("should sign an ethereum message correctly", async () => {
    const signer = makePrivateKeySigner(privateKey)
    const signature = await signer.sign(message)

    expect(signature).toEqual(validSignature)
  })
})
