/** Posiciones DR303e26v101. Las casillas numéricas no pueden ir en blanco. */
export const MODEL_303_PAGE_01000_LENGTH = 1581

export interface Model303FieldSpec {
  casilla: string
  position: number
  length: number
  signed: boolean
  kind: "amount" | "percent"
  /** Valor fijo del diseño. Los tipos del régimen general no se infieren. */
  constant?: string
}

export const MODEL_303_PAGE_01000_FIELDS: Model303FieldSpec[] = [
  { casilla: "150", position: 131, length: 17, signed: false, kind: "amount" },
  { casilla: "151", position: 148, length: 5, signed: false, kind: "percent", constant: "00000" },
  { casilla: "152", position: 153, length: 17, signed: false, kind: "amount" },
  { casilla: "165", position: 170, length: 17, signed: false, kind: "amount" },
  { casilla: "166", position: 187, length: 5, signed: false, kind: "percent", constant: "00000" },
  { casilla: "167", position: 192, length: 17, signed: false, kind: "amount" },
  { casilla: "01", position: 209, length: 17, signed: false, kind: "amount" },
  { casilla: "02", position: 226, length: 5, signed: false, kind: "percent", constant: "00400" },
  { casilla: "03", position: 231, length: 17, signed: false, kind: "amount" },
  { casilla: "153", position: 248, length: 17, signed: false, kind: "amount" },
  { casilla: "154", position: 265, length: 5, signed: false, kind: "percent", constant: "00000" },
  { casilla: "155", position: 270, length: 17, signed: false, kind: "amount" },
  { casilla: "04", position: 287, length: 17, signed: false, kind: "amount" },
  { casilla: "05", position: 304, length: 5, signed: false, kind: "percent", constant: "01000" },
  { casilla: "06", position: 309, length: 17, signed: false, kind: "amount" },
  { casilla: "07", position: 326, length: 17, signed: false, kind: "amount" },
  { casilla: "08", position: 343, length: 5, signed: false, kind: "percent", constant: "02100" },
  { casilla: "09", position: 348, length: 17, signed: false, kind: "amount" },
  { casilla: "10", position: 365, length: 17, signed: false, kind: "amount" },
  { casilla: "11", position: 382, length: 17, signed: false, kind: "amount" },
  { casilla: "12", position: 399, length: 17, signed: false, kind: "amount" },
  { casilla: "13", position: 416, length: 17, signed: false, kind: "amount" },
  { casilla: "14", position: 433, length: 17, signed: true, kind: "amount" },
  { casilla: "15", position: 450, length: 17, signed: true, kind: "amount" },
  { casilla: "156", position: 467, length: 17, signed: false, kind: "amount" },
  { casilla: "157", position: 484, length: 5, signed: false, kind: "percent", constant: "00175" },
  { casilla: "158", position: 489, length: 17, signed: false, kind: "amount" },
  { casilla: "168", position: 506, length: 17, signed: false, kind: "amount" },
  { casilla: "169", position: 523, length: 5, signed: false, kind: "percent", constant: "00050" },
  { casilla: "170", position: 528, length: 17, signed: false, kind: "amount" },
  { casilla: "16", position: 545, length: 17, signed: false, kind: "amount" },
  { casilla: "17", position: 562, length: 5, signed: false, kind: "percent", constant: "00000" },
  { casilla: "18", position: 567, length: 17, signed: false, kind: "amount" },
  { casilla: "19", position: 584, length: 17, signed: false, kind: "amount" },
  { casilla: "20", position: 601, length: 5, signed: false, kind: "percent", constant: "00140" },
  { casilla: "21", position: 606, length: 17, signed: false, kind: "amount" },
  { casilla: "22", position: 623, length: 17, signed: false, kind: "amount" },
  { casilla: "23", position: 640, length: 5, signed: false, kind: "percent", constant: "00520" },
  { casilla: "24", position: 645, length: 17, signed: false, kind: "amount" },
  { casilla: "25", position: 662, length: 17, signed: true, kind: "amount" },
  { casilla: "26", position: 679, length: 17, signed: true, kind: "amount" },
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
  { casilla: "40", position: 917, length: 17, signed: true, kind: "amount" },
  { casilla: "41", position: 934, length: 17, signed: true, kind: "amount" },
  { casilla: "42", position: 951, length: 17, signed: true, kind: "amount" },
  { casilla: "43", position: 968, length: 17, signed: true, kind: "amount" },
  { casilla: "44", position: 985, length: 17, signed: true, kind: "amount" },
  { casilla: "45", position: 1002, length: 17, signed: true, kind: "amount" },
  { casilla: "46", position: 1019, length: 17, signed: true, kind: "amount" },
]

/** Posiciones DR303e26v101 — página 03000 (resultado). */
export const MODEL_303_PAGE_03000_LENGTH = 1017

export const MODEL_303_PAGE_03000_FIELDS: Model303FieldSpec[] = [
  { casilla: "59", position: 12, length: 17, signed: true, kind: "amount" },
  { casilla: "60", position: 29, length: 17, signed: true, kind: "amount" },
  { casilla: "120", position: 46, length: 17, signed: true, kind: "amount" },
  { casilla: "122", position: 63, length: 17, signed: true, kind: "amount" },
  { casilla: "123", position: 80, length: 17, signed: true, kind: "amount" },
  { casilla: "124", position: 97, length: 17, signed: true, kind: "amount" },
  { casilla: "62", position: 114, length: 17, signed: true, kind: "amount" },
  { casilla: "63", position: 131, length: 17, signed: true, kind: "amount" },
  { casilla: "74", position: 148, length: 17, signed: true, kind: "amount" },
  { casilla: "75", position: 165, length: 17, signed: true, kind: "amount" },
  { casilla: "76", position: 182, length: 17, signed: true, kind: "amount" },
  { casilla: "64", position: 199, length: 17, signed: true, kind: "amount" },
  { casilla: "65", position: 216, length: 5, signed: false, kind: "percent", constant: "10000" },
  { casilla: "66", position: 221, length: 17, signed: true, kind: "amount" },
  { casilla: "77", position: 238, length: 17, signed: false, kind: "amount" },
  { casilla: "110", position: 255, length: 17, signed: false, kind: "amount" },
  { casilla: "78", position: 272, length: 17, signed: false, kind: "amount" },
  { casilla: "87", position: 289, length: 17, signed: false, kind: "amount" },
  { casilla: "68", position: 306, length: 17, signed: true, kind: "amount" },
  { casilla: "108", position: 323, length: 17, signed: true, kind: "amount" },
  { casilla: "69", position: 340, length: 17, signed: true, kind: "amount" },
  { casilla: "70", position: 357, length: 17, signed: false, kind: "amount" },
  { casilla: "109", position: 374, length: 17, signed: false, kind: "amount" },
  { casilla: "112", position: 391, length: 17, signed: false, kind: "amount" },
  { casilla: "71", position: 408, length: 17, signed: true, kind: "amount" },
  { casilla: "111", position: 441, length: 17, signed: false, kind: "amount" },
]
