import { useMemo, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Address } from '@/db/types';
import { countryOptions, currencyOptions, LOCALE_OPTIONS } from '@/lib/geo';
import { DATE_FORMATS } from '@/lib/format';
import { logoFromFile } from '@/lib/image';
import { isHexColor, normalizeHex } from '@/lib/color';
import { cn } from '@/lib/cn';
import { Button } from './ui/button';
import { Field, Input, Select } from './ui/form';
import { Combobox } from './ui/combobox';

export function CountrySelect({
  value,
  onChange,
  id,
  placeholder = 'Select a country',
}: {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  placeholder?: string;
}) {
  const options = useMemo(
    () => countryOptions().map((o) => ({ value: o.value, label: o.label, keywords: o.value })),
    [],
  );
  return (
    <Combobox
      id={id}
      value={value || null}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder="Search countries…"
    />
  );
}

export function CurrencySelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (code: string) => void;
  id?: string;
}) {
  const options = useMemo(
    () => currencyOptions().map((o) => ({ value: o.value, label: o.label })),
    [],
  );
  return (
    <Combobox
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      searchPlaceholder="Search currencies…"
      renderValue={(o) => o.label}
    />
  );
}

export function LocaleSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (locale: string) => void;
  id?: string;
}) {
  const known = LOCALE_OPTIONS.some((o) => o.value === value);
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {!known ? <option value={value}>{value}</option> : null}
      {LOCALE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function DateFormatSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (format: (typeof DATE_FORMATS)[number]['value']) => void;
  id?: string;
}) {
  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as (typeof DATE_FORMATS)[number]['value'])}
    >
      {DATE_FORMATS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function AddressFields({
  value,
  onChange,
}: {
  value: Address;
  onChange: (address: Address) => void;
}) {
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <Field label="Address line 1" className="sm:col-span-6">
        {(id) => <Input id={id} value={value.line1} onChange={(e) => set({ line1: e.target.value })} autoComplete="address-line1" />}
      </Field>
      <Field label="Address line 2" className="sm:col-span-6" optional>
        {(id) => <Input id={id} value={value.line2} onChange={(e) => set({ line2: e.target.value })} autoComplete="address-line2" />}
      </Field>
      <Field label="City" className="sm:col-span-3">
        {(id) => <Input id={id} value={value.city} onChange={(e) => set({ city: e.target.value })} autoComplete="address-level2" />}
      </Field>
      <Field label="State / region" className="sm:col-span-3" optional>
        {(id) => <Input id={id} value={value.state} onChange={(e) => set({ state: e.target.value })} autoComplete="address-level1" />}
      </Field>
      <Field label="Postal code" className="sm:col-span-2">
        {(id) => <Input id={id} value={value.postalCode} onChange={(e) => set({ postalCode: e.target.value })} autoComplete="postal-code" />}
      </Field>
      <Field label="Country" className="sm:col-span-4">
        {(id) => <CountrySelect id={id} value={value.country} onChange={(country) => set({ country })} />}
      </Field>
    </div>
  );
}

export function LogoUpload({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (logo: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await logoFromFile(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not use this image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handle(e.dataTransfer.files[0]);
        }}
        className={cn(
          'flex h-20 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-white p-2 transition-colors',
          dragging ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-slate-400',
        )}
        aria-label={value ? 'Replace logo' : 'Upload logo'}
      >
        {value ? (
          <img src={value} alt="Logo" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-slate-500">
            <ImagePlus className="size-5 text-slate-400" />
            {busy ? 'Processing…' : 'Upload logo'}
          </span>
        )}
      </button>
      <div className="space-y-2 text-sm text-slate-500">
        <p>PNG, JPG, SVG or WebP. A wide logo on a transparent background looks best.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => input.current?.click()} loading={busy}>
            {value ? 'Replace' : 'Choose file'}
          </Button>
          {value ? (
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
              <Trash2 /> Remove
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          void handle(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export const ACCENT_PRESETS = [
  '#4f46e5',
  '#2563eb',
  '#0e7490',
  '#0f766e',
  '#15803d',
  '#a16207',
  '#c2410c',
  '#dc2626',
  '#db2777',
  '#7c3aed',
  '#334155',
  '#111827',
];

export function ColorField({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (color: string) => void;
  id?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label
          className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-300 shadow-xs"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={normalizeHex(value)}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Pick a colour"
          />
        </label>
        <Input
          id={id}
          value={text ?? value}
          onChange={(e) => {
            setText(e.target.value);
            if (isHexColor(e.target.value)) onChange(normalizeHex(e.target.value));
          }}
          onBlur={() => setText(null)}
          className="w-32 font-mono uppercase"
          maxLength={7}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {ACCENT_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              'size-7 rounded-full ring-offset-2 transition-shadow',
              normalizeHex(value) === c ? 'ring-2 ring-slate-900' : 'hover:ring-2 hover:ring-slate-300',
            )}
            style={{ backgroundColor: c }}
            aria-label={`Use colour ${c}`}
          />
        ))}
      </div>
    </div>
  );
}
