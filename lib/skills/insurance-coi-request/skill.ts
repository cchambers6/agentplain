/**
 * lib/skills/insurance-coi-request/skill.ts
 *
 * Deterministic certificate-of-insurance request handler for an
 * independent insurance agency. Reads an inbound COI request, looks up
 * the named-insured's policies on the AMS, decides per-line whether the
 * coverage is in-force / expired / not-on-file, builds the structured
 * issuance payload, and drafts a formal acknowledgement back to the
 * requester.
 *
 * Per `lib/skills/prompts/insurance.ts` `draftToneGuidance`:
 *   - never quote a premium — defer with `{{operator: premium}}`
 *   - never confirm a bind / effective date — defer with
 *     `{{operator: bind/effective date}}`
 *   - never use words like "guarantee" / "ensure"
 *   - always note "subject to underwriting" for any new-line ask
 *
 * Per `project_no_outbound_architecture.md`: this skill DRAFTS only. The
 * persister writes a Gmail or Outlook draft when confidence ≥ threshold;
 * the CSR / producer issues the certificate from the AMS or carrier
 * portal and sends from their own email client.
 */

import { randomUUID } from 'node:crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  DEFAULT_PERSIST_THRESHOLD,
  type CoiIssuancePayload,
  type CoiRequestInput,
  type CoiRequestOutput,
  type CoiRequestRecord,
  type CoverageDecision,
  type CoverageLine,
  type PolicyOnFile,
  type RequestStatus,
  type RequesterReplyDraft,
} from './types';

const MS_PER_DAY = 86_400_000;

export async function runSkill(
  input: CoiRequestInput,
): Promise<SkillResult<CoiRequestOutput>> {
  const now = input.now ?? new Date();
  const persistThreshold = input.persistThreshold ?? DEFAULT_PERSIST_THRESHOLD;

  const policiesRes = await input.lookup.fetchPoliciesForInsured({
    workspaceId: input.workspaceId,
    insuredLegalName: input.request.insured.legalName,
  });
  if (!policiesRes.ok) {
    return skillError(
      'UPSTREAM_GMAIL_ERROR',
      `policy lookup failed: ${policiesRes.error.message}`,
      policiesRes.error.code,
    );
  }

  const decisions = decideCoverage({
    requestedLines: input.request.requestedLines,
    policies: policiesRes.value,
    now,
  });
  const status = computeStatus({ decisions, request: input.request });
  const issuance = buildIssuancePayload({
    request: input.request,
    decisions,
  });
  const requesterReply = renderRequesterReply({
    request: input.request,
    status,
    decisions,
  });

  if (input.persister && requesterReply.confidence >= persistThreshold) {
    const persistRes = await input.persister.persistDraft({
      workspaceId: input.workspaceId,
      threadId: `coi-${input.request.requestId}-ack`,
      inReplyToMessageId: null,
      toEmails: requesterReply.toEmails,
      subject: requesterReply.subject,
      body: requesterReply.body,
    });
    if (persistRes.ok) {
      requesterReply.persisted = true;
      requesterReply.providerDraftId = persistRes.value.providerDraftId;
    }
  }

  return skillOk({
    requestId: input.request.requestId,
    status,
    issuance,
    requesterReply,
  });
}

// ── Coverage decisioning ─────────────────────────────────────────────────

function decideCoverage(args: {
  requestedLines: CoverageLine[];
  policies: PolicyOnFile[];
  now: Date;
}): CoverageDecision[] {
  const { requestedLines, policies, now } = args;
  const byLine = new Map<CoverageLine, PolicyOnFile[]>();
  for (const p of policies) {
    const arr = byLine.get(p.line) ?? [];
    arr.push(p);
    byLine.set(p.line, arr);
  }
  return requestedLines.map((line) => {
    const candidates = byLine.get(line) ?? [];
    if (candidates.length === 0) {
      return { line, match: 'not-on-file', policy: null };
    }
    // Prefer in-force policy; if none, surface the most-recent expired
    // so the CSR knows what was there last term.
    const inForce = candidates.find((p) => p.inForce && !isExpired(p, now));
    if (inForce) {
      return { line, match: 'in-force', policy: inForce };
    }
    const expired = pickMostRecentExpiration(candidates);
    return { line, match: 'expired', policy: expired };
  });
}

function isExpired(p: PolicyOnFile, now: Date): boolean {
  const exp = new Date(p.expirationDate);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() < now.getTime();
}

function pickMostRecentExpiration(candidates: PolicyOnFile[]): PolicyOnFile {
  return candidates
    .slice()
    .sort((a, b) => {
      const aT = new Date(a.expirationDate).getTime();
      const bT = new Date(b.expirationDate).getTime();
      return bT - aT;
    })[0];
}

function computeStatus(args: {
  decisions: CoverageDecision[];
  request: CoiRequestRecord;
}): RequestStatus {
  const { decisions, request } = args;
  if (decisions.length === 0) return 'needs-operator-review';
  const hasGap = decisions.some((d) => d.match === 'not-on-file');
  const hasExpired = decisions.some((d) => d.match === 'expired');
  if (hasGap) return 'coverage-gap';
  if (hasExpired) return 'expired-coverage';
  // Waiver of subrogation requires policy-level endorsement check that the
  // CSR has to confirm in the carrier portal — always route to operator.
  if (request.waiverOfSubrogation) return 'needs-operator-review';
  return 'ready-to-issue';
}

// ── Issuance payload ─────────────────────────────────────────────────────

