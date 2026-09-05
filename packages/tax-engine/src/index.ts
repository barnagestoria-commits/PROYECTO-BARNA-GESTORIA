export type {
  AeatOfficialSourceMeta,
  Model303FilingOptions,
  TaxCasillaValue,
  TaxDeclarationType,
  TaxExportArtifact,
  TaxFact,
  TaxFactSourceRef,
  TaxPeriodCode,
  TaxReturnContext,
  TaxReturnDraft,
  TaxSoftwareIdentity,
  TaxValidationIssue,
  TaxValidationResult,
} from "./types"

export {
  formatAeatNumAmount,
  formatAeatPercent,
  formatAeatSignedAmount,
  isValidSpanishTaxId,
  normalizeCompanyName,
  normalizeNif,
  roundEuro,
} from "./amount-format"

export {
  AeatSourceRegistry,
  AEAT_OFFICIAL_SOURCES,
  defaultAeatSourceRegistry,
  getDefault303VersionKey,
} from "./registry/aeat-source-registry"

export { TaxFactLedger, aggregateCasillasByCode } from "./ledger/tax-fact-ledger"

export {
  TaxRuleEngine,
  defaultTaxRuleEngine,
  finalizeModel303Casillas,
  type Model303CasillaInputs,
} from "./rules/tax-rule-engine"

export {
  exportModel303Dr303,
  isModel303Supported,
  buildModel303ValidationOnly,
  type Model303AdapterInput,
} from "./adapters/model-303/adapter"

export {
  buildModel303Dr303File,
  buildModel303Filename,
  TAX_ENGINE_PROGRAM_VERSION,
} from "./adapters/model-303/envelope"

export { validateModel303Export } from "./adapters/model-303/validate"

export {
  MODEL_303_PAGE_01000_LENGTH,
  MODEL_303_PAGE_03000_LENGTH,
} from "./adapters/model-303/field-map"
