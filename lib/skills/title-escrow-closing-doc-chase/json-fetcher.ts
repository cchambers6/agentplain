/**
 * lib/skills/title-escrow-closing-doc-chase/json-fetcher.ts
 *
 * Second implementation of `ClosingFileFetcher` — serves a pre-loaded
 * JSON payload. Production wiring binds the SoftPro / Qualia / RamQuest
 * MCP; tests bind this.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type {
  ChecklistItem,
  ClosingFile,
  ClosingFileFetcher,
  ReceivedDoc,
} from './types';

export interface JsonClosingSeed {
  workspaceId: string;
  fileId: string;
  file: ClosingFile;
  checklist: ChecklistItem[];
  receivedDocs: ReceivedDoc[];
}

export class JsonClosingFileFetcher implements ClosingFileFetcher {
  readonly name = 'json' as const;
  constructor(private readonly seed: JsonClosingSeed) {}

  async fetchFile(args: { workspaceId: string; fileId: string }) {
    const g = this.guard(args);
    if (g) return g as SkillResult<ClosingFile>;
    return skillOk(this.seed.file);
  }

  async fetchChecklist(args: { workspaceId: string; fileId: string }) {
    const g = this.guard(args);
    if (g) return g as SkillResult<ChecklistItem[]>;
    return skillOk(this.seed.checklist);
  }

  async fetchReceivedDocs(args: { workspaceId: string; fileId: string }) {
    const g = this.guard(args);
    if (g) return g as SkillResult<ReceivedDoc[]>;
    return skillOk(this.seed.receivedDocs);
  }

  private guard(args: { workspaceId: string; fileId: string }): SkillResult<never> | null {
    if (args.workspaceId !== this.seed.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `JsonClosingFileFetcher seeded for workspace ${this.seed.workspaceId}, asked for ${args.workspaceId}`,
      );
    }
    if (args.fileId !== this.seed.fileId) {
      return skillError(
        'INVALID_INPUT',
        `JsonClosingFileFetcher seeded for file ${this.seed.fileId}, asked for ${args.fileId}`,
      );
    }
    return null;
  }
}
