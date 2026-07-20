/**
 * Runtime constants with no validation dependencies. Browser clients import these so the
 * schema (and zod) never ends up in a client bundle.
 */
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
  isIdentifier,
} from "./identifier-core.js";
