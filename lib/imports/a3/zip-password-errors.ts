export const ZIP_PASSWORD_REQUIRED_CODE = "ZIP_PASSWORD_REQUIRED"
export const ZIP_PASSWORD_INCORRECT_CODE = "ZIP_PASSWORD_INCORRECT"

export class ZipPasswordRequiredError extends Error {
  readonly code = ZIP_PASSWORD_REQUIRED_CODE

  constructor(message = "Este archivo ZIP está protegido con contraseña.") {
    super(message)
    this.name = "ZipPasswordRequiredError"
  }
}

export class ZipPasswordIncorrectError extends Error {
  readonly code = ZIP_PASSWORD_INCORRECT_CODE

  constructor(message = "Contraseña incorrecta. Comprueba la contraseña del export A3.") {
    super(message)
    this.name = "ZipPasswordIncorrectError"
  }
}

export function isZipPasswordRequiredError(error: unknown): error is ZipPasswordRequiredError {
  return error instanceof ZipPasswordRequiredError
}

export function isZipPasswordIncorrectError(error: unknown): error is ZipPasswordIncorrectError {
  return error instanceof ZipPasswordIncorrectError
}

export function isZipPasswordError(error: unknown): error is ZipPasswordRequiredError | ZipPasswordIncorrectError {
  return isZipPasswordRequiredError(error) || isZipPasswordIncorrectError(error)
}

export function getZipPasswordErrorCode(error: unknown): string | null {
  if (!isZipPasswordError(error)) return null
  return error.code
}

export function isJsZipEncryptedLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /encrypted zip are not supported/i.test(error.message)
}

export function isZipJsEncryptedEntryError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /encrypted entry|password required|invalid password/i.test(error.message)
}

export function isZipJsInvalidPasswordError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /invalid password|wrong password|bad password|decryption failed/i.test(error.message)
}
