import { CMMC_FRAMEWORK_ID, resolveFrameworkId } from "../core/engines/framework-engine/frameworkRegistry";

export const isCMMCOnlyMode = String(import.meta.env.VITE_CMMC_ONLY_MODE || "").toLowerCase() === "true";
export const cmmcOnlyModeReason = "Inapplicable for this CMMC-only client demo";
const allFrameworkAccessEmails = new Set(
  String(import.meta.env.VITE_ALL_FRAMEWORK_ACCESS_EMAILS || "vijay@spectramindsolutions.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

export function hasAllFrameworkAccess(email) {
  return allFrameworkAccessEmails.has(String(email || "").trim().toLowerCase());
}

export function isFrameworkApplicable(frameworkIdOrSlug, email) {
  return !isCMMCOnlyMode || hasAllFrameworkAccess(email) || resolveFrameworkId(frameworkIdOrSlug) === CMMC_FRAMEWORK_ID;
}
