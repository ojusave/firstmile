import { DEFAULT_ENDPOINT_PATH, isIdentifier } from "@firstmile/contract/meta";
import type { FirstmileController, FirstmileOptions } from "./config.js";
import { observeFields } from "./fields.js";
import { observeRoutes } from "./route.js";
import { Transport } from "./transport.js";

export type { FirstmileController, FirstmileOptions } from "./config.js";
export { routeId } from "./route.js";

let activeDestroy: (() => void) | undefined;

/**
 * Starts a Firstmile client. With autocapture on (the default) it detects pages, an
 * inferred flow, and field interactions and streams them to the collector. It never reads
 * field values or DOM text. Starting a second client replaces the first on the page.
 */
export function firstmile(options: FirstmileOptions = {}): FirstmileController {
  activeDestroy?.();

  const app = isIdentifier(options.app ?? "default") ? (options.app ?? "default") : "default";
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT_PATH;
  const debug = options.debug === true;
  const autocapture = options.autocapture !== false;

  const transport = new Transport({ endpoint, app, debug });
  const stops: Array<() => void> = [];
  let live = true;

  const teardown = (): void => {
    if (!live) return;
    live = false;
    for (const stop of stops.splice(0)) {
      try {
        stop();
      } catch {
        // Best effort.
      }
    }
    transport.destroy();
    if (activeDestroy === teardown) activeDestroy = undefined;
  };
  activeDestroy = teardown;

  const ready = (async (): Promise<void> => {
    try {
      transport.start();
      if (autocapture) startAutocapture(transport, stops);
    } catch {
      teardown();
    }
  })();

  return {
    ready,
    page: (route, nav, from) => {
      if (!isIdentifier(route)) return;
      transport.emit(
        {
          type: "page",
          route,
          nav: nav ?? "forward",
          ...(from !== undefined && isIdentifier(from) ? { from } : {}),
        },
        true,
      );
    },
    field: (name, fieldType, action, extra) => {
      if (!isIdentifier(name) || !isIdentifier(fieldType)) return;
      transport.emit({
        type: "field",
        name,
        fieldType,
        action,
        ...(extra?.code !== undefined && isIdentifier(extra.code) ? { code: extra.code } : {}),
        ...(extra?.attempt !== undefined ? { attempt: extra.attempt } : {}),
      });
    },
    copy: (artifact) => {
      if (isIdentifier(artifact)) transport.emit({ type: "copy", artifact });
    },
    paste: (step, ok) => {
      if (isIdentifier(step)) transport.emit({ type: "paste", step, ok });
    },
    shipped: () => transport.emit({ type: "shipped", totalMs: transport.elapsedTotalMs }, true),
    identify: (user) => transport.setUser(user),
    destroy: teardown,
  };
}

/** Wires the route and field observers into transport events, including flow inference. */
function startAutocapture(transport: Transport, stops: Array<() => void>): void {
  const order = new Map<string, number>();
  let previous: string | undefined;

  stops.push(
    observeRoutes((route) => {
      const knownIndex = order.get(route);
      const prevIndex = previous === undefined ? -1 : (order.get(previous) ?? -1);
      const nav = knownIndex !== undefined && knownIndex < prevIndex ? "back" : "forward";
      transport.emit(
        {
          type: "page",
          route,
          nav,
          ...(previous !== undefined ? { from: previous } : {}),
        },
        true,
      );
      if (knownIndex === undefined) {
        const index = order.size;
        order.set(route, index);
        transport.emit({ type: "flow_step", step: route, index });
      }
      previous = route;
    }),
  );

  stops.push(
    observeFields((signal) => {
      transport.emit({
        type: "field",
        name: signal.name,
        fieldType: signal.fieldType,
        action: signal.action,
        ...(signal.attempt !== undefined ? { attempt: signal.attempt } : {}),
      });
    }),
  );
}
