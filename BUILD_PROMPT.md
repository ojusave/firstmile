# Build: Calibrate

> Product name: Calibrate. npm and GitHub slug: `usecalibrate`.

Build **Calibrate**, an open-source, self-hostable tool for diagnosing onboarding and
funnel flows. Someone installs one package, points it at their app, and Calibrate
auto-detects the fields, pages, and flow, records how people move through it, and sends
that data to a destination they choose. It ships with a self-hosted dashboard UI.

This is an open-source project first. It is NOT tied to any hosting platform. Do not add
Render-specific buttons, signup links, or lock-in. Any host (a laptop, Docker, a VPS,
Fly, Railway, Render, Kubernetes) must be a first-class, equal deploy target.

**North star:** MVP in code style, production-grade in operations. Small, readable,
obvious code. Mature operational posture: clean error handling, fault isolation, a
documented contract, and a five-minute path from install to seeing data.

## The one hard rule: capture structure and behavior, never content

Calibrate auto-instruments the UI but MUST NEVER read what a user types, pastes, or the
text content of the DOM. This is the core identity of the product and a privacy guarantee.

Calibrate MAY capture:
- that a field exists, its stable name/id, and its type (e.g. email, password, select)
- field interaction: focused, filled, left blank, blurred, validation error (as a bounded
  machine code), attempt count
- page/route changes and the order and timing between them
- an inferred onboarding flow (the observed sequence of steps)
- lifecycle: session start/resume, visibility, page hide, flow completion ("shipped")
- copy/paste as artifact NAMES and accept/reject booleans, never the copied/pasted value

Calibrate MUST NOT capture:
- field values, input contents, textarea contents, clipboard contents
- DOM text, innerText, or arbitrary attributes
- full URLs, query strings, or hash fragments (only mapped/known route identifiers)

Enforce these constraints at ingestion, not just in the client. The server validates and
drops anything outside the allowed, bounded schema. Identifiers are length-bounded and
validated. Reject events with arbitrary fields.

## Stack (proposed; justify or override with one line each)
- Language: TypeScript. One shared contract across browser SDK and collector.
- Runtime: Node.js 20+ for the collector. ESM-only.
- Web framework: Express for the collector (native res.write for any streaming, mature
  middleware). Consider Hono only if a reason appears.
- Storage: SQLite as the zero-config default; Postgres for scale. Both behind one port.
- Validation: a small hand-rolled validator or zod for the event schema. Pick one, justify.
- Frontend (dashboard): keep it minimal. Vanilla or a light framework served by the
  collector. No heavy SPA unless justified.
- Testing/lint/format: the ecosystem standard (vitest, eslint, prettier).

## Distribution (this IS the adoption path)
- `npm install usecalibrate` for the browser/client SDK (ESM, no host assumptions).
- A CDN-served IIFE/ESM build so a plain HTML page can add Calibrate with one `<script>`.
- `npx calibrate-sidecar` to run the collector locally with zero config (SQLite file).
- A Docker image (`docker run usecalibrate/collector`) for containerized hosts.
- The collector binds `0.0.0.0:$PORT`, reads all config from env vars or a config file,
  and has NO dependency on any single hosting provider.

## The event contract is the real product
- Define a public, versioned JSON event schema and a single ingest endpoint
  (`POST /api/events`) that any platform can call.
- Document it as the primary surface. The browser SDK is the reference implementation of
  this contract, not the product itself.
- A future Python/native client is just another producer of this contract. Design the
  contract so non-browser clients can participate without hacks.

## Architecture (ports and adapters, but do not overengineer)
Put a port ONLY where implementations genuinely differ:
- `Store` port: persist and query sessions/events. Adapters: SQLite (default), Postgres.
- `Destination` port: where data goes. Adapters: local store (default), webhook/HTTP,
  stdout/JSONL. Leave S3/warehouse/queue/forward-to-other-analytics as community adapters.
- Optional `Identity` seam: anonymous per-client by default (a stable local id, no PII).
  Expose an `identify()` hook so adopters WITH consent can stitch a person across sessions.
  Do not build cross-device identity into the core.
Everything else (autocapture engine, flow inference, reducer, dashboard) is plain code.
Do not wrap two-line helpers in ports.

## Fault isolation
- Instrumentation NEVER throws into the host app. All SDK operations are wrapped; failures
  are swallowed (with an optional debug warning). A broken Calibrate must not break the app.
- The collector degrades gracefully: a failing destination is logged, retried with backoff,
  and never takes down ingestion.
- Timeouts on every network call. Bounded queues, batching, and retry with a cap in the SDK.

## The UI
A self-hosted dashboard served by the collector: funnels with drop-off per step, inferred
flows, live sessions/presence, and a data export. Clean and obvious. No decorative
complexity. Every view has explicit loading, empty, and error states.

## Code quality
- Strong typing. Lint/format on save. Enforce module boundaries so features import only
  through published entry points.
- Short doc comment on every public function (what, not how).
- Derive the product name from a single source of truth (one constant or the package.json
  name). Never hardcode the name inline in the
  package id, CDN identifier, localStorage prefix, default endpoint path, CLI command, or
  UI title.
- Tests for: the event contract validator, each Store and Destination adapter against its
  port, the flow-inference logic, and fault behavior (simulate a failing destination and
  assert ingestion still works).

## License
Apache-2.0. Include LICENSE and a clear README with a one-command quick start, the privacy
guarantee stated plainly, the event contract, and deploy recipes for Docker and a couple of
common hosts as equals.

## How to work
1. Before writing code, output: (a) final stack with one-line justifications, (b) folder
   and key-file layout, (c) the event contract (schema + endpoints), (d) the port/adapter
   list with fallback behavior, (e) the one-command install and run story. Get approval.
2. Build module by module. After each, list what was added, what is left, and any decisions.
3. Flag ambiguity instead of assuming. Do not add limits (rate caps, allowlists) unless
   asked or there is a clear safety/privacy reason. Never capture content to make a feature
   easier.
