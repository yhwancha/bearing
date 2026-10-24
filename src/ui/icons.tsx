import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 16, ...rest }: P) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  }
}

export const IconOverview = (p: P) => (
  <svg {...base(p)}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
)
export const IconInbox = (p: P) => (
  <svg {...base(p)}><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" /></svg>
)
export const IconFile = (p: P) => (
  <svg {...base(p)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
)
export const IconBox = (p: P) => (
  <svg {...base(p)}><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></svg>
)
export const IconRules = (p: P) => (
  <svg {...base(p)}><path d="M4 6h10M4 12h16M4 18h7" /><circle cx="18" cy="6" r="2" /><circle cx="15" cy="18" r="2" /></svg>
)
export const IconCalendar = (p: P) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
)
export const IconPlus = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconCheck = (p: P) => (
  <svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
)
export const IconX = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const IconAlert = (p: P) => (
  <svg {...base(p)}><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17.5v.01" /></svg>
)
export const IconInfo = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.01" /></svg>
)
export const IconSparkle = (p: P) => (
  <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
)
export const IconDownload = (p: P) => (
  <svg {...base(p)}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
)
export const IconArrowRight = (p: P) => (
  <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)
export const IconChevron = (p: P) => (
  <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
)
export const IconShip = (p: P) => (
  <svg {...base(p)}><path d="M3 15h18l-2.5 5h-13z" /><path d="M6 15V9h12v6M12 9V4M9 4h6" /></svg>
)
export const IconShield = (p: P) => (
  <svg {...base(p)}><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" /></svg>
)
export const IconTruck = (p: P) => (
  <svg {...base(p)}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>
)
export const IconSearch = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
)
export const IconTrash = (p: P) => (
  <svg {...base(p)}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
)
export const IconReset = (p: P) => (
  <svg {...base(p)}><path d="M4 4v6h6" /><path d="M5 15a8 8 0 1 0 1.5-8.5L4 10" /></svg>
)

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="#2DD4BF" strokeWidth="3" />
      <path d="M16 4.5v6M16 21.5v6M4.5 16h6M21.5 16h6" stroke="#2DD4BF" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Singapore flag, simplified for 18×12 display. */
export function FlagSG() {
  return (
    <svg viewBox="0 0 18 12" aria-hidden>
      <rect width="18" height="6" fill="#EF3340" />
      <rect y="6" width="18" height="6" fill="#fff" />
      <circle cx="4.2" cy="3" r="2" fill="#fff" />
      <circle cx="4.9" cy="3" r="1.8" fill="#EF3340" />
    </svg>
  )
}
