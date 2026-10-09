// Logo: a smiling cat emoji, then ลุงแมว.
// variant 'dark' = for the indigo sidebar, 'light' = for white backgrounds.
const COLORS = {
  dark: { name: '#ffffff' },
  light: { name: '#22006b' },
}

export const LOGO_EMOJI = '😺'

export default function Logo({ variant = 'dark' }) {
  const c = COLORS[variant]
  return (
    <svg viewBox="0 0 200 70" role="img" aria-label="หวยลุงแมว">
      <text x="4" y="50" fontSize="44" fontFamily="'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif">
        {LOGO_EMOJI}
      </text>
      <text x="62" y="47" fontWeight="700" fontSize="34" fill={c.name}>
        ลุงแมว
      </text>
    </svg>
  )
}
