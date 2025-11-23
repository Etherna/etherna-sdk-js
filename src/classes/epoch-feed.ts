import { EpochFeedChunk } from "./epoch-feed-chunk"
import { EpochIndex } from "./epoch-index"
import { EthernaSdkError } from "./sdk-error"
import { SOC_PAYLOAD_OFFSET } from "@/consts"

import type { BeeClient } from "@/clients"
import type { Reference } from "@/types/swarm"

export class EpochFeed {
  constructor(public beeClient: BeeClient) {}

  public async createNextEpochFeedChunk(
    account: string,
    topic: Uint8Array,
    contentPayload: Uint8Array,
    knownNearEpochIndex?: EpochIndex,
  ): Promise<EpochFeedChunk> {
    const at = new Date()

    // Find last published chunk.
    const lastEpochFeedChunk = await this.tryFindEpochFeed(account, topic, at, knownNearEpochIndex)

    // Define next epoch index.
    let nextEpochIndex: EpochIndex
    if (!lastEpochFeedChunk) {
      nextEpochIndex = new EpochIndex(0n, EpochIndex.maxLevel)
      if (!nextEpochIndex.containsTime(at)) nextEpochIndex = nextEpochIndex.right
    } else {
      nextEpochIndex = lastEpochFeedChunk.index.getNext(at)
    }

    // Create new chunk.
    const chunkPayload = EpochFeedChunk.buildChunkPayload(contentPayload, at)
    const chunkReferenceHash = EpochFeedChunk.buildReferenceHash(account, topic, nextEpochIndex)

    return new EpochFeedChunk(nextEpochIndex, chunkPayload, chunkReferenceHash)
  }

  public async tryFindEpochFeed(
    account: string,
    topic: Uint8Array,
    at: Date,
    knownNearEpochIndex?: EpochIndex,
  ): Promise<EpochFeedChunk | null> {
    const timestamp = at.toUnixTimestamp().normalized()

    if (timestamp < EpochIndex.minUnixTimeStamp || timestamp > EpochIndex.maxUnixTimeStamp) {
      throw new EthernaSdkError("INVALID_ARGUMENT", "Date is out of allowed range")
    }

    /*
     * This look up is composed by different phases:
     *
     * Phase 1) Find a starting epoch index to look up containing the date. (bottom->up)
     *
     * This doesn't access to swarm network, so it ignores chunks' timestamps.
     * It starts from an optional well known existing epoch index passed by user, and tries to find index of an existing starting chunk.
     * Passed epoch index should be as near as possibile to the final chunk to maximize optimization.
     * Process is tollerant to wrong initial passed index, even if in this case it is not optimized.
     *
     * It tries to find common anchestor between date and existing previously known epoch, if passed.
     * If a previously known epoch is not passed, start at max level with epoch containing the date.
     *
     * -> Input: optional known existing epoch index, near to searched date.
     * <- Output: starting epoch index that could not exist as a chunk, or chunk timestamp could be subsequent to searched date,
     *    but epoch contains the date.
     *
     * ------------
     * Phase 2) Find a starting chunk prior to the searched date. (bottom->up)
     *
     * Verify if selected chunk on phase 1 exists, and if its timestamp is prior to the searched date.
     * If it doesn't exist, or if time stamp is subsequent to searched date,
     *   if epoch index is right, try to search on left,
     *   else if epoch index is left, try to search on parent.
     * Stops when a chunk with previous date is found, or when it reach max level limit on left chunk.
     *
     * -> Input: starting epoch index from phase 1.
     * <- Output: an existing chunk with prior date, or null if a chunk is not found. If null, skip phase 3.
     *
     * ------------
     * Phase 3) Find the existing chunk with timestamp nearest and prior to the searched date. (top->down)
     *
     * It starts from the output chunk of phase 2, and tries to get near as possibile to searched date, without pass it.
     * Is possible that, if the passed chunk is a left chunk, epoch index of passed chunk could not contain the "at" date.
     * In this case adjust the date as (chunk.Index.Right.Start - 1).
     *
     * It tries to get child epoch at date from existing chunk. If chunk exists and is prior, make recursion on it.
     * If it doesn't exist or it has timestamp subsequent to date.
     *   If child is right, try to get left. Check again end eventually make recursion on it.
     *   If child is left return current chunk.
     * It stops when a valid chunk to continue recursion is not found, or when current chunk hit level 0 (max resolution).
     *
     * -> Input: starting chunk from phase 2.
     * <- Output: the chunk with nearest timestamp prior to searched date.
     */

    // Phase 1)
    const startEpoch = this.findStartingEpochOffline(knownNearEpochIndex, at)

    // Phase 2)
    const startChunk = await this.tryFindStartingEpochChunkOnline(account, topic, at, startEpoch)

    if (!startChunk) return null

    // Phase 3)
    return await this.findLastEpochChunkBeforeDate(account, topic, at, startChunk)
  }

