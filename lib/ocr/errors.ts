export class OcrConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OcrConfigError"
  }
}

export class OcrExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OcrExtractionError"
  }
}
