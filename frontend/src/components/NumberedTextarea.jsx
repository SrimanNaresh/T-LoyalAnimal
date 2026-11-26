import { useRef, useEffect } from 'react';

// Text area that numbers each line "1. ", "2. ", ... as you type: it starts
// with "1. " when you click into an empty box, Enter adds the next number,
// and lines are renumbered when one is removed. The numbers are saved as part
// of the text, so prints show them too.
const NUM = /^\d+\.\s?/;
const strip = (line) => line.replace(NUM, '');
export const renumber = (text) => text.split('\n').map((l, i) => `${i + 1}. ${strip(l)}`).join('\n');
// A last line holding only its number is dropped (left behind by Enter).
const tidy = (text) => {
  const lines = text.split('\n');
  while (lines.length && !strip(lines[lines.length - 1]).trim()) lines.pop();
  return lines.length ? renumber(lines.join('\n')) : '';
};

export default function NumberedTextarea({ value, onChange, ...props }) {
  const ref = useRef(null);
  const caret = useRef(null);

  // Put the cursor back where it belongs after a renumber changed the text.
  useEffect(() => {
    if (caret.current == null || !ref.current) return;
    ref.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [value]);

  const set = (text, pos) => { caret.current = pos; onChange(text); };

  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: a, selectionEnd: b } = el;
    const before = value.slice(0, a);
    const after = value.slice(b);
    const lineNo = before.split('\n').length; // the line the cursor is on
    const text = renumber(`${before}\n${after}`);
    // cursor goes just after the new line's "N. "
    const lines = text.split('\n');
    const pos = lines.slice(0, lineNo).join('\n').length + 1 + `${lineNo + 1}. `.length;
    set(text, pos);
  };

  const onInput = (e) => {
    const el = e.currentTarget;
    const raw = el.value;
    if (!raw.trim()) { onChange(''); return; }
    // Lines removed or pasted: renumber, keeping the cursor on the same line/column.
    const pos = el.selectionStart;
    const lineNo = raw.slice(0, pos).split('\n').length - 1;
    const col = pos - raw.slice(0, pos).lastIndexOf('\n') - 1;
    const rawLine = raw.split('\n')[lineNo] || '';
    const text = renumber(raw);
    const lines = text.split('\n');
    const shift = lines[lineNo].length - rawLine.length; // prefix length change on this line
    const start = lines.slice(0, lineNo).join('\n').length + (lineNo ? 1 : 0);
    const prefix = `${lineNo + 1}. `.length;
    set(text, start + Math.max(prefix, Math.min(lines[lineNo].length, col + shift)));
  };

  const onFocus = (e) => {
    if (!value) set('1. ', 3);
    props.onFocus?.(e);
  };
  const onBlur = (e) => {
    const t = tidy(value || '');
    if (t !== value) onChange(t);
    props.onBlur?.(e);
  };

  return (
    <textarea
      {...props}
      ref={ref}
      value={value}
      onChange={onInput}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}
