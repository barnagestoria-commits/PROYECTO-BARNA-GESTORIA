import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas"
import { copyFileSync, mkdirSync, writeFileSync } from "fs"
import { homedir } from "os"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = join(ROOT, "public", "brand", "redes")
const DESKTOP = join(homedir(), "Desktop", "TAXLYN-redes")
mkdirSync(OUT, { recursive: true })
mkdirSync(DESKTOP, { recursive: true })

const PINE = "#083A26"
const GOLD = "#C49B5C"
const GRAPHITE = "#2C2C2C"

GlobalFonts.registerFromPath(join(ROOT, "fonts/PlayfairDisplay.ttf"), "TaxlynPlayfair")
GlobalFonts.registerFromPath("/System/Library/Fonts/Avenir Next.ttc", "Avenir Next")

const logo = await loadImage(join(ROOT, "public/brand/taxlyn-redes-1080.png"))
const sample = createCanvas(logo.width, logo.height).getContext("2d")
sample.drawImage(logo, 0, 0)
const creamPx = sample.getImageData(12, 12, 1, 1).data
const CREAM = `rgb(${creamPx[0]}, ${creamPx[1]}, ${creamPx[2]})`

const MARK = { cx: 541, cy: 405, rOuter: 259, rInner: 239 }

function wrap(ctx, text, maxWidth) {
  const words = text.split(" ")
  const lines = []
  let line = ""
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function tracked(ctx, text, x, y, tracking) {
  const letters = [...text]
  const widths = letters.map((letter) => ctx.measureText(letter).width)
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (letters.length - 1)
  let cursor = x - total / 2
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  letters.forEach((letter, i) => {
    ctx.fillText(letter, cursor, y)
    cursor += widths[i] + tracking
  })
}

function save(canvas, name) {
  const file = join(OUT, name)
  writeFileSync(file, canvas.toBuffer("image/png"))
  copyFileSync(file, join(DESKTOP, name))
  console.log(file)
}

function feed() {
  const c = createCanvas(1080, 1080)
  const ctx = c.getContext("2d")
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, 1080, 1080)
  return { c, ctx }
}

function story() {
  const c = createCanvas(1080, 1920)
  const ctx = c.getContext("2d")
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, 1080, 1920)
  return { c, ctx }
}

function goldRule(ctx, x, y, w) {
  ctx.fillStyle = GOLD
  ctx.fillRect(x, y, w, 3)
}

function drawMark(ctx, x, y, size, onDark = false) {
  const { cx, cy, rOuter, rInner } = MARK
  const r = onDark ? rInner : rOuter
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(logo, cx - r, cy - r, r * 2, r * 2, x, y, size, size)
  ctx.restore()
}

function footerWord(ctx, y = 1008) {
  ctx.fillStyle = PINE
  ctx.font = "700 28px TaxlynPlayfair"
  tracked(ctx, "TAXLYN", 540, y, 6)
  ctx.font = "500 18px Avenir Next"
  ctx.fillStyle = GRAPHITE
  ctx.textAlign = "center"
  ctx.fillText("taxlyn.com", 540, y + 36)
}

{
  const { c, ctx } = feed()
  ctx.drawImage(logo, 0, 0, 1080, 1080)
  goldRule(ctx, 455, 900, 170)
  ctx.fillStyle = GRAPHITE
  ctx.font = "500 22px Avenir Next"
  ctx.textAlign = "center"
  ctx.fillText("Contable  ·  fiscal  ·  laboral", 540, 960)
  ctx.font = "500 18px Avenir Next"
  ctx.fillText("taxlyn.com", 540, 1010)
  save(c, "01-lanzamiento.png")
}

