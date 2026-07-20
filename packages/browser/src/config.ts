/** Options for starting the browser client. Every field has a safe default. */
export interface FirstmileOptions {
  /** Identifier naming the instrumented surface. Defaults to "default". */
  app?: string;
  /** Collector base URL. Defaults to the same-origin collector path. */
  endpoint?: string;
  /** Auto-detect pages and fields. Defaults to true. Set false for manual-only use. */
  autocapture?: boolean;
  /** Log configuration problems to the console. Defaults to false. */
  debug?: boolean;
}

/** The controller returned by firstmile(). Manual methods work with or without autocapture. */
export interface FirstmileController {
  readonly ready: Promise<void>;
  /** Records a position in the flow by route id. */
  page(route: string, nav?: "forward" | "back", from?: string): void;
  /** Records a field interaction. Never records the field value. */
  field(
    name: string,
    fieldType: string,
    action: "focus" | "fill" | "blank" | "blur" | "error",
    extra?: { code?: string; attempt?: number },
  ): void;
  /** Records copying a named artifact, never its content. */
  copy(artifact: string): void;
  /** Records whether a paste was accepted, never its content. */
  paste(step: string, ok: boolean): void;
  /** Records completion of the whole flow. */
  shipped(): void;
  /** Attaches an opaque, consented user id to subsequent events. */
  identify(user: string): void;
  /** Stops this client without clearing its persisted session. */
  destroy(): void;
}
