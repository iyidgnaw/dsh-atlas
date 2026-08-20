'use client'

import { useEffect, useRef } from 'react'

/** Whale silhouette in a 240×100 design space: blunt head at the left, swept flukes at the right. */
const WHALE = 'M 12,42 C 15,29 27,23 46,20 C 80,15 118,20 150,29 C 154,30 157,31 160,32 L 167,22 C 169,27 171,30 173,34 C 180,37 185,40 190,44 C 204,30 220,15 238,6 C 238,24 230,42 214,53 C 230,64 238,78 238,94 C 224,84 206,70 190,60 C 172,70 142,80 110,84 C 76,88 38,85 22,75 C 14,70 10,63 10,55 C 9,50 10,46 12,42 Z'
const DESIGN = { width: 240, height: 100 }

const GRID = 21
const DOT = 1.7
const SEA_INK = 'rgba(23, 105, 223, 0.075)'
const WHALE_INK = 'rgba(23, 105, 223, 0.14)'
/** Peak body undulation, in design units, measured at the flukes. */
const SWIM_AMPLITUDE = 9

/** One-bit silhouette mask, sampled per dot to decide whether it belongs to the whale. */
function buildMask() {
  const canvas = document.createElement('canvas')
  canvas.width = DESIGN.width
  canvas.height = DESIGN.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.fillStyle = '#000'
  context.fill(new Path2D(WHALE))
  const { data } = context.getImageData(0, 0, DESIGN.width, DESIGN.height)
  const mask = new Uint8Array(DESIGN.width * DESIGN.height)
  for (let i = 0; i < mask.length; i += 1) mask[i] = data[i * 4 + 3] > 128 ? 1 : 0
  return mask
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * A dot-matrix sea filling the page background. The same grid hides a whale: dots that fall
 * inside its silhouette are drawn a little heavier, so the animal reads as a density shift
 * rather than a picture laid on top. Scrolling drives it — down the page it turns nose-down
 * and dives, up the page it turns nose-up and climbs, its body undulating across the heading.
 */
export function OceanCurrent() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const mask = buildMask()
    if (!mask) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let scale = 1
    let restY = 0
    let whaleY = 0
    let velocity = 0
    let pending = 0
    /** −1 nose-up, 0 level, +1 nose-down. */
    let heading = 0
    let swimPhase = 0
    let seaPhase = 0
    let lastScroll = window.scrollY
    let lastFrame = performance.now()
    let frame = 0

    const measure = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      scale = Math.min(width * 0.62, 760) / DESIGN.width
      restY = height * 0.5
      whaleY = whaleY || restY
    }

    const draw = () => {
      context.clearRect(0, 0, width, height)

      // Nose leads the swim: the silhouette faces left, so −90° points it down the page.
      const angle = heading * -Math.PI / 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const whaleX = width * (width < 900 ? 0.5 : 0.68)
      const halfWidth = DESIGN.width / 2
      const halfHeight = DESIGN.height / 2
      const whaleDots: number[] = []

      context.fillStyle = SEA_INK
      for (let gridY = -GRID; gridY < height + GRID; gridY += GRID) {
        for (let gridX = -GRID; gridX < width + GRID; gridX += GRID) {
          // Two crossing swells, so the surface never repeats on a visible beat.
          const swell = Math.sin(gridX * 0.011 + seaPhase) * 3.1 + Math.sin(gridX * 0.0043 + gridY * 0.0095 - seaPhase * 0.55) * 4.4
          const y = gridY + swell

          const deltaX = gridX - whaleX
          const deltaY = y - whaleY
          const localX = (deltaX * cos + deltaY * sin) / scale
          const sway = clamp((localX + halfWidth) / DESIGN.width, 0, 1)
          const bend = Math.sin(swimPhase + sway * 4.2) * SWIM_AMPLITUDE * sway * sway
          const localY = (-deltaX * sin + deltaY * cos) / scale - bend

          const maskX = Math.round(localX + halfWidth)
          const maskY = Math.round(localY + halfHeight)
          if (maskX >= 0 && maskX < DESIGN.width && maskY >= 0 && maskY < DESIGN.height && mask[maskY * DESIGN.width + maskX]) {
            whaleDots.push(gridX, y)
            continue
          }

          const size = DOT * (0.7 + 0.3 * (swell + 7.5) / 15)
          context.fillRect(gridX - size / 2, y - size / 2, size, size)
        }
      }

      context.fillStyle = WHALE_INK
      const whaleSize = DOT * 1.25
      for (let i = 0; i < whaleDots.length; i += 2) {
        context.fillRect(whaleDots[i] - whaleSize / 2, whaleDots[i + 1] - whaleSize / 2, whaleSize, whaleSize)
      }
    }

    const step = (now: number) => {
      const delta = Math.min((now - lastFrame) / 16.67, 3)
      lastFrame = now

      velocity += pending * 0.08
      pending = 0
      velocity *= 0.94 ** delta
      if (Math.abs(velocity) < 0.02) velocity = 0

      whaleY = clamp(whaleY + velocity * 0.5 * delta, height * 0.24, height * 0.76)
      whaleY += (restY - whaleY) * 0.005 * delta
      heading += (clamp(velocity / 9, -1, 1) - heading) * 0.05 * delta
      // Tail beats harder the faster it swims, but never stops entirely.
      swimPhase += (0.045 + Math.min(Math.abs(velocity), 30) * 0.008) * delta
      seaPhase += 0.006 * delta

      draw()
      frame = requestAnimationFrame(step)
    }

    const onScroll = () => {
      const current = window.scrollY
      pending += current - lastScroll
      lastScroll = current
    }

    const onResize = () => {
      measure()
      if (reduceMotion) draw()
    }

    measure()
    if (reduceMotion) {
      draw()
    } else {
      window.addEventListener('scroll', onScroll, { passive: true })
      frame = requestAnimationFrame(step)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas className="ocean-current" ref={canvasRef} aria-hidden="true" />
}
