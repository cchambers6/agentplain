// Structured logging — portable, swappable, JSON-emitting.
//
// Why a wrapper instead of console.* everywhere: the cron + webhook paths
// produce machine-readable lines (Vercel + Datadog + GCP Logs all parse
// JSON cleanly), and we want a single place to add request/cron context
// without touching every call site. The wrapper also keeps us off any
// specific log vendor — same discipline as lib/observability/index.ts
// (feedback_no_silent_vendor_lock + project_living_portable_architecture).
//
// Output shape (one JSON object per line, stdout/stderr per level):
//   {"level":"info","msg":"...","time":"2026-05-24T19:00:00.000Z",
//    "service":"agentplain","env":"production","ctx":{"function_id":"..."}}
//
// Level mapping: debug → stdout, info → stdout, warn → stderr, error → stderr.
// Errors get the error name/message/stack flattened into the record so a
// log-search query finds them without a JSON parse.
//
// Composition with the error reporter: the logger does NOT call
// reportError() itself — that's the caller's choice (most error paths
// already wrap with withInngestErrorReporting). Otherwise we'd double-
// report every error.

import { env } from "../env";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  /** Free-form structured fields. Strings, numbers, booleans, plain objects. */
  [key: string]: unknown;
}

export interface Logger {
  debug(msg: string, ctx?: LogContext): void;
  info(msg: string, ctx?: LogContext): void;
  warn(msg: string, ctx?: LogContext): void;
  error(msg: string, errOrCtx?: unknown, ctx?: LogContext): void;
  /** Returns a new logger whose context is merged into every emitted record. */
  child(ctx: LogContext): Logger;
}

interface LoggerConfig {
  service: string;
  environment: string;
  baseContext: LogContext;
  /** Writer seam — defaults to console.log/console.error. Tests inject a recorder. */
  write: (level: LogLevel, payload: Record<string, unknown>) => void;
}

const defaultWriter = (
  level: LogLevel,
  payload: Record<string, unknown>,
): void => {
  // One line per record. Use console.error for warn/error so Vercel + most
  // hosts capture them on the stderr stream (separate from info logs).
  const line = JSON.stringify(payload);
  if (level === "warn" || level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
};

function flattenError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      error_name: err.name,
      error_message: err.message,
      // Stack is multi-line; keep it for prod debugging but cap at 4KB so
      // a runaway frame doesn't blow up the log shipper.
      error_stack: err.stack?.slice(0, 4096) ?? null,
    };
  }
  if (typeof err === "string") {
    return { error_message: err };
  }
  return { error_value: err };
}

class JsonLogger implements Logger {
  constructor(private readonly cfg: LoggerConfig) {}

  private emit(level: LogLevel, msg: string, ctx?: LogContext): void {
    const payload: Record<string, unknown> = {
      level,
      msg,
      time: new Date().toISOString(),
      service: this.cfg.service,
      env: this.cfg.environment,
    };
    // Merge base + per-call context under "ctx" so the searchable surface
    // stays predictable. Flat keys at the top stay reserved for log fields.
    const merged: LogContext = { ...this.cfg.baseContext, ...(ctx ?? {}) };
    if (Object.keys(merged).length > 0) {
      payload.ctx = merged;
    }
    this.cfg.write(level, payload);
  }

  debug(msg: string, ctx?: LogContext): void {
    this.emit("debug", msg, ctx);
  }

  info(msg: string, ctx?: LogContext): void {
    this.emit("info", msg, ctx);
  }

  warn(msg: string, ctx?: LogContext): void {
    this.emit("warn", msg, ctx);
  }

  error(msg: string, errOrCtx?: unknown, ctx?: LogContext): void {
    // Two call shapes: error(msg, err) and error(msg, ctx) and
    // error(msg, err, ctx). When the second arg is a plain object we treat
    // it as context; otherwise we flatten it into error_* fields.
    let merged: LogContext = {};
    if (errOrCtx !== undefined && errOrCtx !== null) {
      if (
        errOrCtx instanceof Error ||
        typeof errOrCtx === "string" ||
        (typeof errOrCtx === "object" &&
          "stack" in (errOrCtx as Record<string, unknown>))
      ) {
        merged = { ...merged, ...flattenError(errOrCtx) };
      } else if (typeof errOrCtx === "object") {
        merged = { ...merged, ...(errOrCtx as LogContext) };
      } else {
        merged = { ...merged, error_value: errOrCtx };
      }
    }
    if (ctx) merged = { ...merged, ...ctx };
    this.emit("error", msg, merged);
  }

  child(ctx: LogContext): Logger {
    return new JsonLogger({
      ...this.cfg,
      baseContext: { ...this.cfg.baseContext, ...ctx },
    });
  }
}

let cachedRoot: Logger | null = null;
let cachedWriter: LoggerConfig["write"] = defaultWriter;

/** Root logger. Lazily built so env() runs at first call, not at import. */
export function getLogger(): Logger {
  if (cachedRoot) return cachedRoot;
  cachedRoot = new JsonLogger({
    service: "agentplain",
    environment: env.sentryEnvironment(),
    baseContext: {},
    write: cachedWriter,
  });
  return cachedRoot;
}

/**
 * Test seam: swap the writer + reset the cached root. Pass null to restore
 * the default console writer.
 */
export function __setLoggerWriterForTests(
  writer: LoggerConfig["write"] | null,
): void {
  cachedWriter = writer ?? defaultWriter;
  cachedRoot = null;
}
