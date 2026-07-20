export {
  PRODUCT_NAME,
  PRODUCT_SLUG,
  DEFAULT_ENDPOINT_PATH,
  STORAGE_PREFIX,
} from "./name.js";
export { CONTRACT_VERSION } from "./version.js";
export {
  IDENTIFIER_MAX_LENGTH,
  CODE_MAX_LENGTH,
  identifier,
  isIdentifier,
} from "./identifier.js";
export {
  eventSchema,
  eventBatchSchema,
  parseEvent,
  parseEventBatch,
  type FirstmileEvent,
  type EventType,
} from "./schema.js";
