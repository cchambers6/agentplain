/**
 * lib/dewpoint/types.ts
 *
 * Request/response contracts for the dew-point feature. Kept separate from
 * the fetch and derive logic so the API route and the UI can share one
 * source of truth for shapes.
 */

import { z } from "zod";

/** Query accepted by GET /api/dewpoint. Either a place name or lat/lon. */
export const dewpointQuerySchema = z
  .object({
    /** Free-text place name, e.g. "Denver" or "Paris, France". */
    q: z.string().trim().min(1).max(120).optional(),
    /** Latitude, if the caller already has coordinates. */
    lat: z.coerce.number().min(-90).max(90).optional(),
    /** Longitude, if the caller already has coordinates. */
    lon: z.coerce.number().min(-180).max(180).optional(),
    /** How many days to forecast (1–7). Defaults to 3. */
    days: z.coerce.number().int().min(1).max(7).optional(),
  })
  .refine((v) => Boolean(v.q) || (v.lat !== undefined && v.lon !== undefined), {
    message: "Provide either `q` (place name) or both `lat` and `lon`.",
  });

export type DewpointQuery = z.infer<typeof dewpointQuerySchema>;

/** A resolved place the forecast is anchored to. */
export interface ResolvedLocation {
  name: string;
  latitude: number;
  longitude: number;
  /** IANA timezone the hourly times are expressed in, e.g. "America/Denver". */
  timezone: string;
  country?: string;
  admin1?: string;
}
