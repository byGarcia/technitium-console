/*
The side panel's mark: Technitium's maze, redrawn for the console (Adrián's
decision, 2026-11-05). The geometry is the one in `public/img/logo.png` (the two
walls and the block, on the same 48 grid), drawn as rounded strokes inside a
tile tinted with Technitium's blue and a 1 px edge, which is how the console
draws whatever is current. It is inline and not an `<img>` so its colours are
theme tokens (`--brand-*` in `theme/tokens.css`).

Only the side panel and the phone header use it. Login and About keep the
original file, because there the name on screen is Technitium DNS Server.
*/
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect x=".5" y=".5" width="47" height="47" rx="11" fill="var(--brand-tint)" stroke="var(--brand-edge)" />
      <g transform="translate(6 6) scale(.75)">
        <g fill="none" stroke="var(--brand-mark)" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M38.5 1.5V9.5H18.5V18.5H38.5V38.5H46.5" />
          <path d="M1.5 9.5H9.5V29.5H29.5V38.5H9.5V46.5" />
          <rect x="1.5" y="1.5" width="45" height="45" rx="5" />
        </g>
        <rect x="17" y="17" width="14" height="11" rx="2" fill="var(--brand-mark)" />
      </g>
    </svg>
  )
}
