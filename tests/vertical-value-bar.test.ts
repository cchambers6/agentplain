import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  VERTICAL_SLUGS,
  ON_RAMP_SLUGS,
  getVerticalContent,
} from "@/lib/verticals";
import {
  trialPeriodDaysForVertical,
  MONEY_BACK_GUARANTEE_DAYS,
} from "@/lib/billing/facts";
import { verticalEnumFromSlug } from "@/lib/auth/vertical-enum";
import {
  killerWorkflowStoryFor,
  VERTICALS_WITH_STORY,
} from "@/lib/workflows/verticals";
import { totalSavedMinutes } from "@/lib/workflows/runtime";
import { killerWorkflowFor } from "@/lib/plaino/killer-workflow";

// Customer-value-bar guards for the vertical landing pages (2026-07-19 wave).
//
// Three ratified facts these pin:
//   1. Trial mechanics (2026-06-14, `lib/billing/facts.ts`): 7-day trial by
//      default, 14 for CPA + Law, card at signup, 14-day money-back. The
//      retired "first month free" framing must never reappear on a vertical
//      surface — it drifted back once already.
//   2. Every vertical page states its own trial length, not a neighbor's.
//   3. The four live verticals each carry an authored killer-workflow story
//      whose headline matches the canonical registry, with calibrated (>0)
//      saved-minute math — the landing-page showcase renders exactly these.

const ALL_SLUGS = [...VERTICAL_SLUGS, ...ON_RAMP_SLUGS];
const LIVE_SLUGS = ["real-estate", "cpa", "law", "property-management"];

describe("vertical trial-mechanics truth", () => {
  for (const slug of ALL_SLUGS) {
    const content = getVerticalContent(slug);
    assert.ok(content, `content for ${slug}`);

    it(`${slug}: no surface string uses the retired "first month free" framing`, () => {
      const haystack = JSON.stringify(content);
      assert.ok(
        !/first month free/i.test(haystack),
        `${slug} still says "first month free" — retired 2026-06-14; use lib/billing/facts.ts mechanics`,
      );
    });

    it(`${slug}: FAQ states this vertical's own trial length + the money-back guarantee`, () => {
      const faq = (content.verticalFaq ?? []).map((f) => f.a).join(" ");
      const days = trialPeriodDaysForVertical(slug);
      assert.ok(
        faq.includes(`${days}-day free trial`),
        `${slug} FAQ must state the ${days}-day free trial`,
      );
      assert.ok(
        faq.includes(`${MONEY_BACK_GUARANTEE_DAYS}-day money-back guarantee`),
        `${slug} FAQ must state the ${MONEY_BACK_GUARANTEE_DAYS}-day money-back guarantee`,
      );
      assert.ok(
        faq.includes("card at signup"),
        `${slug} FAQ must state card-at-signup`,
      );
    });
  }
});

describe("live-vertical killer-workflow stories", () => {
  it("the four live verticals are exactly the verticals with an authored story", () => {
    const storyVerticals = [...VERTICALS_WITH_STORY].sort();
    const liveVerticals = LIVE_SLUGS.map((slug) => {
      const v = verticalEnumFromSlug(slug);
      assert.ok(v, `enum mapping for ${slug}`);
      return v;
    }).sort();
    assert.deepEqual(storyVerticals, liveVerticals);
  });

  for (const slug of LIVE_SLUGS) {
    it(`${slug}: story matches the canonical registry headline and has calibrated savings`, () => {
      const vertical = verticalEnumFromSlug(slug);
      assert.ok(vertical);
      const story = killerWorkflowStoryFor(vertical);
      const spec = killerWorkflowFor(vertical);
      assert.equal(story.vertical, vertical);
      // PROPERTY_MANAGEMENT is a documented divergence: the registry frames PM
      // around late rent while the demo story runs the after-hours maintenance
      // narrative with its own headline (see lib/workflows/verticals/
      // property-management.ts). Everyone else must match the registry.
      if (vertical === "PROPERTY_MANAGEMENT") {
        assert.ok(story.headline.length > 0);
      } else {
        assert.equal(story.headline, spec.headline);
      }
      assert.ok(story.steps.length >= 3, `${slug} story has real steps`);
      assert.ok(
        totalSavedMinutes(story) > 0,
        `${slug} story must save calibrated minutes`,
      );
      assert.ok(story.runsPerTrial > 0, `${slug} story projects trial runs`);
    });
  }
});
