import type { ReactNode } from 'react';
import { Document, Image, Link, Page, Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { RenderModel, RenderTotal } from '../model';
import type { TemplateTheme } from './types';

/** Tabular figures keep digits aligned in columns. */
export const TNUM: Style = { fontFeatureSettings: ['tnum'] };

type StyleInput = Style | Style[] | undefined | null | false;

/** Flattens optional style fragments into one object (react-pdf accepts arrays too). */
export function sx(...styles: StyleInput[]): Style {
  const out: Style = {};
  for (const s of styles) {
    if (!s) continue;
    if (Array.isArray(s)) Object.assign(out, sx(...s));
    else Object.assign(out, s);
  }
  return out;
}

export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/* -------------------------------------------------------------------------- */
/* Document shell                                                             */
/* -------------------------------------------------------------------------- */

export function DocShell({
  model,
  theme,
  pageStyle,
  children,
}: {
  model: RenderModel;
  theme: TemplateTheme;
  pageStyle?: Style;
  children: ReactNode;
}) {
  return (
    <Document
      title={model.documentTitle}
      author={model.company.name}
      subject={model.documentTitle}
      creator="Invoice Maker"
      producer="Invoice Maker"
      language={model.language}
    >
      <Page
        size={model.pageSize}
        style={sx(
          {
            fontFamily: theme.fonts.body,
            fontSize: 9,
            color: theme.body,
            paddingTop: 40,
            paddingBottom: 64,
            paddingHorizontal: 40,
          },
          pageStyle,
        )}
      >
        {children}
      </Page>
    </Document>
  );
}

/* -------------------------------------------------------------------------- */
/* Logo                                                                       */
/* -------------------------------------------------------------------------- */

export function Logo({
  src,
  width,
  height,
  align = 'left',
  style,
}: {
  src: string | null;
  width: number;
  height: number;
  align?: 'left' | 'center' | 'right';
  style?: Style;
}) {
  if (!src) return null;
  return (
    <Image
      src={src}
      style={sx(
        {
          width,
          height,
          objectFit: 'contain',
          objectPositionX: align === 'left' ? 0 : align === 'right' ? '100%' : '50%',
          objectPositionY: '50%',
        },
        style,
      )}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Text helpers                                                               */
/* -------------------------------------------------------------------------- */

export function Lines({ lines, style }: { lines: (string | null | undefined)[]; style?: Style }) {
  const visible = lines.filter((l): l is string => Boolean(l && l.trim()));
  if (visible.length === 0) return null;
  return <Text style={style}>{visible.join('\n')}</Text>;
}

const joinParts = (parts: string[], sep = '  ·  ') => parts.filter(Boolean).join(sep);

/** Email, phone and website, joined on as few lines as possible. */
export function companyContactLines(model: RenderModel, compact = true): string[] {
  const c = model.company;
  const parts = [c.email, c.phone, c.website ? displayUrl(c.website) : ''].filter(Boolean);
  if (!compact) return parts;
  return parts.length > 2 ? [joinParts(parts.slice(0, 2)), parts[2]] : [joinParts(parts)];
}

/** Tax and registration numbers on one line. */
export function companyIdLine(model: RenderModel): string {
  return joinParts([model.company.taxLine, model.company.registrationLine]);
}

export function clientLines(model: RenderModel, compact = true): string[] {
  const c = model.client;
  const contact = compact ? [joinParts([c.email, c.phone])] : [c.email, c.phone];
  return [c.contactName, ...c.addressLines, ...contact, c.taxLine].filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/* Items table                                                                */
/* -------------------------------------------------------------------------- */

export interface ItemsTableStyles {
  fontSize?: number;
  container?: Style;
  header?: Style;
  headerText?: Style;
  row?: Style;
  lastRow?: Style;
  zebra?: string | null;
  title?: Style;
  detail?: Style;
  cell?: Style;
  amount?: Style;
  headingRow?: Style;
  headingText?: Style;
  cellPaddingX?: number;
  rowPaddingY?: number;
  /** Color of vertical lines between columns (null = none). */
  columnLines?: string | null;
  widths?: Partial<Record<ColumnKey, number>>;
}

type ColumnKey = 'qty' | 'price' | 'discount' | 'tax' | 'amount';

const MIN_WIDTHS: Record<ColumnKey, number> = { qty: 44, price: 62, discount: 50, tax: 44, amount: 70 };
const MAX_WIDTHS: Record<ColumnKey, number> = { qty: 96, price: 104, discount: 70, tax: 80, amount: 120 };

/** Estimates column widths from their content so numbers never wrap. */
function columnWidths(
  model: RenderModel,
  fontSize: number,
  paddingX: number,
  overrides: Partial<Record<ColumnKey, number>> = {},
): Record<ColumnKey, number> {
  const values: Record<ColumnKey, string[]> = {
    qty: [model.labels.quantity],
    price: [model.labels.unitPrice],
    discount: [model.labels.discount],
    tax: [model.labels.tax],
    amount: [model.labels.amount],
  };
  for (const item of model.items) {
    if (item.kind !== 'item') continue;
    values.qty.push(item.quantityWithUnit);
    values.price.push(item.unitPrice);
    values.discount.push(item.discount);
    values.tax.push(item.tax);
    values.amount.push(item.amount);
  }
  const result = {} as Record<ColumnKey, number>;
  (Object.keys(values) as ColumnKey[]).forEach((key) => {
    const longest = Math.max(...values[key].map((v) => v.length));
    const estimate = longest * fontSize * 0.56 + paddingX * 2 + 4;
    result[key] =
      overrides[key] ?? Math.round(Math.min(MAX_WIDTHS[key], Math.max(MIN_WIDTHS[key], estimate)));
  });
  return result;
}

export function ItemsTable({
  model,
  theme,
  styles = {},
}: {
  model: RenderModel;
  theme: TemplateTheme;
  styles?: ItemsTableStyles;
}) {
  const { labels, columns } = model;
  const fontSize = styles.fontSize ?? 9;
  const px = styles.cellPaddingX ?? 8;
  const py = styles.rowPaddingY ?? 7;
  const w = columnWidths(model, fontSize, px, styles.widths);
  const divider = styles.columnLines
    ? { borderLeftWidth: 0.75, borderLeftColor: styles.columnLines }
    : undefined;

  const cols: { key: ColumnKey; label: string }[] = [
    { key: 'qty', label: labels.quantity },
    { key: 'price', label: labels.unitPrice },
    ...(columns.discount ? [{ key: 'discount' as const, label: labels.discount }] : []),
    ...(columns.tax ? [{ key: 'tax' as const, label: labels.tax }] : []),
    { key: 'amount', label: labels.amount },
  ];

  const headerText = sx(
    { fontSize: fontSize - 1, fontWeight: 600, color: theme.muted },
    styles.headerText,
  );
  const cell = sx({ fontSize, color: theme.body, textAlign: 'right' }, TNUM, styles.cell);
  const itemRows = model.items;
  // Zebra striping counts item rows only, so headings don't shift the pattern.
  const stripe: number[] = [];
  let itemCount = 0;
  for (const row of itemRows) {
    stripe.push(itemCount);
    if (row.kind === 'item') itemCount += 1;
  }

  return (
    <View style={sx({ width: '100%' }, styles.container)}>
      <View
        fixed
        style={sx({ flexDirection: 'row', alignItems: 'center', paddingVertical: py - 1 }, styles.header)}
      >
        <View style={{ flex: 1, paddingHorizontal: px }}>
          <Text style={headerText}>{labels.description}</Text>
        </View>
        {cols.map((c) => (
          <View key={c.key} style={sx({ width: w[c.key], paddingHorizontal: px }, divider)}>
            <Text style={sx(headerText, { textAlign: 'right' })}>{c.label}</Text>
          </View>
        ))}
      </View>

      {itemRows.map((item, i) => {
        const isLast = i === itemRows.length - 1;
        if (item.kind === 'heading') {
          return (
            <View
              key={i}
              wrap={false}
              minPresenceAhead={30}
              style={sx(
                { paddingHorizontal: px, paddingTop: py + 4, paddingBottom: py - 2 },
                styles.headingRow,
              )}
            >
              <Text
                style={sx(
                  { fontSize: fontSize + 0.5, fontWeight: 700, color: theme.ink },
                  styles.headingText,
                )}
              >
                {item.title}
              </Text>
              {item.detail ? (
                <Text style={sx({ fontSize: fontSize - 1, color: theme.muted, marginTop: 1 }, styles.detail)}>
                  {item.detail}
                </Text>
              ) : null}
            </View>
          );
        }
        const zebra =
          styles.zebra && stripe[i] % 2 === 1 ? { backgroundColor: styles.zebra } : undefined;
        return (
          <View
            key={i}
            wrap={false}
            style={sx(
              { flexDirection: 'row', paddingVertical: py },
              styles.row,
              zebra,
              isLast ? styles.lastRow : undefined,
            )}
          >
            <View style={{ flex: 1, paddingHorizontal: px }}>
              <Text style={sx({ fontSize, fontWeight: 600, color: theme.ink }, styles.title)}>
                {item.title}
              </Text>
              {item.detail ? (
                <Text
                  style={sx(
                    { fontSize: fontSize - 1, color: theme.muted, marginTop: 2, lineHeight: 1.35 },
                    styles.detail,
                  )}
                >
                  {item.detail}
                </Text>
              ) : null}
            </View>
            {cols.map((c) => {
              const value =
                c.key === 'qty'
                  ? item.quantityWithUnit
                  : c.key === 'price'
                    ? item.unitPrice
                    : c.key === 'discount'
                      ? item.discount
                      : c.key === 'tax'
                        ? item.tax
                        : item.amount;
              return (
                <View key={c.key} style={sx({ width: w[c.key], paddingHorizontal: px }, divider)}>
                  <Text
                    style={
                      c.key === 'amount'
                        ? sx(cell, { fontWeight: 600, color: theme.ink }, styles.amount)
                        : cell
                    }
                  >
                    {value}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Totals                                                                     */
/* -------------------------------------------------------------------------- */

export interface TotalsStyles {
  width?: number | string;
  container?: Style;
  row?: Style;
  label?: Style;
  value?: Style;
  /** Final emphasised row (balance due, or total when nothing was paid). */
  grandRow?: Style;
  grandLabel?: Style;
  grandValue?: Style;
  /** The "Total" row when it is not the emphasised one. */
  strongRow?: Style;
  strongLabel?: Style;
  strongValue?: Style;
  note?: Style;
}

export function emphasizedKind(model: RenderModel): RenderTotal['kind'] {
  return model.totals.some((t) => t.kind === 'balance') ? 'balance' : 'total';
}

export function TotalsTable({
  model,
  theme,
  styles = {},
  grandBackground,
}: {
  model: RenderModel;
  theme: TemplateTheme;
  styles?: TotalsStyles;
  /** Drawn behind the emphasised row (e.g. a gradient). */
  grandBackground?: ReactNode;
}) {
  const emphasized = emphasizedKind(model);
  const row = sx(
    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    styles.row,
  );
  const label = sx({ fontSize: 9, color: theme.muted }, styles.label);
  const value = sx({ fontSize: 9, color: theme.ink, textAlign: 'right' }, TNUM, styles.value);

  return (
    <View
      wrap={false}
      style={sx({ width: styles.width ?? 230, alignSelf: 'flex-start' }, styles.container)}
    >
      {model.totals.map((t, i) => {
        if (t.kind === emphasized) {
          return (
            <View key={i} style={sx(row, { paddingVertical: 7 }, styles.grandRow)}>
              {grandBackground}
              <Text style={sx(label, { fontSize: 10, fontWeight: 700, color: theme.ink }, styles.grandLabel)}>
                {t.label}
              </Text>
              <Text style={sx(value, { fontSize: 12, fontWeight: 700 }, styles.grandValue)}>
                {t.value}
              </Text>
            </View>
          );
        }
        if (t.kind === 'total') {
          return (
            <View key={i} style={sx(row, styles.strongRow)}>
              <Text style={sx(label, { fontWeight: 700, color: theme.ink }, styles.strongLabel)}>
                {t.label}
              </Text>
              <Text style={sx(value, { fontWeight: 700 }, styles.strongValue)}>{t.value}</Text>
            </View>
          );
        }
        if (t.kind === 'included-tax') {
          return (
            <View key={i} style={sx(row, { paddingVertical: 2 })}>
              <Text style={sx(label, { fontSize: 8 }, styles.note)}>{t.label}</Text>
              <Text style={sx(value, { fontSize: 8, color: theme.muted }, styles.note)}>{t.value}</Text>
            </View>
          );
        }
        return (
          <View key={i} style={row}>
            <Text style={label}>{t.label}</Text>
            <Text style={value}>{t.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

export function Section({
  title,
  children,
  titleStyle,
  style,
}: {
  title: string;
  children: ReactNode;
  titleStyle?: Style;
  style?: Style;
}) {
  return (
    <View style={style}>
      <Text style={titleStyle}>{title}</Text>
      {children}
    </View>
  );
}

export function PaymentInfo({
  model,
  theme,
  titleStyle,
  textStyle,
  linkColor,
  qrSize = 62,
  showTitle = true,
}: {
  model: RenderModel;
  theme: TemplateTheme;
  titleStyle?: Style;
  textStyle?: Style;
  linkColor?: string;
  qrSize?: number;
  showTitle?: boolean;
}) {
  const p = model.payment;
  if (!p) return null;
  const text = sx({ fontSize: 8.5, color: theme.body, lineHeight: 1.45 }, textStyle);
  return (
    <View wrap={false} style={{ flexDirection: 'row' }}>
      <View style={{ flex: 1, paddingRight: p.qr ? 12 : 0 }}>
        {showTitle ? <Text style={titleStyle}>{model.labels.paymentDetails}</Text> : null}
        {p.details ? <Text style={text}>{p.details}</Text> : null}
        {p.instructions ? (
          <Text style={sx(text, { marginTop: p.details ? 4 : 0 })}>{p.instructions}</Text>
        ) : null}
        {p.link ? (
          <Link
            src={p.link}
            style={sx(text, {
              marginTop: p.details || p.instructions ? 4 : 0,
              color: linkColor ?? theme.accentInk,
              textDecoration: 'none',
              fontWeight: 600,
            })}
          >
            {`${model.labels.payOnline}: ${displayUrl(p.link)}`}
          </Link>
        ) : null}
      </View>
      {p.qr ? (
        <View style={{ alignItems: 'center' }}>
          <Image src={p.qr} style={{ width: qrSize, height: qrSize }} />
          <Text style={{ fontSize: 6.5, color: theme.muted, marginTop: 3 }}>
            {model.labels.scanToPay}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function Stamp({
  model,
  theme,
  style,
  size = 20,
}: {
  model: RenderModel;
  theme: TemplateTheme;
  style?: Style;
  size?: number;
}) {
  if (!model.stamp) return null;
  const color =
    model.stamp.tone === 'green' ? '#15803d' : model.stamp.tone === 'red' ? '#b91c1c' : '#475569';
  return (
    <View
      style={sx(
        {
          position: 'absolute',
          transform: 'rotate(-10deg)',
          borderWidth: 2.2,
          borderColor: color,
          borderRadius: 6,
          paddingVertical: 3,
          paddingHorizontal: 12,
          opacity: 0.8,
        },
        style,
      )}
    >
      <Text
        style={{
          color,
          fontSize: size,
          fontWeight: 700,
          letterSpacing: 2.5,
          textTransform: 'uppercase',
          fontFamily: theme.fonts.heading,
        }}
      >
        {model.stamp.text}
      </Text>
    </View>
  );
}

/** Compact status badge, an alternative to the rotated stamp. */
export function StatusPill({
  model,
  color,
  style,
}: {
  model: RenderModel;
  color: string;
  style?: Style;
}) {
  if (!model.stamp) return null;
  return (
    <View
      style={sx(
        {
          alignSelf: 'flex-start',
          borderWidth: 1,
          borderColor: color,
          borderRadius: 9,
          paddingVertical: 2,
          paddingHorizontal: 8,
        },
        style,
      )}
    >
      <Text
        style={{
          fontSize: 7,
          fontWeight: 700,
          color,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
        }}
      >
        {model.stamp.text}
      </Text>
    </View>
  );
}

export function PageFooter({
  model,
  theme,
  style,
  textStyle,
  marginX = 40,
}: {
  model: RenderModel;
  theme: TemplateTheme;
  style?: Style;
  textStyle?: Style;
  marginX?: number;
}) {
  const text = sx({ fontSize: 7.5, color: theme.faint, lineHeight: 1.4 }, textStyle);
  return (
    <View
      fixed
      style={sx(
        {
          position: 'absolute',
          left: marginX,
          right: marginX,
          bottom: 22,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        },
        style,
      )}
    >
      <Text style={sx(text, { flex: 1, paddingRight: 16 })}>{model.footer}</Text>
      <Text
        style={text}
        render={({ pageNumber, totalPages }) =>
          totalPages > 1 ? `${model.labels.page} ${pageNumber} ${model.labels.of} ${totalPages}` : ''
        }
      />
    </View>
  );
}

/** Small "Invoice INV-001 · Client" line at the top of pages 2+. */
export function RunningHeader({
  model,
  theme,
  style,
  marginX = 40,
}: {
  model: RenderModel;
  theme: TemplateTheme;
  style?: Style;
  marginX?: number;
}) {
  const text = [model.documentTitle, model.client.name].filter(Boolean).join('  ·  ');
  return (
    <Text
      fixed
      style={sx(
        {
          position: 'absolute',
          top: 20,
          left: marginX,
          right: marginX,
          fontSize: 7.5,
          color: theme.faint,
          textAlign: 'right',
        },
        style,
      )}
      render={({ pageNumber }) => (pageNumber > 1 ? text : '')}
    />
  );
}

/**
 * Payment details and terms side by side under a divider. When the terms are
 * long they are stacked instead, so the band can break across pages.
 */
export function ClosingBand({
  model,
  theme,
  titleStyle,
  textStyle,
  style,
  linkColor,
}: {
  model: RenderModel;
  theme: TemplateTheme;
  titleStyle: Style;
  textStyle?: Style;
  style?: Style;
  linkColor?: string;
}) {
  if (!model.payment && !model.terms) return null;
  const terms = model.terms ? (
    <View style={{ flex: 1 }}>
      <Text style={titleStyle}>{model.labels.terms}</Text>
      <Text style={sx({ fontSize: 8, color: theme.muted, lineHeight: 1.5 }, textStyle)}>
        {model.terms}
      </Text>
    </View>
  ) : null;
  const payment = model.payment ? (
    <PaymentInfo
      model={model}
      theme={theme}
      titleStyle={titleStyle}
      textStyle={textStyle}
      linkColor={linkColor}
    />
  ) : null;
  const container = sx(
    { marginTop: 22, paddingTop: 16, borderTopWidth: 0.75, borderTopColor: theme.line },
    style,
  );
  if (model.terms.length <= 700) {
    return (
      <View wrap={false} style={sx(container, { flexDirection: 'row' })}>
        {payment ? (
          <View style={{ flex: 1.15, paddingRight: terms ? 26 : 0 }}>{payment}</View>
        ) : null}
        {terms}
      </View>
    );
  }
  return (
    <View style={container}>
      {payment ? <View style={{ marginBottom: 14 }}>{payment}</View> : null}
      {terms}
    </View>
  );
}

/**
 * Notes and terms side by side (stacked when the terms are long, so they can
 * break across pages). Set `includeNotes` to false when notes are shown elsewhere.
 */
export function NotesAndTerms({
  model,
  theme,
  titleStyle,
  textStyle,
  style,
  includeNotes = true,
}: {
  model: RenderModel;
  theme: TemplateTheme;
  titleStyle: Style;
  textStyle?: Style;
  style?: Style;
  includeNotes?: boolean;
}) {
  const notes = includeNotes && model.notes ? model.notes : '';
  if (!notes && !model.terms) return null;
  const text = sx({ fontSize: 8.5, color: theme.body, lineHeight: 1.5 }, textStyle);
  const notesBlock = notes ? (
    <View style={{ flex: 1, paddingRight: model.terms ? 26 : 0 }}>
      <Text style={titleStyle}>{model.labels.notes}</Text>
      <Text style={text}>{notes}</Text>
    </View>
  ) : null;
  const termsBlock = model.terms ? (
    <View style={{ flex: 1 }}>
      <Text style={titleStyle}>{model.labels.terms}</Text>
      <Text style={sx(text, { fontSize: 8, color: theme.muted })}>{model.terms}</Text>
    </View>
  ) : null;
  if (notes.length + model.terms.length <= 900) {
    return (
      <View wrap={false} style={sx({ flexDirection: 'row' }, style)}>
        {notesBlock}
        {termsBlock}
      </View>
    );
  }
  return (
    <View style={style}>
      {notesBlock ? <View style={{ marginBottom: 12 }}>{notesBlock}</View> : null}
      {termsBlock}
    </View>
  );
}

/**
 * The block after the items: payment details (or notes) beside the totals,
 * then notes and terms underneath. Shared so every template behaves the same.
 */
export function TotalsSection({
  model,
  theme,
  titleStyle,
  textStyle,
  totals,
  grandBackground,
  style,
  bandStyle,
  linkColor,
  gap = 28,
}: {
  model: RenderModel;
  theme: TemplateTheme;
  titleStyle: Style;
  textStyle?: Style;
  totals: TotalsStyles;
  grandBackground?: ReactNode;
  style?: Style;
  bandStyle?: Style;
  linkColor?: string;
  gap?: number;
}) {
  const text = sx({ fontSize: 8.5, color: theme.body, lineHeight: 1.5 }, textStyle);
  return (
    <>
      <View wrap={false} style={sx({ flexDirection: 'row', marginTop: 14 }, style)}>
        <View style={{ flex: 1, paddingRight: gap }}>
          {model.payment ? (
            <PaymentInfo
              model={model}
              theme={theme}
              titleStyle={titleStyle}
              textStyle={textStyle}
              linkColor={linkColor}
            />
          ) : model.notes ? (
            <View>
              <Text style={titleStyle}>{model.labels.notes}</Text>
              <Text style={text}>{model.notes}</Text>
            </View>
          ) : null}
        </View>
        <TotalsTable
          model={model}
          theme={theme}
          styles={totals}
          grandBackground={grandBackground}
        />
      </View>
      <NotesAndTerms
        model={model}
        theme={theme}
        titleStyle={titleStyle}
        textStyle={textStyle}
        includeNotes={Boolean(model.payment)}
        style={sx(
          { marginTop: 16, paddingTop: 12, borderTopWidth: 0.75, borderTopColor: theme.line },
          bandStyle,
        )}
      />
    </>
  );
}

/** Label, name and address lines of a party (bill to, ship to, from). */
export function Party({
  label,
  name,
  lines,
  labelStyle,
  nameStyle,
  linesStyle,
  style,
}: {
  label?: string;
  name: string;
  lines: string[];
  labelStyle?: Style;
  nameStyle?: Style;
  linesStyle?: Style;
  style?: Style;
}) {
  return (
    <View style={style}>
      {label ? <Text style={labelStyle}>{label}</Text> : null}
      <Text style={sx({ fontSize: 10, fontWeight: 700, marginBottom: 2 }, nameStyle)}>
        {name || '—'}
      </Text>
      <Lines lines={lines} style={sx({ fontSize: 8.5, lineHeight: 1.5 }, linesStyle)} />
    </View>
  );
}

/** Label / value rows, e.g. issue date and due date. */
export function MetaRows({
  rows,
  labelStyle,
  valueStyle,
  rowStyle,
  labelWidth,
}: {
  rows: { label: string; value: string }[];
  labelStyle?: Style;
  valueStyle?: Style;
  rowStyle?: Style;
  labelWidth?: number;
}) {
  return (
    <View>
      {rows.map((r) => (
        <View
          key={r.label}
          style={sx({ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }, rowStyle)}
        >
          <Text style={sx(labelWidth ? { width: labelWidth } : undefined, labelStyle)}>{r.label}</Text>
          <Text style={sx({ textAlign: 'right' }, TNUM, valueStyle)}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Notes, terms and payment details in a consistent order. */
export function ClosingSections({
  model,
  theme,
  titleStyle,
  textStyle,
  gap = 14,
  linkColor,
}: {
  model: RenderModel;
  theme: TemplateTheme;
  titleStyle: Style;
  textStyle?: Style;
  gap?: number;
  linkColor?: string;
}) {
  const text = sx({ fontSize: 8.5, color: theme.body, lineHeight: 1.5 }, textStyle);
  return (
    <View>
      {model.notes ? (
        <View wrap={false} style={{ marginBottom: gap }}>
          <Text style={titleStyle}>{model.labels.notes}</Text>
          <Text style={text}>{model.notes}</Text>
        </View>
      ) : null}
      {model.payment ? (
        <View style={{ marginBottom: gap }}>
          <PaymentInfo
            model={model}
            theme={theme}
            titleStyle={titleStyle}
            textStyle={textStyle}
            linkColor={linkColor}
          />
        </View>
      ) : null}
      {model.terms ? (
        <View style={{ marginBottom: gap }}>
          <Text style={titleStyle}>{model.labels.terms}</Text>
          <Text style={sx(text, { color: theme.muted, fontSize: 8 })}>{model.terms}</Text>
        </View>
      ) : null}
    </View>
  );
}
