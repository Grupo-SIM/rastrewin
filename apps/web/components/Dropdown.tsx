'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type DropdownOption = { value: string; label: string; sub?: string };

/** Dropdown simples (sem busca) no mesmo visual do UserPicker. A lista abre em portal, sem ser cortada por overflow. */
export function Dropdown({
  options, value, onChange, label, width = 200,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const r = btn.current?.getBoundingClientRect();
    if (r) {
      const w = Math.max(r.width, 200);
      setPos({ left: Math.max(12, Math.min(r.left, window.innerWidth - w - 12)), top: r.bottom + 6, width: w });
    }
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        ref={btn}
        className={`rp-btn ${open ? 'open' : ''}`}
        style={{ width }}
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="rp-val">{selected?.label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && pos && createPortal(
        <div ref={pop} className="rp-pop" style={{ left: pos.left, top: pos.top, width: pos.width }}>
          <div className="rp-list" role="listbox">
            {options.map((o) => (
              <div
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={`rp-item ${o.value === value ? 'sel' : ''}`}
                onClick={() => { onChange(o.value); setOpen(false); btn.current?.focus(); }}
              >
                <span className="rp-txt">
                  <span className="rp-t">{o.label}</span>
                  {o.sub && <span className="rp-s">{o.sub}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
