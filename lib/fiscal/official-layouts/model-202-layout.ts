import type { FiscalModelDetailResponse } from "@/lib/types/fiscal-panorama"
import type { DraftCasilla, DraftSection } from "@/lib/fiscal/model-draft/types"
import { model202PeriodLabel } from "@/lib/fiscal/model-202"

function sectionTotal(detail: FiscalModelDetailResponse, key: string): number {
  return detail.breakdown.find((section) => section.key === key)?.total ?? 0
}

function casilla(
  id: string,
  code: string,
  label: string,
  amount: number,
  description?: string,
): DraftCasilla {
  return { id, code, label, description, amount, clickable: false }
}

export function buildOfficialModel202Sections(detail: FiscalModelDetailResponse): DraftSection[] {
  const quarter = detail.quarter
  if (quarter === 2) {
    return [
      {
        id: "sin-pago",
        title: "Segundo trimestre",
        casillas: [
          casilla(
            "202-sin-pago",
            "—",
            "Sin pago fraccionado",
            0,
            "El modelo 202 no se presenta en julio. El siguiente pago es el 2P, en octubre.",
          ),
        ],
      },
    ]
  }

  const title =
    quarter === "annual"
      ? model202PeriodLabel("annual", detail.year)
      : model202PeriodLabel(quarter, detail.year)

  if (quarter === "annual") {
    return [
      {
        id: "pagos-del-ejercicio",
        title,
        casillas: [
          casilla(
            "202-total",
            "Suma",
            "Suma de los tres pagos fraccionados",
            detail.amount,
            "1P de abril, 2P de octubre y 3P de diciembre.",
          ),
        ],
      },
    ]
  }

  const isArticle403 = sectionTotal(detail, "modalidad") === 3
  if (!isArticle403) {
    const missingQuota = sectionTotal(detail, "aviso-cuota") > 0
    return [
      {
        id: "articulo-40-2",
        title: `${title} · artículo 40.2`,
        casillas: [
          ...(missingQuota
            ? [
                casilla(
                  "202-aviso",
                  "01",
                  "Falta la cuota del último impuesto",
                  0,
                  "Indica en la configuración del modelo la cuota neta del último impuesto ya vencido. El pago es el 18 % de esa cuota, el mismo en abril, octubre y diciembre.",
                ),
              ]
            : [
                casilla(
                  "202-c01",
                  "01",
                  "Base del pago fraccionado",
                  sectionTotal(detail, "c01"),
                  "Cuota íntegra del último ejercicio cuyo plazo de declaración ya ha vencido, minorada por las deducciones, bonificaciones y retenciones de ese ejercicio.",
                ),
                casilla(
                  "202-c03",
                  "03",
                  "A ingresar",
                  sectionTotal(detail, "c03"),
                  "El 18 % de la casilla 01. No se restan los pagos fraccionados anteriores de este año.",
                ),
              ]),
        ],
      },
    ]
  }

  return [
    {
      id: "articulo-40-3",
      title: `${title} · artículo 40.3`,
      casillas: [
        casilla(
          "202-c04",
          "04",
          "Resultado contable después del impuesto",
          sectionTotal(detail, "c04"),
          "Grupos 6 y 7, incluida la cuenta 630, de los meses del pago.",
        ),
        casilla("202-c05", "05", "Aumento por impuesto sobre sociedades", sectionTotal(detail, "c05")),
        casilla("202-c06", "06", "Disminución por impuesto sobre sociedades", sectionTotal(detail, "c06")),
        casilla(
          "202-c07",
          "07",
          "Resto de aumentos",
          sectionTotal(detail, "c07"),
          "Diferencia entre amortización contable y fiscal de las fichas de inmovilizado, más los aumentos indicados en la configuración.",
        ),
        casilla("202-c08", "08", "Resto de disminuciones", sectionTotal(detail, "c08")),
        casilla("202-c13", "13", "Base imponible previa", sectionTotal(detail, "c13")),
        casilla("202-c14", "14", "Compensación de bases negativas", sectionTotal(detail, "c14")),
        casilla("202-c16", "16", "Base del pago fraccionado", sectionTotal(detail, "c16")),
        casilla(
          "202-c17",
          "17",
          "Porcentaje",
          sectionTotal(detail, "c17"),
          "Cinco séptimos del tipo, por defecto. Diecinueve veinteavos por exceso si la cifra de negocios es de al menos 10 millones.",
        ),
        casilla("202-c18", "18", "Cuota", sectionTotal(detail, "c18")),
        casilla(
          "202-c28",
          "28",
          "Retenciones e ingresos a cuenta",
          sectionTotal(detail, "c28"),
          "Cuenta 473 de los meses del pago.",
        ),
        casilla("202-c30", "30", "Pagos fraccionados anteriores", sectionTotal(detail, "c30")),
        casilla("202-c32", "32", "Resultado", sectionTotal(detail, "c32")),
        casilla(
          "202-c33",
          "33",
          "Mínimo a ingresar",
          sectionTotal(detail, "c33"),
          "Solo si la cifra de negocios es de al menos 10 millones: el 23 % del resultado contable positivo, menos los pagos anteriores.",
        ),
        casilla("202-c34", "34", "Cantidad a ingresar", sectionTotal(detail, "c34")),
      ],
    },
  ]
}
