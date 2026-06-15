/**
 * Iconic answer shapes — triangle, diamond, circle, square.
 * Inline SVG, currentColor fill. Proportions tuned: equilateral triangle
 * pointing up, perfect rotated-square diamond, circle slightly larger than
 * the inscribed circle, rounded-corner square (~8% radius).
 */

import type { SVGProps } from 'react'

type ShapeName = 'triangle' | 'diamond' | 'circle' | 'square'

interface ShapeProps extends SVGProps<SVGSVGElement> {
  shape: ShapeName
}

export function Shape({ shape, ...rest }: ShapeProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      stroke="none"
      aria-hidden
      {...rest}
    >
      {/* Equilateral triangle pointing up. Side ~70, centered at (50, 53). */}
      {shape === 'triangle' && <polygon points="50,15 85,77 15,77" />}
      {/* Square rotated 45° → diamond. Inscribed in the 100x100 box. */}
      {shape === 'diamond' && <polygon points="50,12 88,50 50,88 12,50" />}
      {/* Circle, generous. */}
      {shape === 'circle' && <circle cx="50" cy="50" r="38" />}
      {/* Square with ~8% radius rounded corners. */}
      {shape === 'square' && <rect x="14" y="14" width="72" height="72" rx="8" />}
    </svg>
  )
}
