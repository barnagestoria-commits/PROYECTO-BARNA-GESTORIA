import { createCanvas, GlobalFonts } from "@napi-rs/canvas"
import { mkdirSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const PINE = "#083A26"
const CREAM = "#F7F4EC"
const GOLD = "#C49B5C"
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = join(ROOT, "public", "brand")
const IMAGES = join(ROOT, "public", "images")

mkdirSync(OUT, { recursive: true })

GlobalFonts.registerFromPath("/System/Library/Fonts/Supplemental/Didot.ttc", "TaxlynDidot")
GlobalFonts.registerFromPath(join(ROOT, "fonts/PlayfairDisplay.ttf"), "TaxlynPlayfair")

function drawLeaf(ctx, cx, cy, length, width, angle) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(-length / 2, 0)
  ctx.bezierCurveTo(-length * 0.12, -width, length * 0.22, -width * 0.78, length / 2, 0)
  ctx.bezierCurveTo(length * 0.22, width * 0.78, -length * 0.12, width, -length / 2, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function roundRect(ctx, x, y, w, h, r, color) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function drawTrackedText(ctx, text, centerX, y, tracking) {
  const widths = [...text].map((letter) => ctx.measureText(letter).width)
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * (text.length - 1)
  let x = centerX - total / 2
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  for (let i = 0; i < text.length; i += 1) {
    ctx.fillText(text[i], x, y)
    x += widths[i] + tracking
  }
}

function drawMark(ctx, cx, cy, diameter) {
  const s = diameter / 200
  ctx.save()
  ctx.translate(cx - 100 * s, cy - 100 * s)
  ctx.scale(s, s)

  ctx.beginPath()
  ctx.arc(100, 100, 84, 0, Math.PI * 2)
  ctx.fillStyle = CREAM
  ctx.fill()
  ctx.lineWidth = 5.5
  ctx.strokeStyle = PINE
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(100, 100, 78, 0, Math.PI * 2)
  ctx.clip()

  roundRect(ctx, 84, 58, 12, 72, 1.4, GOLD)
  roundRect(ctx, 101, 38, 12, 92, 1.4, PINE)
  roundRect(ctx, 118, 24, 12, 106, 1.4, PINE)

  ctx.fillStyle = PINE
  drawLeaf(ctx, 72, 148, 100, 30, -0.5)
  drawLeaf(ctx, 132, 152, 108, 28, 0.44)
  ctx.restore()
}

function exportPng(dir, name, size, paint) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext("2d")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  paint(ctx, size)
  const file = join(dir, name)
  writeFileSync(file, canvas.toBuffer("image/png"))
  console.log(file)
}

function paintLockup(ctx, size) {
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, size, size)
  const mark = size * 0.46
  drawMark(ctx, size / 2, size * 0.4, mark)
  ctx.fillStyle = PINE
  ctx.font = `700 ${Math.round(size * 0.1)}px TaxlynPlayfair, TaxlynDidot`
  drawTrackedText(ctx, "TAXLYN", size / 2, size * 0.7, size * 0.014)
}

function paintIcon(ctx, size) {
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, size, size)
  drawMark(ctx, size / 2, size / 2, size * 0.86)
}

function paintCircleBadge(ctx, size) {
  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(0, 0, size, size)
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fillStyle = CREAM
  ctx.fill()
  drawMark(ctx, size / 2, size / 2, size * 0.72)
}

exportPng(OUT, "taxlyn-redes-1080.png", 1080, paintLockup)
exportPng(OUT, "taxlyn-redes-400.png", 400, paintLockup)
exportPng(OUT, "taxlyn-perfil-1080.png", 1080, paintIcon)
exportPng(OUT, "taxlyn-perfil-400.png", 400, paintIcon)
exportPng(OUT, "taxlyn-circulo-1080.png", 1080, paintCircleBadge)
exportPng(IMAGES, "taxlyn-avatar.png", 1080, paintLockup)
exportPng(IMAGES, "taxlyn-mark.png", 1024, paintIcon)
exportPng(IMAGES, "taxlyn-loading.png", 1024, paintCircleBadge)
exportPng(IMAGES, "taxlyn-hero.png", 1024, paintLockup)
