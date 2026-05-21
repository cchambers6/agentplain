/**
 * lib/integrations/excel-mcp/test-server.ts
 *
 * Deterministic, in-memory implementation of `ExcelMcpServer`. Symmetric
 * peer of `./server.ts` per `feedback_runner_portability.md`.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/microsoft/mcp-common';
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

interface TestSheet {
  descriptor: SheetDescriptor;
  /** 2-D value matrix indexed by [row][col]. */
  cells: Array<Array<string | number | boolean | null>>;
}

interface TestTable {
  columns: string[];
  rows: Array<Array<string | number | boolean | null>>;
}

interface TestWorkbook {
  id: string;
  sheets: Map<string, TestSheet>;
  tables: Map<string, TestTable>;
  lastCalculationType: string | null;
}

export interface TestExcelSeed {
  workbooks?: Array<{
    id: string;
    sheets: Array<{
      id: string;
      name: string;
      cells: Array<Array<string | number | boolean | null>>;
    }>;
    tables?: Array<{ name: string; columns: string[]; rows: Array<Array<string | number | boolean | null>> }>;
  }>;
}

export class TestExcelMcpServer implements ExcelMcpServer {
  readonly name = 'excel-test' as const;
  readonly workspaceId: string;
  private readonly workbooks: Map<string, TestWorkbook>;

  readonly calls: Array<{ method: string; args: unknown }> = [];

  constructor(args: { workspaceId: string; seed?: TestExcelSeed }) {
    if (!args.workspaceId) {
      throw new Error('TestExcelMcpServer: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
    this.workbooks = new Map();
    const seedWorkbooks = args.seed?.workbooks ?? defaultWorkbooks();
    for (const wb of seedWorkbooks) {
      const sheets = new Map<string, TestSheet>();
      for (const [idx, s] of wb.sheets.entries()) {
        sheets.set(s.name, {
          descriptor: { id: s.id, name: s.name, position: idx, visibility: 'Visible' },
          cells: s.cells,
        });
      }
      const tables = new Map<string, TestTable>();
      for (const t of wb.tables ?? []) {
        tables.set(t.name, { columns: t.columns, rows: t.rows });
      }
      this.workbooks.set(wb.id, {
        id: wb.id,
        sheets,
        tables,
        lastCalculationType: null,
      });
    }
  }

  async listSheets(input: ListSheetsInput): Promise<McpResult<ListSheetsOutput>> {
    this.calls.push({ method: 'listSheets', args: input });
    const wb = this.workbooks.get(input.workbookId);
    if (!wb) return mcpError('NOT_FOUND', `No fixture workbook ${input.workbookId}`);
    return mcpOk({
      sheets: Array.from(wb.sheets.values()).map((s) => s.descriptor),
    });
  }

  async readRange(input: ReadRangeInput): Promise<McpResult<ReadRangeOutput>> {
    this.calls.push({ method: 'readRange', args: input });
    const wb = this.workbooks.get(input.workbookId);
    if (!wb) return mcpError('NOT_FOUND', `No fixture workbook ${input.workbookId}`);
    const sheet = wb.sheets.get(input.sheet);
    if (!sheet) return mcpError('NOT_FOUND', `No fixture sheet ${input.sheet}`);
    const slice = sliceA1(sheet.cells, input.address);
    if (!slice) {
      return mcpError('INVALID_ARGUMENT', `Test server cannot parse address ${input.address}`);
    }
    return mcpOk({
      values: slice,
      resolvedAddress: `${input.sheet}!${input.address}`,
      rowCount: slice.length,
      columnCount: slice[0]?.length ?? 0,
    });
  }

  async writeRange(input: WriteRangeInput): Promise<McpResult<WriteRangeOutput>> {
    this.calls.push({ method: 'writeRange', args: input });
    const wb = this.workbooks.get(input.workbookId);
    if (!wb) return mcpError('NOT_FOUND', `No fixture workbook ${input.workbookId}`);
    const sheet = wb.sheets.get(input.sheet);
    if (!sheet) return mcpError('NOT_FOUND', `No fixture sheet ${input.sheet}`);
    const target = parseA1(input.address);
    if (!target) {
      return mcpError('INVALID_ARGUMENT', `Test server cannot parse address ${input.address}`);
    }
    for (let r = 0; r < input.values.length; r++) {
      const row = input.values[r];
      for (let c = 0; c < row.length; c++) {
        const absR = target.row + r;
        const absC = target.col + c;
        while (sheet.cells.length <= absR) sheet.cells.push([]);
        while (sheet.cells[absR].length <= absC) sheet.cells[absR].push(null);
        sheet.cells[absR][absC] = row[c];
      }
    }
    const cellsWritten = input.values.reduce(
      (acc, row) => acc + (Array.isArray(row) ? row.length : 0),
      0,
    );
    return mcpOk({
      resolvedAddress: `${input.sheet}!${input.address}`,
      cellsWritten,
    });
  }

  async readTable(input: ReadTableInput): Promise<McpResult<ReadTableOutput>> {
    this.calls.push({ method: 'readTable', args: input });
    const wb = this.workbooks.get(input.workbookId);
    if (!wb) return mcpError('NOT_FOUND', `No fixture workbook ${input.workbookId}`);
    const table = wb.tables.get(input.tableName);
    if (!table) return mcpError('NOT_FOUND', `No fixture table ${input.tableName}`);
    const max = input.maxRows ?? 1000;
    return mcpOk({
      columns: [...table.columns],
      rows: table.rows.slice(0, max).map((r) => [...r]),
      totalRows: table.rows.length,
    });
  }

  async appendTableRow(
    input: AppendTableRowInput,
  ): Promise<McpResult<AppendTableRowOutput>> {
    this.calls.push({ method: 'appendTableRow', args: input });
    const wb = this.workbooks.get(input.workbookId);
    if (!wb) return mcpError('NOT_FOUND', `No fixture workbook ${input.workbookId}`);
    const table = wb.tables.get(input.tableName);
    if (!table) return mcpError('NOT_FOUND', `No fixture table ${input.tableName}`);
    table.rows.push([...input.row]);
    return mcpOk({ rowAddress: `row#${table.rows.length - 1}` });
  }

  async recalculateWorkbook(
    input: RecalculateWorkbookInput,
  ): Promise<McpResult<RecalculateWorkbookOutput>> {
    this.calls.push({ method: 'recalculateWorkbook', args: input });
    const wb = this.workbooks.get(input.workbookId);
    if (!wb) return mcpError('NOT_FOUND', `No fixture workbook ${input.workbookId}`);
    const ct = input.calculationType ?? 'Recalculate';
    wb.lastCalculationType = ct;
    return mcpOk({ calculationType: ct });
  }

  async runNamedFunction(
    input: RunNamedFunctionInput,
  ): Promise<McpResult<RunNamedFunctionOutput>> {
    this.calls.push({ method: 'runNamedFunction', args: input });
    if (!this.workbooks.has(input.workbookId)) {
      return mcpError('NOT_FOUND', `No fixture workbook ${input.workbookId}`);
    }
    // Implement a tiny SUM for tests; everything else returns a placeholder.
    if (input.functionName.toUpperCase() === 'SUM') {
      const nums = input.args.filter((a): a is number => typeof a === 'number');
      const sum = nums.reduce((acc, n) => acc + n, 0);
      return mcpOk({ value: sum, excelError: null });
    }
    return mcpOk({ value: null, excelError: null });
  }

  async listResources(): Promise<McpResult<ResourceDescriptor[]>> {
    return mcpOk([
      {
        uri: `excel://workspace/${this.workspaceId}/workbooks`,
        name: 'Workbooks (test)',
        description: 'Fixture-backed Excel test surface.',
        mimeType: 'application/json',
      },
    ]);
  }

  async readResource(
    input: ReadResourceInput,
  ): Promise<McpResult<ReadResourceOutput>> {
    return mcpOk({
      uri: input.uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        workbooks: Array.from(this.workbooks.keys()),
      }),
    });
  }
}

