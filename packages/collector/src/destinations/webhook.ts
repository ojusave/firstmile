import type { CalibrateEvent } from "@usecalibrate/contract";
import type { Destination } from "./port.js";

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const TIMEOUT_MS = 5_000;

/**
 * Forwards batches to an external HTTP endpoint with a timeout and capped exponential
 * backoff. After the last attempt it logs and drops: a broken webhook must never wedge
 * ingestion.
 */
export class WebhookDestination implements Destination {
  readonly name = "webhook";
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  async deliver(events: readonly CalibrateEvent[]): Promise<void> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const response = await fetch(this.url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ events }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`webhook responded ${response.status}`);
          return;
        } finally {
          clearTimeout(timer);
        }
      } catch (error) {
        if (attempt === MAX_ATTEMPTS) {
          const message = error instanceof Error ? error.message : "unknown error";
          console.warn(`[calibrate] webhook delivery failed after ${attempt} attempts: ${message}`);
          return;
        }
        await delay(BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
