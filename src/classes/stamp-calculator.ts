import { BUCKET_DEPTH, STAMPS_DEPTH_MIN } from "@/consts"
import { fromBigEndian, referenceToBytesReference } from "@/utils"

import type { BucketId, PostageBatchBucket, Reference } from "@/types/swarm"

export type BucketCollisions = Map<BucketId, number>

export class StampCalculator {
  bucketCollisions = new Map<BucketId, number>()
  dirtyCollisions = new Map<BucketId, number>()
  maxBucketCount = 0
  /** Whether the bucket calculator has been seeded with collisions */
  private _isFresh = true

  constructor(collisionsMap?: Record<BucketId, number> | PostageBatchBucket[]) {
    if (collisionsMap) {
      this.seed(collisionsMap)
    }
  }

  get minDepth(): number {
    return Math.max(Math.ceil(Math.log2(this.maxBucketCount)) + BUCKET_DEPTH, STAMPS_DEPTH_MIN)
  }

  get isFresh(): boolean {
    return this._isFresh
  }

  static getBucketId(reference: Reference): BucketId {
    const byteReference = referenceToBytesReference(reference)
    return fromBigEndian(byteReference.slice(0, 4)) >>> (32 - BUCKET_DEPTH)
  }

  /**
   * Merges two bucket calculators collisions
   *
   * @param bucket1 First bucket calculator
   * @param bucket2 Second bucket calculator
   * @returns A new bucket calculator with the merged collisions
   */
  static merge(bucket1: StampCalculator, bucket2: StampCalculator): StampCalculator {
    const mergedBucket = new StampCalculator()

    mergedBucket.seed(Object.fromEntries(bucket1.bucketCollisions.entries()))

    bucket2.bucketCollisions.forEach((value, key) => {
      mergedBucket.bucketCollisions.set(key, (mergedBucket.bucketCollisions.get(key) ?? 0) + value)
    })

    return mergedBucket
  }

  /**
   * Seeds the bucket with existing bucket collisions
   *
   * @param collisionsMap
   */
  seed(collisionsMap: Record<BucketId, number> | Map<number, number> | PostageBatchBucket[]) {
    if (Array.isArray(collisionsMap)) {
      // collision from postage are not dirty
      collisionsMap.forEach((bucket) => {
        this.bucketCollisions.set(bucket.bucketID, bucket.collisions)
      })
    } else {
      Object.entries(collisionsMap).forEach(([id, count]) => {
        const bucketId = Number(id) as BucketId
        this.bucketCollisions.set(bucketId, (this.bucketCollisions.get(bucketId) ?? 0) + count)
        this.dirtyCollisions.set(bucketId, (this.dirtyCollisions.get(bucketId) ?? 0) + count)
      })

      this._isFresh = false
    }
  }

  /**
   * Merges the current stamp calculator with another one
   *
   * @param collisionsMap
   */
  merge(calculator: StampCalculator) {
    calculator.bucketCollisions.forEach((value, key) => {
      this.bucketCollisions.set(key, (this.bucketCollisions.get(key) ?? 0) + value)
    })
    calculator.dirtyCollisions.forEach((value, key) => {
      this.dirtyCollisions.set(key, (this.dirtyCollisions.get(key) ?? 0) + value)
    })
  }

  add(reference: Reference) {
    const bucketId = StampCalculator.getBucketId(reference)

    const currentCollisions = this.bucketCollisions.get(bucketId) || 0

    this.bucketCollisions.set(bucketId, currentCollisions + 1)
    this.dirtyCollisions.set(bucketId, (this.dirtyCollisions.get(bucketId) ?? 0) + 1)

    if (currentCollisions > this.maxBucketCount) {
      this.maxBucketCount = currentCollisions
    }
  }

  remove(reference: Reference) {
    const bucketId = StampCalculator.getBucketId(reference)

    if (this.bucketCollisions.has(bucketId)) {
      this.bucketCollisions.set(bucketId, (this.bucketCollisions.get(bucketId) ?? 0) - 1)
    }

    if (this.bucketCollisions.get(bucketId) === 0) {
      this.bucketCollisions.delete(bucketId)
    }

    this.maxBucketCount = 0

    this.bucketCollisions.forEach((value) => {
      if (value > this.maxBucketCount) {
        this.maxBucketCount = value
      }
    })
  }
}
