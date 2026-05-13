import type { CorpusBundle } from "../../types";
import { metadata } from "./_metadata";
import { rule as fairHousingCrossref } from "./fair-housing-reference";
import { rule as gaLandlordTenant } from "./ga-landlord-tenant-literal";
import { rule as gaSecurityDeposit } from "./ga-security-deposit-literal";
import { rule as gaEviction } from "./ga-eviction-literal";

export const propertyManagementCorpus: CorpusBundle = {
  verticalSlug: "property-management",
  metadata,
  rules: [fairHousingCrossref, gaLandlordTenant, gaSecurityDeposit, gaEviction],
};
