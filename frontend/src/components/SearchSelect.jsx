import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Check, Plus } from 'lucide-react';

/**
 * Single-select dropdown with a type-to-search filter.
 *
 * Props:
 *  - options:     array of { value, label }
 *  - value:       currently selected value
 *  - onChange:    (value) => void
 *  - placeholder
 *  - searchPlaceholder: placeholder for the inner filter input
 *  - onAddNew:    optional (query) => void; when the search finds nothing, an
 *                 "Add New" option calls it with the typed text
 *
 * Keyboard: Up / Down open the list and move the highlight, Enter picks it
 * (or Add New when nothing matches), Escape closes.
 */
export default function SearchSelect({ options, value, onChange, placeholder = 'Select...', searchPlaceholder = 'Search medicine...', className = 'input', textSize = 'text-sm', onAddNew }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState(null);
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selected = options.find((o) => o.value === value);
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const close = () => {
    setOpen(false);
    setQuery('');
    btnRef.current?.focus(); // keep keyboard flow on this field
  };
  const pick = (v) => {
    onChange(v);
    close();
  };
  const addNew = () => {
    const q = query.trim();
    close();
    onAddNew(q);
  };
  const openList = () => {
    setRect(btnRef.current.getBoundingClientRect());
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  // A new search starts the highlight at the top.
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    if (open) panelRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openList();
      if (!filtered.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (a + step + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (filtered.length) pick(filtered[Math.min(active, filtered.length - 1)].value);
      else if (onAddNew) addNew();
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={`${className} flex items-center justify-between gap-2 text-left`}
      >
        <span className={selected ? 'truncate text-ink-800' : 'truncate text-ink-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && rect && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width }}
          className="z-50 rounded-lg border border-ink-200 bg-white shadow-elevated animate-fade-in"
        >
          <div className="border-b border-ink-100 p-2">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                autoFocus
                className={`w-full rounded-md border border-ink-200 py-1.5 pl-8 pr-2 ${textSize} focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100`}
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <>
                <p className={`px-3 pb-1 pt-3 text-center ${textSize} text-ink-400`}>No matches</p>
                {onAddNew && (
                  <button
                    type="button"
                    onClick={addNew}
                    className={`flex w-full items-center justify-center gap-2 rounded-md bg-brand-50 px-3 py-2 ${textSize} font-medium text-brand-600 hover:bg-brand-100`}
                  >
                    <Plus size={15} /> Add New{query.trim() ? ` "${query.trim()}"` : ''}
                  </button>
                )}
              </>
            ) : (
              filtered.map((o, i) => (
                <button
                  key={o.value}
                  type="button"
                  data-idx={i}
                  onClick={() => pick(o.value)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 ${textSize} transition-colors ${
                    o.value === value ? 'font-medium text-brand-700' : 'text-ink-600'
                  } ${i === active ? 'bg-brand-100' : o.value === value ? 'bg-brand-50' : ''}`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === value && <Check size={15} className="shrink-0 text-brand-600" />}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