  public async tryGetFeedChunk(
    account: string,
    topic: Uint8Array,
    index: EpochIndex,
  ): Promise<EpochFeedChunk | null>
  public async tryGetFeedChunk(
    chunkReferenceHash: Reference,
    index: EpochIndex,
  ): Promise<EpochFeedChunk | null>
  public async tryGetFeedChunk(
    accountOrReference: string | Reference,
    topicOrIndex: Uint8Array | EpochIndex,
    index?: EpochIndex,
  ): Promise<EpochFeedChunk | null> {
    if (topicOrIndex instanceof Uint8Array && index) {
      const topic = topicOrIndex
      return this.tryGetFeedChunk(
        EpochFeedChunk.buildReferenceHash(accountOrReference, topic, index),
        index,
      )
    }

    if (topicOrIndex instanceof EpochIndex) {
      index = topicOrIndex
      const reference = accountOrReference as Reference

      try {
        const chunk = await this.beeClient.chunk.download(reference)
        const payload = chunk.slice(SOC_PAYLOAD_OFFSET)
        return new EpochFeedChunk(index, payload, reference)
      } catch (err) {
        return null
      }
    }

    return null
  }

  // Helpers.

  private async findLastEpochChunkBeforeDate(
    account: string,
    topic: Uint8Array,
    at: Date,
    currentChunk: EpochFeedChunk,
  ): Promise<EpochFeedChunk> {
    // If currentChunk is at max resolution, return it.
    const currentIndex = currentChunk.index

    if (BigInt(currentIndex.level) === EpochIndex.minLevel) {
      return currentChunk
    }

    // Normalize "at" date. Possibile if we are trying a left epoch, but date is contained at right.
    if (!currentIndex.containsTime(at)) {
      const timestamp = (currentIndex.right.start - 1n) * 1000n
      at = timestamp.toDate()
    }

    // Try chunk on child epoch at date.
    const childIndexAtDate = currentIndex.getChildAt(at)
    const childChunkAtDate = await this.tryGetFeedChunk(account, topic, childIndexAtDate)
    if (childChunkAtDate && childChunkAtDate.timestamp && childChunkAtDate.timestamp <= at) {
      return await this.findLastEpochChunkBeforeDate(account, topic, at, childChunkAtDate)
    }

    // Try left brother if different.
    if (childIndexAtDate.isRight) {
      const childLeftChunk = await this.tryGetFeedChunk(account, topic, childIndexAtDate.left)
      if (childLeftChunk) {
        // to check timestamp is superfluous in this case
        return await this.findLastEpochChunkBeforeDate(account, topic, at, childLeftChunk)
      }
    }

    return currentChunk
  }

  /**
   * Implement phase 1 of epoch chunk look up.
   * @param knownNearEpoch An optional epoch index with known existing chunk
   * @param at The searched date
   * @returns A starting epoch index
   */
  private findStartingEpochOffline(knownNearEpoch: EpochIndex | undefined, at: Date): EpochIndex {
    let startEpoch = knownNearEpoch
    if (startEpoch) {
      // traverse parents until find a common ancestor
      while (BigInt(startEpoch.level) != EpochIndex.maxLevel && !startEpoch.containsTime(at)) {
        startEpoch = startEpoch.getParent()
      }

      // if max level is reached and start epoch still doesn't contain the time, drop it
      if (!startEpoch.containsTime(at)) startEpoch = undefined
    }

    // if start epoch is null (known near was null or max epoch level is hit)
    startEpoch ??= new EpochIndex(0n, EpochIndex.maxLevel)
    if (!startEpoch.containsTime(at)) {
      startEpoch = startEpoch.right
    }
    return startEpoch
  }

  private async tryFindStartingEpochChunkOnline(
    account: string,
    topic: Uint8Array,
    at: Date,
    epochIndex: EpochIndex,
  ): Promise<EpochFeedChunk | null> {
    // Try get chunk payload on network.
    const chunk = await this.tryGetFeedChunk(account, topic, epochIndex)

    // If chunk exists and date is prior.
    if (chunk && chunk.timestamp && chunk.timestamp <= at) {
      return chunk
    }

    // Else, if chunk is not found, or if chunk timestamp is later than target date.
    if (epochIndex.isRight) {
      //try left
      return await this.tryFindStartingEpochChunkOnline(account, topic, at, epochIndex.left)
    } else if (BigInt(epochIndex.level) != EpochIndex.maxLevel) {
      //try parent
      return await this.tryFindStartingEpochChunkOnline(account, topic, at, epochIndex.getParent())
    }

    return null
  }
}
