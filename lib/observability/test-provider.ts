// In-memory reporter for tests. Records every call so suites can assert
// on what would have been reported without contacting a real vendor.

import type { ErrorReporter, ErrorReporterContext } from "./types";

interface CapturedException {
  err: unknown;
  ctx?: ErrorReporterContext;
}

interface CapturedMessage {
  message: string;
  ctx?: ErrorReporterContext;
}

export class TestErrorReporter implements ErrorReporter {
  readonly providerName = "test";
  readonly exceptions: CapturedException[] = [];
  readonly messages: CapturedMessage[] = [];
  flushed = 0;

  captureException(err: unknown, ctx?: ErrorReporterContext): void {
    this.exceptions.push({ err, ctx });
  }

  captureMessage(message: string, ctx?: ErrorReporterContext): void {
    this.messages.push({ message, ctx });
  }

  async flush(): Promise<boolean> {
    this.flushed += 1;
    return true;
  }

  reset(): void {
    this.exceptions.length = 0;
    this.messages.length = 0;
    this.flushed = 0;
  }
}
