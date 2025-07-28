import { z } from "zod"

import { dateToTimestamp, timestampToDate } from "../utils"
import { EmptyReference } from "@/consts"

import type { EnsAddress, EthAddress } from "@/types/eth"
import type { BatchId, Reference } from "@/types/swarm"

export const SchemaVersionSchema = z.literal(`${z.string()}.${z.string()}`)

export const BirthdaySchema = z
  .string()
  .regex(/^[0-9]{2}-[0-9]{2}(-[0-9]{4})?$/, "must be a valid birthday: '<day>-<month>[-<year>]'")
  .refine(
    (val) => {
      const [day, month, year] = val.split("-")
      return (
        z.coerce.number().min(1).max(31).parse(day) &&
        z.coerce.number().min(1).max(12).parse(month) &&
        z.coerce.number().min(1900).optional().parse(year)
      )
    },
    {
      message: "must be a valid birthday: '<day>-<month>[-<year>]' (eg: '12-05', '12-05-1991')",
    },
  )

export const SlicedStringSchema = (max: number, min?: number) =>
  z
    .string()
    .min(min ?? 0)
    .transform((v) => v.slice(0, max))

export const EthAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, {
    message: "must be a valid ethereum address",
  })
  .transform((v) => v as EthAddress)

export const EnsAddressSchema = z
  .string()
  .regex(/^[a-z0-9_\-\.]+\.eth$/i, {
    message: "must be a valid ENS name",
  })
  .transform((v) => v as EnsAddress)

export const EthSafeAddressSchema = z.string().transform((v) => {
  if (EthAddressSchema.safeParse(v).success) return v.toLowerCase()
  return "0x" + "0".repeat(40)
})

export const BeeReferenceSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/, {
    message: "must be a valid bee reference",
  })
  .transform((v) => v as Reference)

export const BeeSafeReferenceSchema = z
  .string()
  .nullable()
  .transform((v) => {
    const result = BeeReferenceSchema.safeParse(v)
    return result.success ? result.data : EmptyReference
  })

export const BatchIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/, {
    message: "must be a valid batch id",
  })
  .transform((v) => v as BatchId)

export const NonEmptyRecordSchema = <
  Keys extends z.core.$ZodRecordKey,
  Values extends z.core.$ZodType,
>(
  key: Keys,
  value: Values,
): z.ZodRecord<Keys, Values> =>
  z.record(key, value).refine((val) => Object.keys(val).length > 0, {
    error: "must not be empty",
  })

export const TimestampSchema = z
  .number()
  .min(0)
  .transform((val) => {
    return dateToTimestamp(timestampToDate(val))
  })
  .or(
    z.string().transform((val) => {
      return dateToTimestamp(new Date(val))
    }),
  )
// Types
export type SchemaVersion = z.infer<typeof SchemaVersionSchema>
