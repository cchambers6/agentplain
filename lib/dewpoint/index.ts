/**
 * lib/dewpoint/index.ts
 *
 * Public surface of the dew-point feature. The API route and UI import from
 * here rather than reaching into individual files.
 */

export * from "./types";
export * from "./derive";
export {
  DewpointError,
  geocode,
  fetchDewpointForecast,
  findDewpointForecast,
  type DewpointForecast,
} from "./client";
