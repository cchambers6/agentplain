/**
 * lib/demo/synthetic/datasets.ts
 *
 * The hand-authored, plainly-fictional per-vertical datasets. One per killer
 * workflow in the activation mandate: real estate, CPA, law, property
 * management, and the general on-ramp set.
 *
 * Every email is `@example.com`; every name and figure is invented. These feed
 * `lib/workflows/verticals/*` — the synthetic entities a step's copy weaves in
 * so the running demo reads like a real night's work, not a lorem-ipsum stub.
 */

import type { SyntheticDataset } from "./types";

export const REAL_ESTATE_SYNTHETIC: SyntheticDataset = {
  vertical: "REAL_ESTATE",
  sourceLabel: "a sample Follow Up Boss pipeline",
  clients: [
    {
      id: "lead-marcus-pope",
      name: "Marcus Pope",
      email: "marcus.pope@example.com",
      context:
        "Pre-approved to $525k · viewed 418 Peachtree Way three times · relocating for work",
    },
    {
      id: "lead-dana-whitfield",
      name: "Dana Whitfield",
      email: "dana.whitfield@example.com",
      context: "Browsing 3-bed listings under $400k · no tour requested yet",
    },
    {
      id: "lead-alvarez-family",
      name: "The Alvarez family",
      email: "alvarez.family@example.com",
      context: "Relocating next spring · 6–9 month timeline",
    },
  ],
  messages: [
    {
      id: "msg-pope-inquiry",
      from: "Marcus Pope",
      at: "9:14pm",
      channel: "web-form",
      subject: "Is 418 Peachtree Way still available?",
      preview:
        "Saw it on your site — I'm pre-approved and could move quickly. Can I see it this weekend?",
    },
  ],
  transactions: [],
};

export const CPA_SYNTHETIC: SyntheticDataset = {
  vertical: "CPA",
  sourceLabel: "a sample TaxDome client list",
  clients: [
    {
      id: "client-cobb-lane",
      name: "Cobb & Lane LLC",
      email: "dana.cobb@example.com",
      context: "Q2 close starts Monday · missing two 1099s and a bank statement",
    },
    {
      id: "client-marigold-bakery",
      name: "Marigold Bakery",
      email: "sofia.marigold@example.com",
      context: "Books current · awaiting one signed engagement letter",
    },
    {
      id: "client-hwang-dental",
      name: "Hwang Dental",
      email: "grace.hwang@example.com",
      context: "Missing March 1099-NEC from a contractor",
    },
  ],
  messages: [],
  transactions: [
    {
      id: "stmt-cobb-q2",
      party: "Cobb & Lane LLC",
      kind: "statement",
      amountUsd: 0,
      status: "2 of 5 documents in",
      ageDays: 4,
    },
  ],
};

export const LAW_SYNTHETIC: SyntheticDataset = {
  vertical: "LAW",
  sourceLabel: "a sample intake inbox and matter list",
  clients: [
    {
      id: "intake-priya-raman",
      name: "Priya Raman",
      email: "priya.raman@example.com",
      context:
        "Contract review for a small-business sale · screened clear against your matters",
    },
    {
      id: "matter-cobb-logistics",
      name: "Cobb Logistics",
      email: "legal@example.com",
      context: "Opposing party in an open employment matter — a conflict tripwire",
    },
  ],
  messages: [
    {
      id: "msg-raman-intake",
      from: "Priya Raman",
      at: "11:02pm",
      channel: "web-form",
      subject: "Need help reviewing a business-sale contract",
      preview:
        "I'm selling my business and need a contract reviewed quickly. Are you taking new clients?",
    },
  ],
  transactions: [],
};

export const PROPERTY_MANAGEMENT_SYNTHETIC: SyntheticDataset = {
  vertical: "PROPERTY_MANAGEMENT",
  sourceLabel: "a sample Buildium portfolio",
  clients: [
    {
      id: "tenant-unit-4b",
      name: "Carla Mendez",
      email: "carla.mendez@example.com",
      context: "Unit 4B · 2-year tenant in good standing · reports no hot water",
    },
    {
      id: "vendor-reliant-plumbing",
      name: "Reliant Plumbing",
      email: "dispatch@example.com",
      context: "Your on-call plumber · 24/7 emergency line",
    },
  ],
  messages: [
    {
      id: "msg-4b-maintenance",
      from: "Carla Mendez",
      at: "10:18pm",
      channel: "portal",
      subject: "No hot water in Unit 4B",
      preview:
        "Water heater stopped working tonight — no hot water at all. Two kids at home.",
    },
  ],
  transactions: [],
};

export const GENERAL_SYNTHETIC: SyntheticDataset = {
  vertical: null,
  sourceLabel: "a sample inbox",
  clients: [
    {
      id: "contact-northgate",
      name: "Northgate Cafe",
      email: "owner@example.com",
      context: "Asking to reschedule Thursday's delivery — needs a same-day answer",
    },
    {
      id: "contact-bellweather",
      name: "Bellweather Co",
      email: "ap@example.com",
      context: "Replying about invoice #1037 — wants a revised due date",
    },
  ],
  messages: [
    {
      id: "msg-overnight-batch",
      from: "(overnight inbox)",
      at: "6:40am",
      channel: "email",
      subject: "23 new messages overnight",
      preview:
        "Mixed bag — two reschedules, a billing question, a new inquiry, and the usual noise.",
    },
  ],
  transactions: [
    {
      id: "invoice-1037",
      party: "Bellweather Co",
      kind: "invoice",
      amountUsd: 6100,
      status: "45 days overdue",
      ageDays: 45,
    },
  ],
};
