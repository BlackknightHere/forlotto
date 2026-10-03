// Logo "ป้ายสลาก": the word หวย on a lottery-ticket badge (notched edges + perforation), then ลุงแมว.
// variant 'dark' = for the indigo sidebar, 'light' = for white backgrounds.
const COLORS = {
  dark: { badge: '#fbbf2e', badgeText: '#22006b', name: '#ffffff' },
  light: { badge: '#22006b', badgeText: '#ffffff', name: '#22006b' },
}

export const TICKET_PATH = 'M8 10 h82 v16 a9 9 0 0 0 0 18 v16 h-82 v-16 a9 9 0 0 0 0 -18 z'

export default function Logo({ variant = 'dark' }) {
  const c = COLORS[variant]
  return (
    <svg viewBox="0 0 252 70" role="img" aria-label="หวยลุงแมว">
      <path d={TICKET_PATH} fill={c.badge} />
      <line x1="70" y1="16" x2="70" y2="54" stroke={c.badgeText} strokeWidth="2" strokeDasharray="4 4" opacity="0.55" />
      <text x="38" y="44" textAnchor="middle" fontWeight="700" fontSize="22" fill={c.badgeText}>
        หวย
      </text>
      <text x="104" y="47" fontWeight="700" fontSize="34" fill={c.name}>
        ลุงแมว
      </text>
    </svg>
  )
}
