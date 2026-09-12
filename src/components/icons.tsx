// Stroked 24x24 icons drawn in currentColor. Deliberately free of Tailwind classes and of any
// router import, so the landing bundle can use the same file as the app.

type IconProps = { size?: number; className?: string }
const base = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true, focusable: false,
})

export function SunIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

export function MoonIcon({ size = 18, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z" /></svg>
}

export function CheckIcon({ size = 18, className }: IconProps) {
  return <svg {...base(size)} className={className} strokeWidth={2.2}><path d="m4.5 12.5 5 5 10-11" /></svg>
}

export function ChevronLeftIcon({ size = 20, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="m15 5-7 7 7 7" /></svg>
}

export function PlayIcon({ size = 20, className }: IconProps) {
  return <svg {...base(size)} className={className} fill="currentColor" stroke="none"><path d="M8 5.5a1 1 0 0 1 1.5-.9l9 6.5a1 1 0 0 1 0 1.7l-9 6.5A1 1 0 0 1 8 18.5Z" /></svg>
}

export function PauseIcon({ size = 20, className }: IconProps) {
  return <svg {...base(size)} className={className} fill="currentColor" stroke="none"><rect x="7" y="5" width="3.6" height="14" rx="1.2" /><rect x="13.4" y="5" width="3.6" height="14" rx="1.2" /></svg>
}

// Map legend keys. These carry the layer's own colour, so they take an explicit one.
export function LegendLine({ colour }: { colour: string }) {
  return <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true" focusable="false"><path d="M0 5h14" stroke={colour} strokeWidth="2" strokeDasharray="3 2" /></svg>
}

export function LegendFill({ colour }: { colour: string }) {
  return <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><rect x="0.5" y="0.5" width="11" height="11" rx="2.5" fill={colour} fillOpacity="0.55" stroke={colour} strokeWidth="1" /></svg>
}

export function LegendDashed({ colour }: { colour: string }) {
  return <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><rect x="0.75" y="0.75" width="10.5" height="10.5" rx="2.5" fill="none" stroke={colour} strokeWidth="1.3" strokeDasharray="2.5 2" /></svg>
}