{
  const { c, ctx } = feed()
  drawMark(ctx, 400, 88, 280)
  goldRule(ctx, 430, 408, 220)
  ctx.fillStyle = PINE
  ctx.font = "700 64px TaxlynPlayfair"
  ctx.textAlign = "center"
  ;["Contable.", "Fiscal.", "Laboral."].forEach((line, i) => {
    ctx.fillText(line, 540, 520 + i * 88)
  })
  ctx.font = "500 24px Avenir Next"
  ctx.fillStyle = GRAPHITE
  ctx.fillText("Para empresas y autónomos.", 540, 820)
  ctx.fillText("Desde Barcelona.", 540, 860)
  footerWord(ctx)
  save(c, "02-promesa.png")
}

{
  const { c, ctx } = feed()
  drawMark(ctx, 48, 44, 88)
  ctx.fillStyle = GOLD
  ctx.font = "600 18px Avenir Next"
  ctx.textAlign = "left"
  ctx.fillText("CIERRE 2026", 156, 98)
  ctx.fillStyle = PINE
  ctx.font = "700 52px TaxlynPlayfair"
  wrap(ctx, "Tres cosas que no deberías dejar para enero.", 920).forEach((line, i) => {
    ctx.fillText(line, 72, 230 + i * 66)
  })
  goldRule(ctx, 72, 390, 140)
  const items = [
    ["01", "Reúne facturas emitidas y recibidas"],
    ["02", "Revisa gastos que sí son deducibles"],
    ["03", "Deja la contabilidad al día, no a destajo"],
  ]
  items.forEach((item, i) => {
    const y = 490 + i * 100
    ctx.fillStyle = GOLD
    ctx.font = "700 28px TaxlynPlayfair"
    ctx.fillText(item[0], 72, y)
    ctx.fillStyle = PINE
    ctx.font = "500 30px Avenir Next"
    ctx.fillText(item[1], 160, y)
  })
  footerWord(ctx)
  save(c, "03-cierre-2026.png")
}

{
  const { c, ctx } = feed()
  ctx.fillStyle = PINE
  ctx.fillRect(0, 0, 1080, 1080)
  ctx.fillStyle = CREAM
  ctx.font = "700 58px TaxlynPlayfair"
  ctx.textAlign = "left"
  wrap(ctx, "Las facturas de diciembre no son de enero.", 860).forEach((line, i) => {
    ctx.fillText(line, 90, 280 + i * 76)
  })
  ctx.fillStyle = GOLD
  ctx.fillRect(90, 500, 160, 3)
  ctx.fillStyle = CREAM
  ctx.font = "500 28px Avenir Next"
  wrap(ctx, "Si ha pasado en 2026, se contabiliza en 2026. El cierre no se improvisa.", 860).forEach((line, i) => {
    ctx.fillText(line, 90, 580 + i * 42)
  })
  ctx.font = "600 22px Avenir Next"
  ctx.fillStyle = GOLD
  ctx.fillText("TAXLYN", 90, 980)
  save(c, "04-facturas.png")
}

{
  const { c, ctx } = feed()
  ctx.fillStyle = PINE
  ctx.font = "700 48px TaxlynPlayfair"
  ctx.textAlign = "left"
  ctx.fillText("Cómo trabajamos", 80, 160)
  goldRule(ctx, 80, 196, 160)
  const steps = [
    ["1", "Subes", "Facturas, tickets y extractos."],
    ["2", "Organizamos", "Cada documento, en su sitio."],
    ["3", "Contabilizamos", "Tú, al negocio. Nosotras, a la ficha."],
  ]
  steps.forEach((step, i) => {
    const y = 300 + i * 200
    ctx.fillStyle = GOLD
    ctx.font = "700 42px TaxlynPlayfair"
    ctx.fillText(step[0], 80, y)
    ctx.fillStyle = PINE
    ctx.font = "700 36px TaxlynPlayfair"
    ctx.fillText(step[1], 160, y)
    ctx.font = "500 26px Avenir Next"
    ctx.fillStyle = GRAPHITE
    ctx.fillText(step[2], 160, y + 48)
  })
  footerWord(ctx)
  save(c, "05-proceso.png")
}

