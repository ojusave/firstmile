import { z } from "zod";
import { CODE_MAX_LENGTH, identifier } from "./identifier.js";

const id = identifier();
const code = identifier(CODE_MAX_LENGTH);
const epochMs = z.number().int().nonnegative();

/**
 * Fields present on every event. `sessionId` is an opaque, client-generated id with no
 * PII. `app` names the instrumented surface. `seq` is monotonic per session so the
 * collector can dedupe and order without trusting wall-clock time.
 */
const envelope = {
  v: z.number().int().positive(),
  app: id,
  sessionId: id,
  seq: z.number().int().nonnegative(),
  ts: epochMs,
  /**
   * Optional caller-supplied opaque id. Anonymous by default; only present when the host
   * calls identify() with consent. Bounded like any identifier so it cannot carry prose.
   */
  user: id.optional(),
};

const nav = z.enum(["forward", "back"]);

/**
 * The closed event vocabulary. Every member is `.strict()`, so any unexpected field
 * fails validation and is dropped at ingestion. Adding a field means adding it here on
 * purpose, which keeps the privacy guarantee auditable in one place.
 */
export const eventSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...envelope,
      type: z.literal("session_start"),
      resumed: z.boolean().optional(),
      awayMs: z.number().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal("page"),
      route: id,
      nav,
      from: id.optional(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal("field"),
      name: id,
      fieldType: id,
      action: z.enum(["focus", "fill", "blank", "blur", "error"]),
      code: code.optional(),
      attempt: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal("flow_step"),
      step: id,
      group: id.optional(),
      index: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ ...envelope, type: z.literal("copy"), artifact: id }).strict(),
  z
    .object({ ...envelope, type: z.literal("paste"), step: id, ok: z.boolean() })
    .strict(),
  z
    .object({ ...envelope, type: z.literal("heartbeat"), visible: z.boolean() })
    .strict(),
  z
    .object({ ...envelope, type: z.literal("shipped"), totalMs: z.number().nonnegative() })
    .strict(),
  z.object({ ...envelope, type: z.literal("bye"), persisted: z.boolean() }).strict(),
]);

export const eventBatchSchema = z.object({ events: z.array(z.unknown()) });

export type CalibrateEvent = z.infer<typeof eventSchema>;
export type EventType = CalibrateEvent["type"];

/** Validates a single event, throwing a ZodError on any violation. */
export function parseEvent(value: unknown): CalibrateEvent {
  return eventSchema.parse(value);
}

/**
 * Validates a batch and returns only the well-formed events. Invalid siblings are
 * dropped rather than failing the whole batch, so one bad event never costs the rest.
 * Accepts either a bare array or `{ events: [] }`.
 */
export function parseEventBatch(value: unknown): CalibrateEvent[] {
  const candidates = Array.isArray(value)
    ? value
    : eventBatchSchema.safeParse(value).success
      ? (value as { events: unknown[] }).events
      : null;
  if (candidates === null) {
    throw new Error("request body must be an event array or { events: [] }");
  }
  const valid: CalibrateEvent[] = [];
  for (const candidate of candidates) {
    const result = eventSchema.safeParse(candidate);
    if (result.success) valid.push(result.data);
  }
  return valid;
}
