export const ASSISTED_ACCOUNTING_IMPORT_MAX_BYTES = 3 * 1024 * 1024

export const ASSISTED_IMPORT_EMAIL = "infotaxlyn@gmail.com"

export function accountingImportNeedsAssistance(byteSize: number): boolean {
  return byteSize > ASSISTED_ACCOUNTING_IMPORT_MAX_BYTES
}

export function assistedAccountingImportMessage(): string {
  return `Este archivo supera los 3 MB. Escríbenos a ${ASSISTED_IMPORT_EMAIL} con el ZIP o el Excel y lo cargamos nosotros en la empresa, después de revisarlo.`
}
