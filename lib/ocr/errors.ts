import { OCR_QUOTA_CODE, OCR_QUOTA_MESSAGE } from "@/lib/ocr/ocr-quota"

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

export class OcrQuotaError extends Error {
  readonly code = OCR_QUOTA_CODE

  constructor(message = OCR_QUOTA_MESSAGE) {
    super(message)
    this.name = "OcrQuotaError"
  }
}
