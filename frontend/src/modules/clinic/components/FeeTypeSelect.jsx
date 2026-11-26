import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Plus, Pencil, Trash2 } from 'lucide-react';

/**
 * Fee Type dropdown with Add / Edit / Delete inside the list: every option
 * has edit and delete icons, and "Add Fee Type" sits at the bottom.
 *
 * Keyboard: Up / Down move through the list (Add Fee Type is the last row),
 * Enter picks the highlighted row, Escape closes.
 *
 * Props: options [{ FeeTypeId, Name }], value (id string), onChange(id string),
 * onAdd(), onEdit(option), onDelete(option)
 */
export default function FeeTypeSelect({ options, value, onChange, onAdd, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [active, setActive] = useState(-1);
  const ref = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScroll = (e) => { if (!panelRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  const selected = options.find((o) => String(o.FeeTypeId) === String(value));
  const run = (fn) => (e) => { e.stopPropagation(); setOpen(false); fn(); };
  const addIndex = options.length; // the "Add Fee Type" row

  const openList = () => {
    setRect(ref.current.firstChild.getBoundingClientRect());
    setActive(Math.max(0, options.findIndex((o) => String(o.FeeTypeId) === String(value))));
    setOpen(true);
  };
  const pickIndex = (i) => {
    setOpen(false);
    if (i === addIndex) onAdd();
    else if (options[i]) onChange(String(options[i].FeeTypeId));
  };

  // Keep the highlighted row in view while moving with the arrow keys.
  useEffect(() => {
    if (open) panelRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openList();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (a + step + addIndex + 1) % (addIndex + 1));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      pickIndex(active);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Tab' && open) {
      setOpen(false);
    }
  };

  return (
    <div className="relative min-w-[180px] flex-1" ref={ref}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className="input flex items-center justify-between gap-2 py-1.5 text-left"
      >
        <span className={selected ? 'truncate text-ink-800' : 'truncate text-ink-400'}>
          {selected ? selected.Name : 'Select fee type'}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && rect && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 240) }}
          className="z-50 rounded-lg border border-ink-200 bg-white shadow-elevated animate-fade-in"
        >
          <div className="max-h-60 overflow-y-auto p-1">
            {options.length === 0 && <p className="px-3 py-3 text-center text-sm text-ink-400">No fee types yet</p>}
            {options.map((o, i) => {
              const isSel = String(o.FeeTypeId) === String(value);
              return (
                <div
                  key={o.FeeTypeId}
                  data-idx={i}
                  onClick={() => pickIndex(i)}
                  onMouseEnter={() => setActive(i)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    isSel ? 'font-medium text-brand-700' : 'text-ink-600'
                  } ${i === active ? 'bg-brand-100' : isSel ? 'bg-brand-50' : ''}`}
                >
                  <span className="flex-1 truncate">{o.Name}</span>
                  {isSel && <Check size={15} className="shrink-0 text-brand-600" />}
                  <button type="button" title="Edit" onClick={run(() => onEdit(o))}
                    className="rounded p-1 text-amber-600 hover:bg-amber-100">
                    <Pencil size={14} />
                  </button>
                  <button type="button" title="Delete" onClick={run(() => onDelete(o))}
                    className="rounded p-1 text-red-600 hover:bg-red-100">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            data-idx={addIndex}
            onClick={run(onAdd)}
            onMouseEnter={() => setActive(addIndex)}
            className={`flex w-full items-center gap-2 border-t border-ink-100 px-4 py-2 text-sm font-medium text-brand-600 ${active === addIndex ? 'bg-brand-100' : ''}`}
          >
            <Plus size={15} /> Add Fee Type
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
