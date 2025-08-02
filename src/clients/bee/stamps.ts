import { EthernaSdkError, getSdkError, StampCalculator, throwSdkError } from "@/classes"
import {
  ETHERNA_MAX_BATCH_DEPTH,
  ETHERNA_WELCOME_BATCH_DEPTH,
  ETHERNA_WELCOME_POSTAGE_LABEL,
  STAMPS_DEPTH_MIN,
} from "@/consts"
import { calcExpandAmount, getBatchPercentUtilization, ttlToAmount } from "@/utils"

import type { BeeClient } from "."
import type {
  EthernaGatewayBatch,
  EthernaGatewayBatchPreview,
  EthernaGatewayWelcomeStatus,
} from "./types"
import type { BucketCollisions } from "@/classes"
import type { RequestOptions } from "@/types/clients"
import type { BatchId, PostageBatch, PostageBatchBucketsData } from "@/types/swarm"

const stampsEndpoint = "/stamps"

interface CreatePostageBatchOptions extends RequestOptions {
  label?: string
  useWelcomeIfPossible?: boolean
  onStatusChange?: <T extends "pending-creation" | "created">(
    status: T,
    data: T extends "pending-creation"
      ? { postageBatchRef: string | null }
      : T extends "created"
        ? { batchId: BatchId }
        : never,
  ) => void
}

interface DownloadPostageBatchOptions extends RequestOptions {
  waitUntilUsable?: boolean
  waitUntil?: (batch: PostageBatch) => boolean
}

interface FetchBestBatchIdOptions extends RequestOptions {
  labelQuery?: string
  minDepth?: number
  collisions?: BucketCollisions
}

interface TopupBatchOptions extends RequestOptions {
  by: { type: "amount"; amount: bigint | string } | { type: "time"; seconds: number }
  initialAmount?: bigint | string
  waitUntilUpdated?: boolean
}

interface DiluteBatchOptions extends RequestOptions {
  depth: number
  waitUntilUpdated?: boolean
}

interface ExpandBatchOptions extends DiluteBatchOptions {
  ttl?: number
}

export class Stamps {
  constructor(private instance: BeeClient) {}

  async create(
    depth: number,
    amount: bigint | string,
    options?: CreatePostageBatchOptions,
  ): Promise<PostageBatch>
  async create(
    depth: number,
    ttl: number,
    options?: CreatePostageBatchOptions,
  ): Promise<PostageBatch>
  async create(
    depth = STAMPS_DEPTH_MIN,
    amountOrTtl: bigint | string | number,
    options?: CreatePostageBatchOptions,
  ): Promise<PostageBatch> {
    const { label, useWelcomeIfPossible, onStatusChange, ...opts } = options ?? {}

    if (this.instance.type === "etherna" && depth > ETHERNA_MAX_BATCH_DEPTH) {
      throw new EthernaSdkError(
        "INVALID_ARGUMENT",
        `Maximum depth for an Etherna batch is ${ETHERNA_MAX_BATCH_DEPTH}`,
      )
    }

    try {
      let batchId: BatchId

      const amount =
        typeof amountOrTtl === "number"
          ? ttlToAmount(
              amountOrTtl,
              await this.instance.chainstate.getCurrentPrice(),
              this.instance.chain.blockTime,
            )
          : amountOrTtl

      switch (this.instance.type) {
        case "bee": {
          const resp = await this.instance.request.post<{ batchID: BatchId }>(
            `${stampsEndpoint}/${amount}/${depth}`,
            null,
            {
              params: {
                label,
              },
              ...this.instance.prepareAxiosConfig(opts),
            },
          )
          batchId = resp.data.batchID
          break
        }
        case "etherna": {
          await this.instance.awaitAccessToken()

          if (useWelcomeIfPossible && depth <= ETHERNA_WELCOME_BATCH_DEPTH) {
            const { batchID } = await this.createWelcomeBatch(options)
            batchId = batchID
            break
          }

          const resp = await this.instance.apiRequest.post<string>(`/users/current/batches`, null, {
            ...this.instance.prepareAxiosConfig(opts),
            params: {
              depth,
              amount,
              label,
            },
          })

          const referenceId = resp.data

          onStatusChange?.("pending-creation", { postageBatchRef: referenceId })

          let resolver: (batchId: BatchId) => void
          let rejecter: (err: EthernaSdkError) => void
          let timeout: NodeJS.Timeout

          const waitBatchCreation = () => {
            clearTimeout(timeout)

            if (opts?.signal?.aborted) {
              return rejecter(
                new EthernaSdkError("ABORTED_BY_USER", "The operation was aborted by the user"),
              )
            }

            timeout = setTimeout(() => {
              this.instance.system.fetchPostageBatchRef(referenceId).then((batchId) => {
                if (batchId) {
                  resolver(batchId)
                }
              })

              waitBatchCreation()
            }, 5000)
          }

          batchId = await new Promise<BatchId>((resolve, reject) => {
            resolver = resolve
            rejecter = reject
            waitBatchCreation()
          })
        }
      }

      if (!batchId) {
        throw new EthernaSdkError(
          "SERVER_ERROR",
          "An unhandled error has occurred while creating batch",
        )
      }

      onStatusChange?.("created", { batchId })

      return await this.download(batchId, { waitUntilUsable: true })
    } catch (error) {
      throwSdkError(error)
    }
  }

