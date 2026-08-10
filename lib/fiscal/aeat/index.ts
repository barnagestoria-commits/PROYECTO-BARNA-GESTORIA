export { generateAeatTxt, shouldOfferAeatTxt, buildAeatTxtFilename, AEAT_RECORD_LENGTH } from "@/lib/fiscal/aeat/generate-aeat-txt"
export {
  buildOfficialAeatDraftBundle,
  type OfficialAeatDraftBundle,
} from "@/lib/fiscal/aeat/build-official-submission"
export {
  AEAT_OFFICIAL_PORTALS,
  AEAT_MODEL_OFFICIAL_SOURCES,
  getAeatModelOfficialSource,
  type AeatModelOfficialSource,
} from "@/lib/fiscal/aeat/official-sources"
export {
  validateAeatSubmission,
  type AeatSubmissionValidationResult,
  type AeatSubmissionValidationIssue,
} from "@/lib/fiscal/aeat/validate-submission"
export {
  AEAT_SANDBOX_SERVICES,
  validateWithOfficialAeatPipeline,
  type AeatOfficialValidationResult,
} from "@/lib/fiscal/aeat/sandbox-client"
