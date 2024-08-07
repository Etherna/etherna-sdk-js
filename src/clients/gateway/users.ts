import type { EthernaGatewayClient } from "."
import type { RequestOptions } from ".."
import type {
  GatewayBatch,
  GatewayBatchPreview,
  GatewayCredit,
  GatewayCurrentUser,
  GatewayWelcomeStatus,
} from "./types"

export class UsersClient {
  constructor(private instance: EthernaGatewayClient) {}

  /**
   * Get the current logged user's info
   * @returns Gateway current user
   */
  async fetchCurrentUser(opts?: RequestOptions) {
    const resp = await this.instance.request.get<GatewayCurrentUser>(`/users/current`, {
      ...this.instance.prepareAxiosConfig(opts),
    })

    if (typeof resp.data !== "object") {
      throw new Error("Cannot fetch user")
    }

    return resp.data
  }

  /**
   * Get current user's credit
   *
   * @returns User's credit amount
   */
  async fetchCredit(opts?: RequestOptions) {
    const resp = await this.instance.request.get<GatewayCredit>(`/users/current/credit`, {
      ...this.instance.prepareAxiosConfig(opts),
    })

    if (typeof resp.data !== "object") {
      throw new Error("Cannot fetch user's credit")
    }

    return resp.data
  }

  /**
   * Get current user's pinned resources
   *
   * @returns List of resources references
   */
  async fetchPinnedResources(opts?: RequestOptions) {
    const resp = await this.instance.request.get<string[]>(`/users/current/pinnedResources`, {
      ...this.instance.prepareAxiosConfig(opts),
    })

    if (!Array.isArray(resp.data)) {
      throw new Error("Cannot fetch user's pinned resources")
    }

    return resp.data
  }

  /**
   * Get current user's batches
   *
   * @returns User's list of batches
   */
  async fetchBatches(labelQuery?: string, opts?: RequestOptions) {
    const resp = await this.instance.request.get<GatewayBatchPreview[]>(`/users/current/batches`, {
      ...this.instance.prepareAxiosConfig(opts),
      params: {
        labelContainsFilter: labelQuery,
      },
    })

    if (!Array.isArray(resp.data)) {
      throw new Error("Cannot fetch user's batches")
    }

    return resp.data
  }

  /**
   * Fetch the current user's welcome status
   *
   * @param opts Request options
   * @returns User's welcome status
   */
  async fetchWelcome(opts?: RequestOptions) {
    const resp = await this.instance.request.get<GatewayWelcomeStatus>(`/users/current/welcome`, {
      ...this.instance.prepareAxiosConfig(opts),
    })

    return {
      isFreePostageBatchConsumed: resp.data.isFreePostageBatchConsumed ?? false,
    }
  }

  /**
   * Create a new batch
   *
   * @param depth Depth of the batch (size)
   * @param amount Amount of the batch (TTL)
   * @returns The newly created batch
   */
  async createBatch(
    depth: number,
    amount: bigint | string,
    label?: string,
    opts?: RequestOptions,
  ): Promise<GatewayBatch> {
    const resp = await this.instance.request.post<string>(`/users/current/batches`, null, {
      ...this.instance.prepareAxiosConfig(opts),
      params: {
        depth,
        amount,
        label,
      },
    })

    const referenceId = resp.data

    if (typeof referenceId !== "string") {
      throw new Error("Coudn't create a new batch")
    }

    let resolver: (batch: GatewayBatch) => void
    let rejecter: () => void
    let timeout: number
    let newBatchId: string

    const fetchBatch = async () => {
      clearTimeout(timeout)

      if (opts?.signal?.aborted) {
        return rejecter()
      }

      timeout = window.setTimeout(async () => {
        try {
          if (!newBatchId) {
            newBatchId = await this.fetchPostageBatchRef(referenceId)
          }
          if (newBatchId) {
            const batch = await this.fetchBatch(newBatchId)
            return resolver(batch)
          }
        } catch {}

        fetchBatch()
      }, 5000)
    }

    return await new Promise<GatewayBatch>((resolve, reject) => {
      resolver = resolve
      rejecter = reject
      fetchBatch()
    })
  }

  /**
   * Get current user's batches
   *
   * @param batchId Id of the swarm batch
   * @returns User's list of batches
   */
  async fetchBatch(batchId: string, opts?: RequestOptions) {
    const resp = await this.instance.request.get<GatewayBatch>(
      `/users/current/batches/${batchId}`,
      {
        ...this.instance.prepareAxiosConfig(opts),
      },
    )

    if (typeof resp.data !== "object") {
      throw new Error("Cannot fetch user's batch")
    }

    return resp.data
  }

  /**
   * Dilute batch (increase size)
   *
   * @param batchId Id of the swarm batch
   * @param depth New batch depth
   */
  async diluteBatch(batchId: string, depth: number, opts?: RequestOptions) {
    await this.instance.request.patch(`/users/current/batches/${batchId}/dilute/${depth}`, null, {
      ...this.instance.prepareAxiosConfig(opts),
    })

    return true
  }

  /**
   * Get current user's offered resources
   *
   * @returns Reference list of offered resources
   */
  async fetchOfferedResources(opts?: RequestOptions) {
    const resp = await this.instance.request.get<string[]>(`/users/current/offeredResources`, {
      ...this.instance.prepareAxiosConfig(opts),
    })

    if (typeof resp.data !== "object") {
      throw new Error("Cannot fetch user's offered resources")
    }

    return resp.data
  }

  /**
   * Request the creations of the offered postage batch (only for new users)
   *
   * @param opts Request options
   * @returns 'true' if the request was successful
   */
  async requestWelcomePostage(opts?: RequestOptions) {
    await this.instance.request.post(`/users/current/welcome`, null, {
      ...this.instance.prepareAxiosConfig(opts),
    })

    return true
  }

  // SYSTEM

  /**
   * Fetch creation batch id
   *
   * @param referenceId Reference id of the batch
   * @returns The created batch id if completed
   */
  async fetchPostageBatchRef(referenceId: string, opts?: RequestOptions) {
    const resp = await this.instance.request.get<string>(`/system/postagebatchref/${referenceId}`, {
      ...this.instance.prepareAxiosConfig(opts),
    })

    const batchId = resp.data

    if (!batchId || typeof resp.data !== "string") {
      throw new Error("Batch still processing")
    }

    return batchId
  }
}
