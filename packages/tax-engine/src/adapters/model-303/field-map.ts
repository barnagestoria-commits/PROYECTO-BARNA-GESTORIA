/** Posiciones DR303e26v101 — página 01000 (régimen general). */
export const MODEL_303_PAGE_01000_LENGTH = 1581

export interface Model303FieldSpec {
  casilla: string
  position: number
  length: number
  signed: boolean
  kind: "amount" | "percent"
}

export const MODEL_303_PAGE_01000_FIELDS: Model303FieldSpec[] = [
  { casilla: "01", position: 209, length: 17, signed: false, kind: "amount" },
  { casilla: "02", position: 226, length: 5, signed: false, kind: "percent" },
  { casilla: "03", position: 231, length: 17, signed: false, kind: "amount" },
  { casilla: "04", position: 287, length: 17, signed: false, kind: "amount" },
  { casilla: "05", position: 304, length: 5, signed: false, kind: "percent" },
  { casilla: "06", position: 309, length: 17, signed: false, kind: "amount" },
  { casilla: "07", position: 326, length: 17, signed: false, kind: "amount" },
  { casilla: "08", position: 343, length: 5, signed: false, kind: "percent" },
  { casilla: "09", position: 348, length: 17, signed: false, kind: "amount" },
  { casilla: "10", position: 365, length: 17, signed: false, kind: "amount" },
  { casilla: "11", position: 382, length: 17, signed: false, kind: "amount" },
  { casilla: "12", position: 399, length: 17, signed: false, kind: "amount" },
  { casilla: "13", position: 416, length: 17, signed: false, kind: "amount" },
  { casilla: "27", position: 696, length: 17, signed: true, kind: "amount" },
  { casilla: "28", position: 713, length: 17, signed: false, kind: "amount" },
  { casilla: "29", position: 730, length: 17, signed: false, kind: "amount" },
  { casilla: "30", position: 747, length: 17, signed: false, kind: "amount" },
  { casilla: "31", position: 764, length: 17, signed: false, kind: "amount" },
  { casilla: "32", position: 781, length: 17, signed: false, kind: "amount" },
  { casilla: "33", position: 798, length: 17, signed: false, kind: "amount" },
  { casilla: "34", position: 815, length: 17, signed: false, kind: "amount" },
  { casilla: "35", position: 832, length: 17, signed: false, kind: "amount" },
  { casilla: "36", position: 849, length: 17, signed: false, kind: "amount" },
  { casilla: "37", position: 866, length: 17, signed: false, kind: "amount" },
  { casilla: "38", position: 883, length: 17, signed: false, kind: "amount" },
  { casilla: "39", position: 900, length: 17, signed: false, kind: "amount" },
  { casilla: "45", position: 1002, length: 17, signed: true, kind: "amount" },
  { casilla: "46", position: 1019, length: 17, signed: true, kind: "amount" },
]

/** Posiciones DR303e26v101 — página 03000 (resultado). */
export const MODEL_303_PAGE_03000_LENGTH = 1017

export const MODEL_303_PAGE_03000_FIELDS: Model303FieldSpec[] = [
  { casilla: "64", position: 199, length: 17, signed: true, kind: "amount" },
  { casilla: "65", position: 216, length: 5, signed: false, kind: "percent" },
  { casilla: "66", position: 221, length: 17, signed: true, kind: "amount" },
  { casilla: "110", position: 255, length: 17, signed: false, kind: "amount" },
  { casilla: "69", position: 340, length: 17, signed: true, kind: "amount" },
  { casilla: "71", position: 408, length: 17, signed: true, kind: "amount" },
]

export const MODEL_303_PERCENT_PAIRS: Array<{ base: string; percent: string; defaultRate: number }> = [
  { base: "01", percent: "02", defaultRate: 21 },
  { base: "04", percent: "05", defaultRate: 10 },
  { base: "07", percent: "08", defaultRate: 4 },
]
