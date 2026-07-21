import { CONTRACT_VERSION, type CalibrateEvent } from "@usecalibrate/contract";

let clock = 1_700_000_000_000;

/** Builds a valid event with a monotonic timestamp for tests. */
export function event(
  sessionId: string,
  seq: number,
  payload: Record<string, unknown>,
): CalibrateEvent {
  clock += 1_000;
  return {
    v: CONTRACT_VERSION,
    app: "test",
    sessionId,
    seq,
    ts: clock,
    ...payload,
  } as CalibrateEvent;
}
