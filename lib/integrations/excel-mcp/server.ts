/**
 * lib/integrations/excel-mcp/server.ts
 *
 * Production Excel MCP server. Wraps Microsoft Graph's Excel REST surface
 * behind the `ExcelMcpServer` interface in `./types.ts`. One instance per
 * `{workspaceId}` per request.
 *
 * Per `feedback_no_silent_vendor_lock.md`: every Graph hit goes through
 * `lib/integrations/microsoft/graph-client.ts`. Skill code consumes the
 * MCP interface only.
 *
 * Per `feedback_cold_start_safe_agents.md`: each method re-resolves the
 * credential. No decrypted token is memoised on the instance.
 *
 * Microsoft Graph endpoints used (read 2026-05-19):
 *   * `/me/drive/items/{wb}/workbook/worksheets`                          — list sheets
 *   * `/me/drive/items/{wb}/workbook/worksheets('{sheet}')/range(address='A1:C10')` — read
 *   * PATCH same URL with `{ values: [[…]] }`                             — write
 *   * `/me/drive/items/{wb}/workbook/tables/{name}/range`                  — table read
 *   * `/me/drive/items/{wb}/workbook/tables/{name}/rows/add`               — table append
 *   * `/me/drive/items/{wb}/workbook/application/calculate`                — recalc
 *   * `/me/drive/items/{wb}/workbook/functions/{fn}` (POST with args)      — function
 *
 * Excel-via-Graph requires the `Workbook-Session-Id` header (optional but
 * recommended) for repeated calls against the same workbook to share the
 * server's calc state. We open a persistent session per-call when we know
 * we'll do >1 hit, then close it on the way out.
 */

import { resolveCredential } from './auth';
import { MicrosoftGraphClient } from '@/lib/integrations/microsoft/graph-client';
import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/microsoft/mcp-common';
import type { DecryptedCredential } from '@/lib/integrations/types';
import {
  type AppendTableRowInput,
  type AppendTableRowOutput,
  type ExcelMcpServer,
  type ListSheetsInput,
  type ListSheetsOutput,
  type ReadRangeInput,
  type ReadRangeOutput,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ReadTableInput,
  type ReadTableOutput,
  type RecalculateWorkbookInput,
  type RecalculateWorkbookOutput,
  type ResourceDescriptor,
  type RunNamedFunctionInput,
  type RunNamedFunctionOutput,
  type SheetDescriptor,
  type WriteRangeInput,
  type WriteRangeOutput,
} from './types';

interface GraphListResponse<T> {
  value?: T[];
}

interface GraphWorksheet {
  id?: string;
  name?: string;
  position?: number;
  visibility?: string;
}

interface GraphRange {
  address?: string;
  values?: Array<Array<string | number | boolean | null>>;
  formulas?: Array<Array<string>>;
  rowCount?: number;
  columnCount?: number;
}

interface GraphTableRow {
  index?: number;
  values?: Array<Array<string | number | boolean | null>>;
}

interface GraphFunctionResult {
  value?: string | number | boolean | null;
  error?: string | null;
}

export class ProdExcelMcpServer implements ExcelMcpServer {
  readonly name = 'excel-graph' as const;
  readonly workspaceId: string;
  private readonly graph: MicrosoftGraphClient;

