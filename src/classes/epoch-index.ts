import { EthernaSdkError } from "./sdk-error"
import { keccak256Hash, toBigEndianFromBigInt64 } from "@/utils"

export class EpochIndex {
  public static readonly maxLevel = 32n // valid from 01/01/1970 to 16/03/2242
  public static readonly minLevel = 0n
  public static readonly maxStart = 2n ** (this.maxLevel + 1n) - 1n // 16/03/2242
  public static readonly maxUnixTimeStamp = (1n << (this.maxLevel + 1n)) - 1n
  public static readonly minUnixTimeStamp = 0n

  /** Epoch start in seconds */
  start: bigint
  /** Epoch level (32 to 0) */
  level: number

  constructor(start: bigint, level: number | bigint) {
    if (start >= 1n << (EpochIndex.maxLevel + 1n)) {
      throw new EthernaSdkError("INVALID_ARGUMENT", "'start' is too big")
    }
    if (BigInt(level) > EpochIndex.maxLevel) {
      throw new EthernaSdkError("INVALID_ARGUMENT", "'level' is too big")
    }

    this.level = Number(level)
    //normalize start clearing less relevent bits
    this.start = (start >> BigInt(level)) << BigInt(level)
  }

  // props
  public get isLeft(): boolean {
    return (BigInt(this.start) & BigInt(this.length)) === BigInt(0)
  }
  public get isRight(): boolean {
    return !this.isLeft
  }
  public get length(): bigint {
    return 1n << BigInt(this.level)
  }
  public get marshalBinary(): Uint8Array {
    const epochBytes = toBigEndianFromBigInt64(this.start)
    const newArray = new Uint8Array([...epochBytes, this.level])
    return keccak256Hash(newArray)
  }
  public get left(): EpochIndex {
    return this.isLeft ? this : new EpochIndex(this.start - this.length, this.level)
  }
  public get right(): EpochIndex {
    return this.isRight ? this : new EpochIndex(this.start + this.length, this.level)
  }

  // static methods
  public static fromString(epochString: string): EpochIndex {
    const [start, level] = epochString.split("/")

    if (!start || !level) throw new EthernaSdkError("INVALID_ARGUMENT", "Invalid epoch string")

    return new EpochIndex(BigInt(start), Number(level))
  }

  // methods
  public containsTime(at: Date) {
    const timestamp = at.toUnixTimestamp().normalized()
    return timestamp >= this.start && timestamp < this.start + this.length
  }

  public getChildAt(at: Date): EpochIndex {
    const timestamp = at.toUnixTimestamp().normalized()
    if (this.level === 0)
      throw new EthernaSdkError("INVALID_ARGUMENT", "'level' must be greater than 0")
    if (timestamp < this.start)
      throw new EthernaSdkError("INVALID_ARGUMENT", "'at' is before start")
    if (timestamp >= this.start + this.length)
      throw new EthernaSdkError("INVALID_ARGUMENT", "'at' is out of level")

    let childStart = this.start
    const childLength = this.length >> 1n

    if ((timestamp & childLength) > 0) childStart |= childLength

    return new EpochIndex(childStart, this.level - 1)
  }

  public getNext(at: Date) {
    const timestamp = at.toUnixTimestamp().normalized()
    if (timestamp < this.start)
      throw new EthernaSdkError("INVALID_ARGUMENT", "'at' must be greater  or equal than 'start'")

    return this.start + this.length > timestamp
      ? this.getChildAt(at)
      : EpochIndex.lowestCommonAncestor(this.start, timestamp).getChildAt(at)
  }

  public getParent(): EpochIndex {
    if (BigInt(this.level) === EpochIndex.maxLevel)
      throw new EthernaSdkError("INVALID_ARGUMENT", "'level' is too big")

    const parentLevel = this.level + 1
    const parentStart = (this.start >> BigInt(parentLevel)) << BigInt(parentLevel)
    return new EpochIndex(parentStart, parentLevel)
  }

  public isEqual(other: EpochIndex): boolean {
    return this.start === other.start && this.level === other.level
  }

  // static methods

  /**
   * Calculates the lowest common ancestor epoch given two unix times
   * @param t0
   * @param t1
   * @returns  Lowest common ancestor epoch index
   */
  public static lowestCommonAncestor(t0: bigint, t1: bigint): EpochIndex {
    let level = 0
    while (t0 >> BigInt(level) != t1 >> BigInt(level)) {
      level++
      if (BigInt(level) > EpochIndex.maxLevel)
        throw new EthernaSdkError("INVALID_ARGUMENT", "Epochs are too far apart")
    }
    const start = (t1 >> BigInt(level)) << BigInt(level)
    return new EpochIndex(start, level)
  }

  public toString(): string {
    return `${this.start}/${this.level}`
  }
}
