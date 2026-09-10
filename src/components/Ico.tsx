import { ICONS, type IconKey } from '../lib/icons'

interface IcoProps {
  icon: IconKey
  size?: number   // CSS px, default 20
  style?: React.CSSProperties
  title?: string
}

/**
 * Icon component — renders an SVG from /public/assets.
 * Usage: <Ico icon="loadImage" size={22} />
 * To swap icon variant, change ICONS[key] in src/lib/icons.ts
 */
export default function Ico({ icon, size = 20, style, title }: IcoProps) {
  return (
    <img
      src={ICONS[icon]}
      width={size}
      height={size}
      alt={title ?? icon}
      title={title}
      draggable={false}
      style={{
        display: 'block',
        flexShrink: 0,
        filter: 'invert(1) opacity(0.85)',  // white icons on dark bg
        ...style,
      }}
    />
  )
}