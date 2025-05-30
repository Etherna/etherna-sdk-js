import { z } from "zod/v4"

export const MantarayNodeSchema: z.ZodSchema<MantarayNode> = z.lazy(() =>
  z.object({
    type: z.number(),
    entry: z.string().optional(),
    contentAddress: z.string().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    forks: z.record(z.string(), MantarayForkSchema),
  }),
)

export const MantarayForkSchema = z.object({
  prefix: z.string(),
  node: MantarayNodeSchema,
})

// Types
export type MantarayNode = {
  type: number
  entry?: string
  contentAddress?: string
  metadata?: Record<string, string>
  forks: Record<string, MantarayFork>
}
export type MantarayFork = z.infer<typeof MantarayForkSchema>
