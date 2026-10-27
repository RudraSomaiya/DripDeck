import { useEffect, useRef, type ReactNode } from 'react'

// Outline icons on a 24px grid. Decorative: the button around each one carries the label.
const PATHS = {
  hanger: 'M9.5 6.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1V11m0 0 8.4 5.6c.8.5.4 1.4-.4 1.4H4c-.8 0-1.2-.9-.4-1.4z',
  shuffle: 'M3 7h3.4a4 4 0 0 1 3.3 1.8l4.6 6.4a4 4 0 0 0 3.3 1.8H21M3 17h3.4a4 4 0 0 0 3.3-1.8M14.3 8.8A4 4 0 0 1 17.6 7H21M18 4l3 3-3 3M18 14l3 3-3 3',
  bookmark: 'M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z',
  sliders: 'M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  left: 'M14.5 5.5 8 12l6.5 6.5',
  right: 'M9.5 5.5 16 12l-6.5 6.5',
  lock: 'M7.5 11V8a4.5 4.5 0 0 1 9 0v3M6 11h12v9H6z',
  unlock: 'M7.5 11V8a4.5 4.5 0 0 1 8.7-1.6M6 11h12v9H6z',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.8-4.8',
  folder: 'M3.5 6.5a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z',
}
export type IconName = keyof typeof PATHS

export const Icon = ({ name, size = 20 }: { name: IconName; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d={PATHS[name]} />
  </svg>
)

// The app's mark: a swing tag, like the one on new clothes.
export const Mark = () => (
  <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
    <path
      fill="var(--accent)"
      fillRule="evenodd"
      transform="rotate(-14 12 12)"
      d="M9 3h6l3.5 3.5V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V6.5zM12 5.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"
    />
  </svg>
)

// A tag drawn like a luggage tag. The name is a button when there's something to do on click.
export function Tag({ name, on, onClick, onRemove }: { name: string; on?: boolean; onClick?: () => void; onRemove?: () => void }) {
  return (
    <span className={on ? 'tag on' : 'tag'}>
      {onClick ? <button type="button" onClick={onClick} aria-pressed={on}>{name}</button> : <span>{name}</span>}
      {onRemove && (
        <button type="button" className="tag-x" onClick={onRemove} aria-label={`Remove ${name}`}>
          <Icon name="x" size={14} />
        </button>
      )}
    </span>
  )
}

// A modal on the native <dialog>: focus trap, Esc and the backdrop come for free.
export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal()
  }, [])
  return (
    <dialog ref={ref} className="sheet" aria-label={label} onClose={onClose} onClick={e => e.target === e.currentTarget && e.currentTarget.close()}>
      <div className="sheet-body">{children}</div>
    </dialog>
  )
}
