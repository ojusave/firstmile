/** Single source of truth for the product name. */
export const PRODUCT_NAME = "Calibrate";

/** Lowercase slug used for storage keys, the CLI, and default paths. */
export const PRODUCT_SLUG = "calibrate";

/** Default same-origin path where the browser client posts events. */
export const DEFAULT_ENDPOINT_PATH = `/__${PRODUCT_SLUG}`;

/** Prefix for browser storage keys, namespaced so hosts never collide. */
export const STORAGE_PREFIX = `${PRODUCT_SLUG}:`;