function buildIssuancePayload(args: {
  request: CoiRequestRecord;
  decisions: CoverageDecision[];
}): CoiIssuancePayload {
  const { request, decisions } = args;
  return {
    certificateHolder: request.requester.organizationName,
    insuredLegalName: request.insured.legalName,
    additionalInsured: request.additionalInsured,
    waiverOfSubrogation: request.waiverOfSubrogation,
    projectReference: request.requester.projectReference,
    coverageDecisions: decisions,
  };
}

// ── Requester reply rendering ────────────────────────────────────────────

function renderRequesterReply(args: {
  request: CoiRequestRecord;
  status: RequestStatus;
  decisions: CoverageDecision[];
}): RequesterReplyDraft {
  const { request, status, decisions } = args;
  const subject = (() => {
    switch (status) {
      case 'ready-to-issue':
        return `COI for ${request.insured.displayName} — received, in progress`;
      case 'coverage-gap':
        return `COI for ${request.insured.displayName} — coverage detail needed`;
      case 'expired-coverage':
        return `COI for ${request.insured.displayName} — renewal pending`;
      case 'needs-operator-review':
        return `COI for ${request.insured.displayName} — under producer review`;
    }
  })();

  const lines: string[] = [];
  const requesterFirst = request.requester.contact.name.split(/\s+/)[0]
    || request.requester.contact.name;
  lines.push(`Hello ${requesterFirst},`);
  lines.push('');
  lines.push(
    `Thank you for the certificate request for ${request.insured.displayName}` +
      (request.requester.projectReference
        ? ` regarding ${request.requester.projectReference}.`
        : '.'),
  );
  lines.push('');

  switch (status) {
    case 'ready-to-issue':
      lines.push(
        'The lines you requested are on file. We will route the certificate ' +
          'through our agency management system today and confirm the ' +
          'certificate number once issued by the carrier. Effective dates ' +
          'and limits on the issued certificate will reflect the policies ' +
          'in force on the issuance date — {{operator: bind/effective date}}.',
      );
      break;
    case 'coverage-gap':
      lines.push(
        'A note before we issue: at least one of the coverage lines you ' +
          'requested is not currently on file for this insured. We will ' +
          'confirm the scope with the insured and your team before issuing ' +
          'the certificate. Any new line is subject to underwriting; ' +
          'premium and binding dates will follow under {{operator: premium}} ' +
          'and {{operator: bind/effective date}}.',
      );
      lines.push('');
      lines.push('Lines flagged for review:');
      for (const d of decisions) {
        if (d.match === 'not-on-file') {
          lines.push(`  - ${friendlyLine(d.line)}: not currently bound for this insured`);
        }
      }
      break;
    case 'expired-coverage':
      lines.push(
        'A note before we issue: one or more of the requested lines have a ' +
          'policy term that has lapsed. We will confirm the in-force status ' +
          'with the carrier and reissue against the active term. Any updated ' +
          'effective dates will land under {{operator: bind/effective date}}.',
      );
      lines.push('');
      lines.push('Lines flagged for review:');
      for (const d of decisions) {
        if (d.match === 'expired') {
          lines.push(
            `  - ${friendlyLine(d.line)}: policy ${d.policy?.policyNumber ?? ''} on file with a lapsed term`,
          );
        }
      }
      break;
    case 'needs-operator-review':
      lines.push(
        'This request includes a feature we always run by the producer of ' +
          'record before issuing — a waiver of subrogation or a project-specific ' +
          'endorsement. {{operator: confirm endorsement availability with the ' +
          'carrier}} and we will follow up with the certificate or the next ' +
          'step within the business day.',
      );
      break;
  }

  if (request.hasDeadline) {
    lines.push('');
    lines.push(
      'We saw the deadline noted in your message. If anything in the path ' +
        'above looks like it could put that timing at risk we will reach out ' +
        'directly rather than wait until the day-of.',
    );
  }

  lines.push('');
  lines.push(
    'For specific premium, deductible, or binding-date questions, please ' +
      'direct them to {{operator: premium}} — our agency does not quote those ' +
      'figures over email, even on existing policies.',
  );
  lines.push('');
  lines.push('Best regards,');
  lines.push(request.responsibleCsr.name);
  lines.push('{{operator: agency signature block}}');

  // Confidence calibration:
  //   ready-to-issue → high (routine)
  //   coverage-gap / expired → mid (CSR re-reads tone)
  //   needs-operator-review → low (producer must confirm endorsement)
  const confidence = status === 'ready-to-issue'
    ? 0.8
    : status === 'expired-coverage'
      ? 0.66
      : status === 'coverage-gap'
        ? 0.6
        : 0.48;

  return {
    draftId: randomUUID(),
    providerDraftId: null,
    toEmails: [request.requester.contact.email],
    ccEmails: [request.responsibleCsr.email, request.insured.contact.email],
    subject,
    body: lines.join('\n'),
    tone: 'formal',
    confidence,
    persisted: false,
  };
}

function friendlyLine(line: CoverageLine): string {
  switch (line) {
    case 'general-liability':
      return 'General Liability';
    case 'auto-liability':
      return 'Commercial Auto Liability';
    case 'workers-comp':
      return 'Workers Compensation';
    case 'umbrella':
      return 'Umbrella / Excess';
    case 'professional-liability':
      return 'Professional Liability';
    case 'property':
      return 'Commercial Property';
    case 'inland-marine':
      return 'Inland Marine';
  }
}

// ── Helpers exposed for tests ────────────────────────────────────────────

export const _internal = {
  decideCoverage,
  computeStatus,
  MS_PER_DAY,
};
