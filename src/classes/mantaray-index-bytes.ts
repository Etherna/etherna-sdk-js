// Forked from: https://github.com/ethersphere/mantaray-js

import { checkBytes } from "@/utils"

import type { Bytes } from "@/types/utils"

export class MantarayIndexBytes {
  private bytes: Bytes<32>

  public constructor() {
    this.bytes = new Uint8Array(32) as Bytes<32>
  }

  public get getBytes(): Bytes<32> {
    return new Uint8Array([...this.bytes]) as Bytes<32>
  }

  public set setBytes(bytes: Bytes<32>) {
    checkBytes<32>(bytes, 32)

    this.bytes = new Uint8Array([...bytes]) as Bytes<32>
  }

  /**
   *
   * @param byte is number max 255
   */
  public setByte(byte: number): void {
    if (byte > 255) {
      throw new Error(`IndexBytes setByte error: ${byte} is greater than 255`)
    }

    const index = Math.floor(byte / 8)

    if (this.bytes[index] !== undefined) {
      this.bytes[index] |= 1 << byte % 8
    }
  }

  /**
   * checks the given byte is mapped in the Bytes<32> index
   *
   * @param byte is number max 255
   */
  public checkBytePresent(byte: number): boolean {
    const index = Math.floor(byte / 8)

    if (this.bytes[index] !== undefined) {
      return ((this.bytes[index] >> byte % 8) & 1) > 0
    }

    return false
  }

  /** Iterates through on the indexed byte values */
  public forEach(hook: (byte: number) => void): void {
    for (let i = 0; i <= 255; i++) {
      if (this.checkBytePresent(i)) {
        hook(i)
      }
    }
  }
}
