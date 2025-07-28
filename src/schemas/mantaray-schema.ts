import { z } from "zod"

export const MantarayNodeSchema: z.ZodSchema<ReadableMantarayNode> = z.lazy(() => {
  return z.object({
    type: z.number().optional(),
    entry: z.string().optional(),
    contentAddress: z.string().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    forks: z.record(z.string(), MantarayForkSchema),
  })
})

export const MantarayForkSchema = z.object({
  prefix: z.string(),
  node: MantarayNodeSchema,
})

// Types
export type ReadableMantarayNode = {
  type?: number
  entry?: string
  contentAddress?: string
  metadata?: Record<string, string>
  forks: Record<string, MantarayNodeFork>
}
type MantarayNodeFork = z.infer<typeof MantarayForkSchema>
