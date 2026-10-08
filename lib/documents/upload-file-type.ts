const MEDIA_NAME = /\.(pdf|jpe?g|png)$/i
const SPREADSHEET_NAME = /\.(csv|xlsx|xls|txt)$/i

export function isOcrMediaFile(file: { name: string }) {
  return MEDIA_NAME.test(file.name)
}

export function isSpreadsheetFile(file: { name: string }) {
  return SPREADSHEET_NAME.test(file.name)
}