  async download(batchId: BatchId, options?: DownloadPostageBatchOptions): Promise<PostageBatch> {
    try {
      const { waitUntilUsable, waitUntil, ...opts } = options ?? {}

      const fetchBatch = async () => {
        switch (this.instance.type) {
          case "bee": {
            const postageResp = await this.instance.request.get<PostageBatch>(
              `${stampsEndpoint}/${batchId}`,
              {
                ...this.instance.prepareAxiosConfig(opts),
              },
            )
            return postageResp.data
          }
          case "etherna": {
            await this.instance.awaitAccessToken()

            const resp = await this.instance.apiRequest.get<EthernaGatewayBatch>(
              `/users/current/batches/${batchId}`,
              {
                ...this.instance.prepareAxiosConfig(opts),
              },
            )
            return this.parseGatewayPostageBatch(resp.data)
          }
        }
      }

      if (!waitUntilUsable && !waitUntil) {
        return await fetchBatch()
      }

      return await this.waitBatchValid(batchId, waitUntil ?? ((batch) => batch.usable), opts)
    } catch (error) {
      throwSdkError(error)
    }
  }

  async downloadAll(
    labelQuery?: string,
    options?: RequestOptions,
  ): Promise<(PostageBatch | EthernaGatewayBatchPreview)[]> {
    try {
      switch (this.instance.type) {
        case "bee": {
          const postageResp = await this.instance.request.get<{ stamps: PostageBatch[] }>(
            stampsEndpoint,
            {
              ...this.instance.prepareAxiosConfig(options),
            },
          )
          return postageResp.data.stamps
            .filter(
              (batch) =>
                !labelQuery || batch.label.toLowerCase().includes(labelQuery.toLowerCase()),
            )
            .toReversed()
        }
        case "etherna": {
          await this.instance.awaitAccessToken()

          const resp = await this.instance.apiRequest.get<EthernaGatewayBatchPreview[]>(
            `/users/current/batches`,
            {
              ...this.instance.prepareAxiosConfig(options),
              params: {
                labelContainsFilter: labelQuery,
              },
            },
          )
          return resp.data.toReversed()
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  async downloadBuckets(
    batchId: BatchId,
    options?: RequestOptions,
  ): Promise<PostageBatchBucketsData> {
    try {
      switch (this.instance.type) {
        case "bee": {
          const postageResp = await this.instance.request.get<PostageBatchBucketsData>(
            `${stampsEndpoint}/${batchId}/buckets`,
            {
              ...this.instance.prepareAxiosConfig(options),
            },
          )
          return postageResp.data
        }
        case "etherna": {
          throw new EthernaSdkError("NOT_IMPLEMENTED", "This method is not implemented for Etherna")
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Find best usable batch to use.
   * Use the option:
   * - `minDepth` to filter batches with a minimum depth
   * - `labelQuery` to filter batches by label
   * - `stampCalculator` to provide the bucket collision to upload (best to find the batch with most buckets available)
   *
   * @param options
   * @returns The best batch to use or null if no batch is found
   */
  async fetchBestBatch(
    options?: FetchBestBatchIdOptions,
  ): Promise<(PostageBatch & { collisions?: BucketCollisions }) | null> {
    try {
      const batches = await this.downloadAll(options?.labelQuery, options)
      const minBatchDepth = options?.minDepth ?? STAMPS_DEPTH_MIN

      for (const batch of batches) {
        if (options?.collisions) {
          const batchId = "ownerNodeId" in batch ? batch.batchId : batch.batchID
          const { isUsable, batchCollisions } = await this.fetchIsFillableBatch(
            batchId,
            options.collisions,
          )

          if (!isUsable) {
            continue
          }

          const fullPostageBatch =
            "ownerNodeId" in batch ? await this.download(batchId, options) : batch

          const augmentedBatch = fullPostageBatch as PostageBatch & {
            collisions?: BucketCollisions
          }
          Object.assign(augmentedBatch, { collisions: batchCollisions })

          return augmentedBatch
        }

        const postageBatch = "utilization" in batch ? batch : await this.download(batch.batchId)

        if (!postageBatch.usable) {
          continue
        }

        if (postageBatch.depth < minBatchDepth) {
          continue
        }

        if (getBatchPercentUtilization(postageBatch) < 1) {
          return postageBatch
        }
      }

      return null
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Find best usable batchId to use.
   * Use the option:
   * - `minDepth` to filter batches with a minimum depth
   * - `labelQuery` to filter batches by label
   * - `stampCalculator` to provide the bucket collision to upload (best to find the batch with most buckets available)
   *
   * @param options
   * @returns The best batchId to use or null if no batch is found
   */
  async fetchBestBatchId(
    options?: FetchBestBatchIdOptions,
  ): Promise<(BatchId & { collisions?: BucketCollisions }) | null> {
    const batch = await this.fetchBestBatch(options)
    if (batch) {
      const augmentedBatchId = batch.batchID as BatchId & { collisions?: BucketCollisions }
      Object.assign(augmentedBatchId, { collisions: batch.collisions })

      return augmentedBatchId
    }

    return null
  }

  /**
   * Topup batch (increase TTL)
   *
   * @param batchId Id of the swarm batch
   * @param byAmount Amount to add to the batch
   */
  async topup(batchId: BatchId, options: TopupBatchOptions): Promise<PostageBatch> {
    const { by, waitUntilUpdated, ...opts } = options
    const price = await this.instance.chainstate.getCurrentPrice(opts)
    const amount =
      by.type === "amount"
        ? by.amount
        : ttlToAmount(by.seconds, price, this.instance.chain.blockTime)
    const postage = await this.download(batchId)
    const initialAmount = options.initialAmount ?? postage.amount

    try {
      switch (this.instance.type) {
        case "bee": {
          await this.instance.request.patch<{ batchID: BatchId }>(
            `${stampsEndpoint}/topup/${batchId}/${amount}`,
            null,
            {
              ...this.instance.prepareAxiosConfig(opts),
            },
          )
          break
        }
        case "etherna": {
          await this.instance.awaitAccessToken()

          await this.instance.apiRequest.patch(
            `/postage/batches/${batchId}/topup/${amount}`,
            null,
            {
              ...this.instance.prepareAxiosConfig(opts),
            },
          )
          break
        }
      }

      if (waitUntilUpdated) {
        return await this.waitBatchValid(batchId, (batch) => batch.amount > initialAmount, opts)
      }

      return postage
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Dillute batch (increase size)
   *
   * @param batchId Id of the swarm batch
   * @param options Dilute options
   */
  async dilute(batchId: BatchId, options: DiluteBatchOptions): Promise<PostageBatch> {
    const { depth, waitUntilUpdated, ...opts } = options

    try {
      switch (this.instance.type) {
        case "bee": {
          await this.instance.request.patch<{ batchID: BatchId }>(
            `${stampsEndpoint}/dilute/${batchId}/${depth}`,
            null,
            {
              ...this.instance.prepareAxiosConfig(opts),
            },
          )
          break
        }
        case "etherna": {
          await this.instance.awaitAccessToken()

          await this.instance.apiRequest.patch(
            `/users/current/batches/${batchId}/dilute/${depth}`,
            null,
            {
              ...this.instance.prepareAxiosConfig(opts),
            },
          )
          break
        }
      }

      if (waitUntilUpdated) {
        return await this.waitBatchValid(batchId, (batch) => batch.depth === depth, opts)
      }

      return this.download(batchId)
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * (unofficial api) - Dilute a batch + Auto topup to keep the same TTL
   *
   * @param batchId Id of batch to extend
   * @param options Dilute options
   */
  async expand(batchId: BatchId, options: ExpandBatchOptions): Promise<PostageBatch> {
    const [batch, price] = await Promise.all([
      this.download(batchId),
      this.instance.chainstate.getCurrentPrice(),
    ])

    if (options.ttl && options.ttl <= batch.batchTTL) {
      throw new EthernaSdkError(
        "INVALID_ARGUMENT",
        `The new TTL must be greater than the current batch TTL (${batch.batchTTL})`,
      )
    }

    const amount = calcExpandAmount(batch, options.depth, options.ttl ?? batch.batchTTL, {
      price,
      blockTime: this.instance.chain.blockTime,
    })

    // Dilute first: If you top up before diluting, the TTL you gain will be reduced by the dilution step.
    await this.dilute(batchId, {
      ...options,
      // we are forced to wait the topup before diluting
      waitUntilUpdated: true,
    })

    // Top up after: This ensures the TTL reflects the new, higher depth and the additional xBZZ.
    return await this.topup(batchId, {
      by: {
        type: "amount",
        amount,
      },
      ...options,
    })
  }

  async isWelcomeConsumed(opts?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          throw new EthernaSdkError("NOT_IMPLEMENTED", "This method is not implemented for Bee")
        }
        case "etherna": {
          await this.instance.awaitAccessToken()

          const resp = await this.instance.apiRequest.get<EthernaGatewayWelcomeStatus>(
            "/users/current/welcome",
            {
              ...this.instance.prepareAxiosConfig(opts),
            },
          )
          return resp.data.isFreePostageBatchConsumed
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  // Utils methods

  private async createWelcomeBatch(options?: CreatePostageBatchOptions): Promise<PostageBatch> {
    const { onStatusChange, ...opts } = options ?? {}

    try {
      const isFreePostageBatchConsumed = await this.isWelcomeConsumed(opts)

      if (!isFreePostageBatchConsumed) {
        await this.instance.awaitAccessToken()

        await this.instance.apiRequest.post(`/users/current/welcome`, null, {
          ...this.instance.prepareAxiosConfig(opts),
        })
      }

      onStatusChange?.("pending-creation", { postageBatchRef: null })

      const start = Date.now()

      const maxDuration = 1000 * 60 * 10 // 10 minute
      let resolver: (batch: PostageBatch) => void
      let rejecter: (err: EthernaSdkError) => void
      let timeout: NodeJS.Timeout

      const waitBatch = async () => {
        clearTimeout(timeout)

        if (opts?.signal?.aborted) {
          return rejecter(
            new EthernaSdkError("ABORTED_BY_USER", "The operation was aborted by the user"),
          )
        }

        if (Date.now() - start > maxDuration) {
          return rejecter(
            new EthernaSdkError("TIMEOUT", "The operation has timed out. Please try again."),
          )
        }

        timeout = setTimeout(() => {
          this.downloadAll(ETHERNA_WELCOME_POSTAGE_LABEL).then((batches) => {
            const welcomeBatch = batches[0]
            if (welcomeBatch) {
              if ("amount" in welcomeBatch) {
                resolver(welcomeBatch)
              } else {
                this.download(welcomeBatch.batchId).then(resolver)
              }
            } else {
              waitBatch()
            }
          })
          waitBatch()
        }, 5000)
      }

      return await new Promise<PostageBatch>((resolve, reject) => {
        resolver = resolve
        rejecter = reject
        waitBatch()
      })
    } catch (error) {
      throwSdkError(error)
    }
  }

  private parseGatewayPostageBatch(batch: EthernaGatewayBatch): PostageBatch {
    const { id, amountPaid: _p, normalisedBalance: _b, ...postageBatch } = batch
    return {
      batchID: id,
      ...postageBatch,
    }
  }

  private async waitBatchValid(
    batchId: BatchId,
    isValidCallback: (batch: PostageBatch) => boolean,
    options?: RequestOptions,
  ): Promise<PostageBatch> {
    let resolver: (batch: PostageBatch) => void
    let rejecter: (err: EthernaSdkError) => void
    let timeout: NodeJS.Timeout

    const waitBatchValid = async () => {
      clearTimeout(timeout)

      if (options?.signal?.aborted) {
        return rejecter(
          new EthernaSdkError("ABORTED_BY_USER", "The operation was aborted by the user"),
        )
      }

      timeout = setTimeout(() => {
        this.download(batchId, options)
          .then((batch) => {
            if (isValidCallback(batch)) {
              resolver(batch)
            } else {
              waitBatchValid()
            }
          })
          .catch((err) => {
            const error = getSdkError(err)
            const data = error.axiosError?.response?.data as { message?: string } | undefined
            const msg = data?.message as string | undefined
            const isNotUsableError =
              error.axiosError?.response?.status === 400 &&
              msg?.toLowerCase().includes("not usable")

            if (isNotUsableError) {
              waitBatchValid()
            } else {
              rejecter(error)
            }
          })
      }, 5000)
    }

    return await new Promise<PostageBatch>((resolve, reject) => {
      resolver = resolve
      rejecter = reject
      waitBatchValid()
    })
  }

  private fetchIsFillableBatch = async (batchId: BatchId, collisions: BucketCollisions) => {
    const bucketsInfos = await this.downloadBuckets(batchId)

    const stampCalculator = new StampCalculator()
    stampCalculator.bucketCollisions = collisions
    stampCalculator.seed(bucketsInfos.buckets)

    return {
      batchId,
      isUsable: stampCalculator.minDepth <= bucketsInfos.depth,
      batchCollisions: stampCalculator.bucketCollisions,
    }
  }
}
