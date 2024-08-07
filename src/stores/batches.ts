import { createJSONStorage, devtools, persist } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { createStore } from "zustand/vanilla"

import type { BatchId, GatewayBatch, PostageBatch } from "../clients"

export enum BatchUpdateType {
  Create = 1,
  Topup = 2,
  Dilute = 4,
}

export type UpdatingBatch = {
  id: BatchId
  depth: number
  amount: string
  flag: BatchUpdateType
}

export type BatchesState = {
  updatingBatches: UpdatingBatch[]
  addBatchUpdate(batch: PostageBatch | GatewayBatch | UpdatingBatch, type: BatchUpdateType): void
  removeBatchUpdate(batchId: BatchId): void
}

export const batchesStore = createStore<BatchesState>()(
  devtools(
    persist(
      immer((set) => ({
        updatingBatches: [],
        addBatchUpdate(batch, type) {
          set((state) => {
            const id = "id" in batch ? batch.id : batch.batchID
            const index = state.updatingBatches.findIndex(
              (b) =>
                b.id === id &&
                b.depth === batch.depth &&
                b.amount === batch.amount &&
                b.flag === type,
            )

            if (index === -1) {
              state.updatingBatches.push({
                id,
                depth: batch.depth,
                amount: batch.amount,
                flag: type,
              })
            }
          })
        },
        removeBatchUpdate(batchId) {
          set((state) => {
            state.updatingBatches.splice(
              state.updatingBatches.findIndex((b) => b.id === batchId),
              1,
            )
          })
        },
      })),
      {
        name: "etherna:batches",
        storage: createJSONStorage(() => localStorage),
      },
    ),
    {
      name: "batches",
    },
  ),
)