{
  const { c, ctx } = feed()
  drawMark(ctx, 48, 44, 88)
  ctx.fillStyle = PINE
  ctx.font = "700 52px TaxlynPlayfair"
  ctx.textAlign = "left"
  wrap(ctx, "Ser autónomo no tiene que ser un segundo trabajo.", 920).forEach((line, i) => {
    ctx.fillText(line, 72, 250 + i * 70)
  })
  goldRule(ctx, 72, 430, 140)
  ctx.font = "500 28px Avenir Next"
  ctx.fillStyle = GRAPHITE
  wrap(
    ctx,
    "IVA, IRPF, cuota y facturas. Nosotras nos ocupamos de la parte fea. Tú, del negocio.",
    920,
  ).forEach((line, i) => {
    ctx.fillText(line, 72, 520 + i * 44)
  })
  footerWord(ctx)
  save(c, "06-autonomos.png")
}

{
  const { c, ctx } = feed()
  ctx.fillStyle = PINE
  ctx.fillRect(0, 0, 1080, 1080)
  drawMark(ctx, 390, 110, 300, true)
  ctx.fillStyle = CREAM
  ctx.font = "700 52px TaxlynPlayfair"
  ctx.textAlign = "center"
  ctx.fillText("¿Hablamos?", 540, 520)
  ctx.fillStyle = GOLD
  ctx.fillRect(470, 556, 140, 3)
  ctx.fillStyle = CREAM
  ctx.font = "500 26px Avenir Next"
  ctx.fillText("WhatsApp", 540, 650)
  ctx.font = "700 44px Avenir Next"
  ctx.fillText("+34 634 090 785", 540, 716)
  ctx.font = "500 24px Avenir Next"
  ctx.fillStyle = GOLD
  ctx.fillText("taxlyn.com", 540, 960)
  save(c, "07-whatsapp.png")
}

{
  const { c, ctx } = feed()
  ctx.fillStyle = GOLD
  ctx.font = "700 140px TaxlynPlayfair"
  ctx.fillText("“", 70, 250)
  ctx.fillStyle = PINE
  ctx.font = "700 48px TaxlynPlayfair"
  wrap(ctx, "La gestoría no es un gasto. Es no llegar tarde a Hacienda.", 860).forEach((line, i) => {
    ctx.fillText(line, 90, 340 + i * 68)
  })
  goldRule(ctx, 90, 620, 140)
  ctx.font = "500 24px Avenir Next"
  ctx.fillStyle = GRAPHITE
  ctx.fillText("Taxlyn · Barcelona", 90, 700)
  footerWord(ctx)
  save(c, "08-frase.png")
}

{
  const { c, ctx } = story()
  drawMark(ctx, 270, 280, 540)
  ctx.fillStyle = PINE
  ctx.font = "700 72px TaxlynPlayfair"
  tracked(ctx, "TAXLYN", 540, 940, 8)
  goldRule(ctx, 430, 990, 220)
  ctx.fillStyle = PINE
  ctx.font = "700 42px TaxlynPlayfair"
  ctx.textAlign = "center"
  ctx.fillText("Ya somos Taxlyn", 540, 1080)
  ctx.font = "500 24px Avenir Next"
  ctx.fillStyle = GRAPHITE
  ctx.fillText("Contable  ·  fiscal  ·  laboral", 540, 1148)
  ctx.fillText("Desliza para escribirnos", 540, 1680)
  ctx.font = "600 22px Avenir Next"
  ctx.fillStyle = PINE
  ctx.fillText("taxlyn.com", 540, 1740)
  save(c, "story-01-lanzamiento.png")
}

