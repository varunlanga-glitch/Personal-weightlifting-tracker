// ── generate-icons.js ────────────────────────────────────────
// Run once: node generate-icons.js
// Generates public/icons/icon-192.png and icon-512.png
// Requires: npm install canvas (dev only)
// ─────────────────────────────────────────────────────────────

import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

function drawIcon (size) {
  const canvas = createCanvas(size, size)
  const ctx    = canvas.getContext('2d')
  const r      = size * 0.12

  // Background
  ctx.fillStyle = '#FAF8F4'
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, r)
  ctx.fill()

  // Barbell — horizontal bar
  const barY  = size * 0.52
  const barH  = size * 0.06
  ctx.fillStyle = '#1C1916'
  ctx.fillRect(size * 0.12, barY - barH / 2, size * 0.76, barH)

  // Left plate
  const plateW = size * 0.07
  const plateH = size * 0.36
  ctx.fillStyle = '#8B6F4E'
  ctx.beginPath()
  ctx.roundRect(size * 0.12, barY - plateH / 2, plateW, plateH, 3)
  ctx.fill()

  // Right plate
  ctx.beginPath()
  ctx.roundRect(size - size * 0.12 - plateW, barY - plateH / 2, plateW, plateH, 3)
  ctx.fill()

  // Inner collars
  const collarW = size * 0.04
  const collarH = size * 0.22
  ctx.fillStyle = '#4A4540'
  ctx.fillRect(size * 0.19 + plateW, barY - collarH / 2, collarW, collarH)
  ctx.fillRect(size - size * 0.19 - plateW - collarW, barY - collarH / 2, collarW, collarH)

  return canvas.toBuffer('image/png')
}

mkdirSync(resolve('public/icons'), { recursive: true })

writeFileSync(resolve('public/icons/icon-192.png'), drawIcon(192))
writeFileSync(resolve('public/icons/icon-512.png'), drawIcon(512))

console.log('Icons generated: public/icons/icon-192.png, icon-512.png')
