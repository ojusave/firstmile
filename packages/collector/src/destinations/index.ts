import type { FirstmileEvent } from "@firstmile/contract";
import type { Destination } from "./port.js";
import { StdoutDestination } from "./stdout.js";
import { WebhookDestination } from "./webhook.js";

export type { Destination } from "./port.js";
export { StdoutDestination } from "./stdout.js";
export { WebhookDestination } from "./webhook.js";

export interface DestinationConfig {
  stdout?: boolean;
  webhookUrl?: string;
}

/** Builds the enabled destinations from config. The primary store is always the sink of record. */
export function createDestinations(config: DestinationConfig): Destination[] {
  const destinations: Destination[] = [];
  if (config.stdout === true) destinations.push(new StdoutDestination());
  if (config.webhookUrl !== undefined) destinations.push(new WebhookDestination(config.webhookUrl));
  return destinations;
}

/**
 * Delivers to every destination independently. One failure is isolated so it cannot
 * affect the others or the ingest response.
 */
export async function fanOut(
  destinations: readonly Destination[],
  events: readonly FirstmileEvent[],
): Promise<void> {
  if (destinations.length === 0 || events.length === 0) return;
  await Promise.all(
    destinations.map(async (destination) => {
      try {
        await destination.deliver(events);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        console.warn(`[firstmile] destination "${destination.name}" failed: ${message}`);
      }
    }),
  );
}