{
  const { c, ctx } = story()
  ctx.fillStyle = PINE
  ctx.fillRect(0, 0, 1080, 1920)
  ctx.fillStyle = GOLD
  ctx.font = "600 22px Avenir Next"
  ctx.textAlign = "center"
  ctx.fillText("NOVIEMBRE 2026", 540, 320)
  ctx.fillStyle = CREAM
  ctx.font = "700 62px TaxlynPlayfair"
  wrap(ctx, "El año se cierra ahora, no el 7 de enero.", 860).forEach((line, i) => {
    ctx.fillText(line, 540, 460 + i * 84)
  })
  ctx.fillStyle = GOLD
  ctx.fillRect(470, 760, 140, 3)
  ctx.fillStyle = CREAM
  ctx.font = "500 28px Avenir Next"
  wrap(ctx, "Si te faltan facturas, este es el momento.", 800).forEach((line, i) => {
    ctx.fillText(line, 540, 860 + i * 44)
  })
  ctx.font = "600 26px Avenir Next"
  ctx.fillText("WhatsApp  634 090 785", 540, 1600)
  ctx.font = "700 28px TaxlynPlayfair"
  ctx.fillStyle = GOLD
  ctx.fillText("TAXLYN", 540, 1720)
  save(c, "story-02-cierre.png")
}

{
  const { c, ctx } = story()
  ctx.fillStyle = PINE
  ctx.fillRect(0, 0, 1080, 1920)
  drawMark(ctx, 330, 380, 420, true)
  ctx.fillStyle = CREAM
  ctx.font = "700 52px TaxlynPlayfair"
  ctx.textAlign = "center"
  ctx.fillText("¿Hablamos?", 540, 920)
  goldRule(ctx, 430, 960, 220)
  ctx.fillStyle = CREAM
  ctx.font = "500 26px Avenir Next"
  ctx.fillText("WhatsApp", 540, 1080)
  ctx.font = "700 40px Avenir Next"
  ctx.fillText("+34 634 090 785", 540, 1150)
  ctx.font = "500 24px Avenir Next"
  ctx.fillStyle = GOLD
  ctx.fillText("taxlyn.com", 540, 1680)
  save(c, "story-03-whatsapp.png")
}

const highlights = [
  ["Servicios", "h-servicios.png"],
  ["Fiscal", "h-fiscal.png"],
  ["Laboral", "h-laboral.png"],
  ["Autónomos", "h-autonomos.png"],
  ["Contacto", "h-contacto.png"],
  ["Taxlyn", "h-taxlyn.png"],
]
for (const [label, name] of highlights) {
  const c = createCanvas(1080, 1080)
  const ctx = c.getContext("2d")
  ctx.fillStyle = PINE
  ctx.fillRect(0, 0, 1080, 1080)
  ctx.fillStyle = GOLD
  ctx.fillRect(470, 430, 140, 3)
  ctx.fillStyle = CREAM
  ctx.font = "700 54px TaxlynPlayfair"
  ctx.textAlign = "center"
  ctx.fillText(label, 540, 560)
  save(c, name)
}

{
  const c = createCanvas(1584, 396)
  const ctx = c.getContext("2d")
  ctx.fillStyle = PINE
  ctx.fillRect(0, 0, 1584, 396)
  drawMark(ctx, 80, 58, 280, true)
  ctx.fillStyle = CREAM
  ctx.font = "700 54px TaxlynPlayfair"
  ctx.textAlign = "left"
  ctx.fillText("TAXLYN", 420, 175)
  ctx.font = "500 26px Avenir Next"
  ctx.fillStyle = GOLD
  ctx.fillText("Contable  ·  fiscal  ·  laboral", 420, 230)
  ctx.fillStyle = CREAM
  ctx.font = "500 20px Avenir Next"
  ctx.fillText("Barcelona  ·  taxlyn.com  ·  634 090 785", 420, 280)
  save(c, "linkedin-portada.png")
}

copyFileSync(join(OUT, "../taxlyn-perfil-redondo-cuadrado-1080.png"), join(DESKTOP, "PERFIL-instagram.png"))
copyFileSync(join(ROOT, "public/brand/redes/COPIA-Y-PUBLICA.md"), join(DESKTOP, "COPIA-Y-PUBLICA.md"))