// ── A1 helpers (tiny, just enough for tests) ───────────────────────────

function parseA1(address: string): { row: number; col: number; endRow?: number; endCol?: number } | null {
  const single = /^([A-Z]+)(\d+)$/.exec(address);
  if (single) {
    return { row: parseInt(single[2], 10) - 1, col: colLetterToIndex(single[1]) };
  }
  const range = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(address);
  if (range) {
    return {
      row: parseInt(range[2], 10) - 1,
      col: colLetterToIndex(range[1]),
      endRow: parseInt(range[4], 10) - 1,
      endCol: colLetterToIndex(range[3]),
    };
  }
  return null;
}

function colLetterToIndex(letters: string): number {
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64);
  }
  return idx - 1;
}

function sliceA1(
  cells: Array<Array<string | number | boolean | null>>,
  address: string,
): Array<Array<string | number | boolean | null>> | null {
  const parsed = parseA1(address);
  if (!parsed) return null;
  const endRow = parsed.endRow ?? parsed.row;
  const endCol = parsed.endCol ?? parsed.col;
  const out: Array<Array<string | number | boolean | null>> = [];
  for (let r = parsed.row; r <= endRow; r++) {
    const row: Array<string | number | boolean | null> = [];
    for (let c = parsed.col; c <= endCol; c++) {
      row.push(cells[r]?.[c] ?? null);
    }
    out.push(row);
  }
  return out;
}

// ── Default fixtures ────────────────────────────────────────────────────

function defaultWorkbooks(): NonNullable<TestExcelSeed['workbooks']> {
  return [
    {
      id: 'workbook-fixture-001',
      sheets: [
        {
          id: 'sheet-id-1',
          name: 'Sheet1',
          cells: [
            ['Client', 'Status', 'Last touched'],
            ['Jane Buyer', 'Active', '2026-05-18'],
            ['Acme LLC', 'Closed', '2026-04-12'],
          ],
        },
      ],
      tables: [
        {
          name: 'Tbl_Clients',
          columns: ['Client', 'Status', 'Last touched'],
          rows: [
            ['Jane Buyer', 'Active', '2026-05-18'],
            ['Acme LLC', 'Closed', '2026-04-12'],
          ],
        },
      ],
    },
  ];
}
