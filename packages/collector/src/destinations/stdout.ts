import type { CalibrateEvent } from "@usecalibrate/contract";
import type { Destination } from "./port.js";

/** Writes one JSON line per event to stdout. Handy for piping into any external tool. */
export class StdoutDestination implements Destination {
  readonly name = "stdout";

  async deliver(events: readonly CalibrateEvent[]): Promise<void> {
    for (const event of events) {
      process.stdout.write(`${JSON.stringify(event)}\n`);
    }
  }
}
