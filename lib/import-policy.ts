import { EXTERNAL_IMPORT_RUBRIC_VERSION, RUBRIC_VERSION } from "@/lib/lead-engine";

export const EXTERNAL_IMPORT_MODEL_IDENTIFIER = "external_structured_assessment_untrusted";

export function importedLeadPendingVerification(input: {
  hardGateStatus: string;
  score: number;
  evidenceCoverage: number;
  riskSummary?: string;
  hardGateReason?: string;
}) {
  const auditSummary = [
    `外部文件声明 hardGate=${input.hardGateStatus}、score=${input.score}、coverage=${input.evidenceCoverage}%`,
    input.hardGateReason ? `外部准入理由：${input.hardGateReason}` : "",
    input.riskSummary || "",
    "该结论只作为审计输入；必须由服务器重新核验官网、分类、评分和强制准入，人工批准前不得导出或联系。",
  ].filter(Boolean).join("；");
  return {
    qualificationResult: "near_match",
    workflowStatus: "needs_review",
    hardGateStatus: "needs_review",
    hardGateReason: auditSummary,
    currentScore: 0,
    grade: "C",
    evidenceCoverage: 0,
    scoreConfidence: "low",
    riskSummary: auditSummary,
  } as const;
}

export function externalImportRubricVersion() {
  return EXTERNAL_IMPORT_RUBRIC_VERSION;
}

export function isCurrentServerVerification(scoreRun: { rubricVersion?: string | null; modelIdentifier?: string | null } | null | undefined) {
  return scoreRun?.rubricVersion === RUBRIC_VERSION
    && /^deterministic_public_rules_v3(?:_|$)/.test(scoreRun.modelIdentifier || "");
}
