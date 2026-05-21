/**
 * lib/integrations/excel-mcp/types.ts
 *
 * Provider-neutral tool surface for the Microsoft Graph Excel REST API.
 * Mirrors the layout of `lib/integrations/outlook-mcp/types.ts`. Shared
 * envelopes + result types come from
 * `lib/integrations/microsoft/mcp-common.ts`.
 *
 * Excel-via-Graph is a file-typed surface: every workbook is a driveItem,
 * accessed via `/me/drive/items/{itemId}/workbook/...`. The connected
 * account's OAuth grant carries the same `Files.ReadWrite.All` scope used
 * by OneDrive; nothing Excel-specific exists at the consent layer.
 *
 * Per `feedback_no_silent_vendor_lock.md`: callers never see Microsoft
 * Graph workbook/range/table resources verbatim. The DTOs below are
 * provider-neutral; the translation happens in `./server.ts`.
 *
 * Per `project_no_outbound_architecture.md`: no tool here sends a file or
 * shares anything. Caller composes the data and decides what to do with
 * it; agentplain does not push it anywhere.
 */

import type { McpResult } from '@/lib/integrations/microsoft/mcp-common';

// ── DTOs ────────────────────────────────────────────────────────────────

export interface ListSheetsInput {
  /** Graph `driveItem.id` of the workbook (.xlsx). */
  workbookId: string;
  /** Default `me`; pass a SharePoint drive id for a doc-library workbook. */
  driveId?: string;
}

export interface ListSheetsOutput {
  sheets: SheetDescriptor[];
}

export interface SheetDescriptor {
  id: string;
  name: string;
  position: number;
  visibility: string;
}

export interface ReadRangeInput {
  workbookId: string;
  driveId?: string;
  /** Worksheet name OR id. Graph accepts both via the `sheets('...')` path. */
  sheet: string;
  /** A1-notation range, e.g. `"A1:C10"`. */
  address: string;
  /** When true, return formulas instead of computed values. Defaults false. */
  formulas?: boolean;
}

export interface ReadRangeOutput {
  /** 2-D array of values. Row-major. `null` for blank cells. */
  values: Array<Array<string | number | boolean | null>>;
  /** Optional 2-D array of formulas. Present when `formulas=true`. */
  formulas?: Array<Array<string>>;
  /** Echo of the resolved address (Graph expands relative references). */
  resolvedAddress: string;
  rowCount: number;
  columnCount: number;
}

export interface WriteRangeInput {
  workbookId: string;
  driveId?: string;
  sheet: string;
  address: string;
  /** 2-D array of values to write. Dimensions must match the address. */
  values: Array<Array<string | number | boolean | null>>;
}

export interface WriteRangeOutput {
  resolvedAddress: string;
  cellsWritten: number;
}

export interface ReadTableInput {
  workbookId: string;
  driveId?: string;
  /** Excel structured-table name (e.g. `"Tbl_Clients"`). */
  tableName: string;
  /** Max rows. Defaults to 1000. Graph caps the page at a few hundred KiB;
   *  the server pages transparently. */
  maxRows?: number;
}

export interface ReadTableOutput {
  /** Header row. */
  columns: string[];
  /** Body rows; each row aligns to `columns` positionally. */
  rows: Array<Array<string | number | boolean | null>>;
  totalRows: number;
}

export interface AppendTableRowInput {
  workbookId: string;
  driveId?: string;
  tableName: string;
  /** Single row of values, length equals the table's column count. */
  row: Array<string | number | boolean | null>;
}

export interface AppendTableRowOutput {
  /** A1 address of the newly added row. */
  rowAddress: string;
}

export interface RecalculateWorkbookInput {
  workbookId: string;
  driveId?: string;
  /** `Full` | `FullRebuild` | `Recalculate`. Defaults `Recalculate`. */
  calculationType?: 'Full' | 'FullRebuild' | 'Recalculate';
}

export interface RecalculateWorkbookOutput {
  /** Echo of the calculation type performed. */
  calculationType: string;
}

export interface RunNamedFunctionInput {
  workbookId: string;
  driveId?: string;
  /** A workbook-scoped function name (e.g. `SUM`, `XLOOKUP`, or a custom
   *  named formula). Graph exposes a documented set via
   *  `/workbook/functions/{name}`. */
  functionName: string;
  /** Arguments passed to the function. Strings + numbers + booleans;
   *  ranges as `{ address: "Sheet1!A1:A10" }` placeholders the server
   *  rewrites to Graph's `Range` references. */
  args: Array<string | number | boolean | { address: string }>;
}

export interface RunNamedFunctionOutput {
  /** Graph wraps the result in `{ value, error }`. */
  value: string | number | boolean | null;
  /** Excel-style #ERROR strings when Graph returns one; `null` otherwise. */
  excelError: string | null;
}

// ── MCP resources ──────────────────────────────────────────────────────

export interface ResourceDescriptor {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ReadResourceInput {
  uri: string;
}

export interface ReadResourceOutput {
  uri: string;
  mimeType: string;
  text: string;
}

// ── Tool name discriminant ─────────────────────────────────────────────

export const EXCEL_TOOL_NAMES = [
  'excel.list_sheets',
  'excel.read_range',
  'excel.write_range',
  'excel.read_table',
  'excel.append_table_row',
  'excel.recalculate_workbook',
  'excel.run_named_function',
] as const;

export type ExcelToolName = (typeof EXCEL_TOOL_NAMES)[number];

// ── The interface every implementation honors ──────────────────────────

export interface ExcelMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  listSheets(input: ListSheetsInput): Promise<McpResult<ListSheetsOutput>>;
  readRange(input: ReadRangeInput): Promise<McpResult<ReadRangeOutput>>;
  writeRange(input: WriteRangeInput): Promise<McpResult<WriteRangeOutput>>;
  readTable(input: ReadTableInput): Promise<McpResult<ReadTableOutput>>;
  appendTableRow(
    input: AppendTableRowInput,
  ): Promise<McpResult<AppendTableRowOutput>>;
  recalculateWorkbook(
    input: RecalculateWorkbookInput,
  ): Promise<McpResult<RecalculateWorkbookOutput>>;
  runNamedFunction(
    input: RunNamedFunctionInput,
  ): Promise<McpResult<RunNamedFunctionOutput>>;

  listResources(): Promise<McpResult<ResourceDescriptor[]>>;
  readResource(input: ReadResourceInput): Promise<McpResult<ReadResourceOutput>>;
}
