import { useMemo, useRef, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ComboOption {
  value: string;
  label: string;
  /** Secondary text (email, SKU, price...). */
  detail?: string;
  /** Extra text that should match searches but is not shown. */
  keywords?: string;
}

/**
 * Searchable single select. `onCreate` adds a "Create …" entry using the
 * current search text.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
  onCreate,
  createLabel = 'Create',
  className,
  id,
  disabled,
  renderValue,
}: {
  value: string | null;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  onCreate?: (query: string) => void;
  createLabel?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  renderValue?: (option: ComboOption) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 200);
    return options
      .filter((o) => `${o.label} ${o.detail ?? ''} ${o.keywords ?? ''}`.toLowerCase().includes(q))
      .slice(0, 200);
  }, [options, query]);

  const showCreate = Boolean(onCreate);
  const total = filtered.length + (showCreate ? 1 : 0);

  const choose = (index: number) => {
    if (index < filtered.length) {
      onChange(filtered[index].value);
      setOpen(false);
    } else if (onCreate) {
      onCreate(query.trim());
      setOpen(false);
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery('');
          setActive(0);
        }
      }}
    >
      <Popover.Trigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm shadow-xs transition-colors hover:border-slate-400 focus-visible:border-primary-500 disabled:cursor-not-allowed disabled:bg-slate-50',
            className,
          )}
        >
          <span className={cn('min-w-0 truncate', !selected && 'text-slate-400')}>
            {selected ? (renderValue ? renderValue(selected) : selected.label) : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-slate-400" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-64 rounded-lg border border-slate-200 bg-white shadow-lg data-[state=open]:animate-fade-in"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3">
            <Search className="size-4 text-slate-400" aria-hidden />
            <input
              autoFocus
              value={query}
              placeholder={searchPlaceholder}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(total - 1, a + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (total > 0) choose(active);
                }
              }}
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div ref={listRef} role="listbox" className="max-h-72 overflow-y-auto p-1">
            {filtered.length === 0 && !showCreate ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">{emptyText}</p>
            ) : null}
            {filtered.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm',
                  active === i ? 'bg-slate-100' : '',
                )}
              >
                <Check
                  className={cn('size-4 shrink-0 text-primary-600', o.value === value ? 'opacity-100' : 'opacity-0')}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-slate-900">{o.label}</span>
                  {o.detail ? <span className="block truncate text-xs text-slate-500">{o.detail}</span> : null}
                </span>
              </button>
            ))}
            {showCreate ? (
              <button
                type="button"
                onMouseEnter={() => setActive(filtered.length)}
                onClick={() => choose(filtered.length)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-primary-700',
                  active === filtered.length ? 'bg-primary-50' : '',
                )}
              >
                <Plus className="size-4" aria-hidden />
                {query.trim() ? `${createLabel} “${query.trim()}”` : createLabel}
              </button>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