  constructor(args: { workspaceId: string; fetchImpl?: typeof fetch }) {
    if (!args.workspaceId) {
      throw new Error('ProdExcelMcpServer: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
    this.graph = new MicrosoftGraphClient({ fetchImpl: args.fetchImpl });
  }

  async listSheets(input: ListSheetsInput): Promise<McpResult<ListSheetsOutput>> {
    if (!input.workbookId) {
      return mcpError('INVALID_ARGUMENT', 'listSheets requires workbookId');
    }
    return this.withCredential(async (cred) => {
      const url = this.graph.url(
        `${workbookSegment(input.driveId, input.workbookId)}/worksheets`,
      );
      const res = await this.graph.get<GraphListResponse<GraphWorksheet>>(cred, url);
      if (!res.ok) return res;
      const sheets: SheetDescriptor[] = (res.value.value ?? []).map((w) => ({
        id: w.id ?? '',
        name: w.name ?? '',
        position: typeof w.position === 'number' ? w.position : 0,
        visibility: w.visibility ?? 'Visible',
      }));
      return mcpOk({ sheets });
    });
  }

  async readRange(input: ReadRangeInput): Promise<McpResult<ReadRangeOutput>> {
    const validation = validateRangeInputs(input);
    if (!validation.ok) return validation;
    return this.withCredential(async (cred) => {
      const url = this.graph.url(
        `${workbookSegment(input.driveId, input.workbookId)}/worksheets('${encodeURIComponent(input.sheet)}')/range(address='${encodeURIComponent(input.address)}')`,
      );
      const res = await this.graph.get<GraphRange>(cred, url);
      if (!res.ok) return res;
      const r = res.value;
      const values = r.values ?? [];
      return mcpOk({
        values,
        formulas: input.formulas === true ? r.formulas : undefined,
        resolvedAddress: r.address ?? input.address,
        rowCount: typeof r.rowCount === 'number' ? r.rowCount : values.length,
        columnCount:
          typeof r.columnCount === 'number'
            ? r.columnCount
            : values[0]?.length ?? 0,
      });
    });
  }

  async writeRange(
    input: WriteRangeInput,
  ): Promise<McpResult<WriteRangeOutput>> {
    const validation = validateRangeInputs(input);
    if (!validation.ok) return validation;
    if (!Array.isArray(input.values) || input.values.length === 0) {
      return mcpError('INVALID_ARGUMENT', 'writeRange requires a non-empty 2-D values array');
    }
    return this.withCredential(async (cred) => {
      const url = this.graph.url(
        `${workbookSegment(input.driveId, input.workbookId)}/worksheets('${encodeURIComponent(input.sheet)}')/range(address='${encodeURIComponent(input.address)}')`,
      );
      const res = await this.graph.request<GraphRange>(cred, url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: input.values }),
      });
      if (!res.ok) return res;
      const cellsWritten = input.values.reduce(
        (acc, row) => acc + (Array.isArray(row) ? row.length : 0),
        0,
      );
      return mcpOk({
        resolvedAddress: res.value.address ?? input.address,
        cellsWritten,
      });
    });
  }

  async readTable(input: ReadTableInput): Promise<McpResult<ReadTableOutput>> {
    if (!input.workbookId) {
      return mcpError('INVALID_ARGUMENT', 'readTable requires workbookId');
    }
    if (!input.tableName) {
      return mcpError('INVALID_ARGUMENT', 'readTable requires tableName');
    }
    return this.withCredential(async (cred) => {
      // Pull the column headers first, then the rows. Two round-trips but
      // both responses are small and the table headers are stable enough
      // to read separately.
      const tablePath = `${workbookSegment(input.driveId, input.workbookId)}/tables('${encodeURIComponent(input.tableName)}')`;
      const headerRes = await this.graph.get<{ value?: Array<{ name?: string }> }>(
        cred,
        this.graph.url(`${tablePath}/columns?$select=name`),
      );
      if (!headerRes.ok) return headerRes;
      const columns = (headerRes.value.value ?? []).map((c) => c.name ?? '');
      const rangeRes = await this.graph.get<GraphRange>(
        cred,
        this.graph.url(`${tablePath}/dataBodyRange`),
      );
      if (!rangeRes.ok) {
        // Empty table → Graph returns 404 on dataBodyRange. Treat as zero
        // rows rather than propagating NOT_FOUND.
        if (rangeRes.error.code === 'NOT_FOUND') {
          return mcpOk({ columns, rows: [], totalRows: 0 });
        }
        return rangeRes;
      }
      const allRows = rangeRes.value.values ?? [];
      const maxRows = input.maxRows ?? 1000;
      const sliced = allRows.slice(0, maxRows);
      return mcpOk({
        columns,
        rows: sliced,
        totalRows: allRows.length,
      });
    });
  }

  async appendTableRow(
    input: AppendTableRowInput,
  ): Promise<McpResult<AppendTableRowOutput>> {
    if (!input.workbookId) {
      return mcpError('INVALID_ARGUMENT', 'appendTableRow requires workbookId');
    }
    if (!input.tableName) {
      return mcpError('INVALID_ARGUMENT', 'appendTableRow requires tableName');
    }
    if (!Array.isArray(input.row) || input.row.length === 0) {
      return mcpError('INVALID_ARGUMENT', 'appendTableRow requires a non-empty row array');
    }
    return this.withCredential(async (cred) => {
      const url = this.graph.url(
        `${workbookSegment(input.driveId, input.workbookId)}/tables('${encodeURIComponent(input.tableName)}')/rows/add`,
      );
      const res = await this.graph.request<GraphTableRow>(cred, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Graph expects a 2-D array even for a single row.
        body: JSON.stringify({ values: [input.row], index: null }),
      });
      if (!res.ok) return res;
      const idx = typeof res.value.index === 'number' ? res.value.index : 0;
      return mcpOk({ rowAddress: `row#${idx}` });
    });
  }

  async recalculateWorkbook(
    input: RecalculateWorkbookInput,
  ): Promise<McpResult<RecalculateWorkbookOutput>> {
    if (!input.workbookId) {
      return mcpError('INVALID_ARGUMENT', 'recalculateWorkbook requires workbookId');
    }
    const calculationType = input.calculationType ?? 'Recalculate';
    return this.withCredential(async (cred) => {
      const url = this.graph.url(
        `${workbookSegment(input.driveId, input.workbookId)}/application/calculate`,
      );
      const res = await this.graph.request<unknown>(cred, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calculationType }),
      });
      if (!res.ok) return res;
      return mcpOk({ calculationType });
    });
  }

  async runNamedFunction(
    input: RunNamedFunctionInput,
  ): Promise<McpResult<RunNamedFunctionOutput>> {
    if (!input.workbookId) {
      return mcpError('INVALID_ARGUMENT', 'runNamedFunction requires workbookId');
    }
    if (!input.functionName) {
      return mcpError('INVALID_ARGUMENT', 'runNamedFunction requires functionName');
    }
    return this.withCredential(async (cred) => {
      const url = this.graph.url(
        `${workbookSegment(input.driveId, input.workbookId)}/functions/${encodeURIComponent(input.functionName)}`,
      );
      // Graph's function endpoints accept a JSON body with named parameters,
      // but they vary per function. The portable shape is a positional
      // `values` array, which Graph accepts for many of the documented
      // functions (`SUM`, `AVERAGE`, `XLOOKUP`, etc.). Callers requiring
      // named-parameter functions can extend this surface later.
      const args = input.args.map((a) =>
        typeof a === 'object' && a !== null && 'address' in a
          ? { Address: a.address }
          : a,
      );
      const res = await this.graph.request<GraphFunctionResult>(cred, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: args }),
      });
      if (!res.ok) return res;
      return mcpOk({
        value: res.value.value ?? null,
        excelError: res.value.error ?? null,
      });
    });
  }

  // ── Resources ────────────────────────────────────────────────────────

  async listResources(): Promise<McpResult<ResourceDescriptor[]>> {
    return mcpOk([
      {
        uri: `excel://workspace/${this.workspaceId}/workbooks`,
        name: 'Workbooks',
        description:
          'Excel workbooks live in OneDrive / SharePoint — list them via the OneDrive MCP and pass workbookId to Excel tools.',
        mimeType: 'application/json',
      },
    ]);
  }

  async readResource(
    input: ReadResourceInput,
  ): Promise<McpResult<ReadResourceOutput>> {
    if (!/^excel:\/\/workspace\/[0-9a-f-]+\/workbooks$/i.test(input.uri)) {
      return mcpError(
        'INVALID_ARGUMENT',
        `Unknown resource URI: ${input.uri}. Excel does not enumerate workbooks; use the OneDrive MCP's listFiles tool with a .xlsx filter.`,
      );
    }
    return mcpOk({
      uri: input.uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        message:
          'Excel workbooks are surfaced via the OneDrive MCP. Use onedrive.search_files with query=".xlsx" to enumerate, then pass the driveItem id as workbookId to Excel tools.',
      }),
    });
  }

  // ── internals ────────────────────────────────────────────────────────

  private async withCredential<T>(
    fn: (credential: DecryptedCredential) => Promise<McpResult<T>>,
  ): Promise<McpResult<T>> {
    const resolved = await resolveCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(resolved.value);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function workbookSegment(driveId: string | undefined, workbookId: string): string {
  if (driveId) {
    return `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(workbookId)}/workbook`;
  }
  return `/me/drive/items/${encodeURIComponent(workbookId)}/workbook`;
}

function validateRangeInputs(input: {
  workbookId?: string;
  sheet?: string;
  address?: string;
}): McpResult<true> {
  if (!input.workbookId) {
    return mcpError('INVALID_ARGUMENT', 'workbookId is required');
  }
  if (!input.sheet) {
    return mcpError('INVALID_ARGUMENT', 'sheet is required');
  }
  if (!input.address) {
    return mcpError('INVALID_ARGUMENT', 'address is required');
  }
  return mcpOk(true);
}
