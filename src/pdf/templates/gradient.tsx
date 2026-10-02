import { Defs, LinearGradient, Rect, Stop, Svg, Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { readableOn, shiftHue } from '@/lib/color';
import {
  DocShell,
  ItemsTable,
  Logo,
  MetaRows,
  PageFooter,
  Party,
  RunningHeader,
  Stamp,
  TNUM,
  TotalsSection,
  clientLines,
  companyContactLines,
  companyIdLine,
  sx,
} from './shared';
import type { TemplateDefinition, TemplateProps } from './types';

const HEADER_HEIGHT = 150;

function Gradient({ model, theme }: TemplateProps) {
  const c = model.company;
  const W = theme.pageWidth;
  const from = theme.accent;
  const to = shiftHue(theme.accent, 38);
  const onHeader = readableOn(from) === '#ffffff' && readableOn(to) === '#ffffff' ? '#ffffff' : theme.ink;
  const label: Style = {
    fontSize: 7,
    fontWeight: 700,
    color: theme.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 5,
  };

  return (
    <DocShell model={model} theme={theme} pageStyle={{ paddingTop: HEADER_HEIGHT + 22 }}>
      <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={W} height={HEADER_HEIGHT}>
        <Defs>
          <LinearGradient id="header" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={W} height={HEADER_HEIGHT} fill="url(#header)" />
      </Svg>

      <View
        style={{
          position: 'absolute',
          top: 34,
          left: 40,
          right: 40,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <View style={{ width: '55%' }}>
          {c.logo ? (
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: '#ffffff',
                borderRadius: 8,
                paddingVertical: 8,
                paddingHorizontal: 12,
              }}
            >
              <Logo src={c.logo} width={140} height={40} />
            </View>
          ) : (
            <Text style={{ fontSize: 18, fontWeight: 800, color: onHeader }}>{c.name}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 28, fontWeight: 800, color: onHeader, letterSpacing: -0.5 }}>
            {model.title}
          </Text>
          {model.number ? (
            <Text style={sx({ fontSize: 10, color: onHeader, opacity: 0.85, marginTop: 2 }, TNUM)}>
              {model.number}
            </Text>
          ) : null}
          <Text style={sx({ fontSize: 7, color: onHeader, opacity: 0.85, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.9 })}>
            {model.amountDue.label}
          </Text>
          <Text style={sx({ fontSize: 18, fontWeight: 800, color: onHeader, marginTop: 1 }, TNUM)}>
            {model.amountDue.value}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 20 }}>
        <Party
          style={{ flex: 1, paddingRight: 14 }}
          label={model.labels.from}
          name={c.name}
          lines={[...c.addressLines, ...companyContactLines(model, false), companyIdLine(model)]}
          labelStyle={label}
          nameStyle={{ fontSize: 9.5, color: theme.ink }}
          linesStyle={{ fontSize: 7.5, color: theme.body, lineHeight: 1.45 }}
        />
        <Party
          style={{ flex: 1, paddingRight: 14 }}
          label={model.recipientLabel}
          name={model.client.name}
          lines={[...clientLines(model, false), ...(model.shipTo ? ['', `${model.labels.shipTo}:`, ...model.shipTo.lines] : [])]}
          labelStyle={label}
          nameStyle={{ fontSize: 9.5, color: theme.ink }}
          linesStyle={{ fontSize: 7.5, color: theme.body, lineHeight: 1.45 }}
        />
        <View style={{ flex: 0.9 }}>
          <View style={{ backgroundColor: theme.accentSoft, borderRadius: 8, padding: 10 }}>
            <MetaRows
              rows={[
                ...model.meta,
                ...(model.deposit ? [{ label: model.deposit.label, value: model.deposit.value }] : []),
              ]}
              labelStyle={{ fontSize: 7.5, color: theme.muted }}
              valueStyle={{ fontSize: 8, fontWeight: 700, color: theme.ink }}
              rowStyle={{ paddingVertical: 2.5 }}
            />
            {model.amountDue.caption ? (
              <Text style={{ fontSize: 7, color: theme.accentInk, marginTop: 5, textAlign: 'right' }}>
                {model.amountDue.caption}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Placed before the table so it always lands on the first page. */}
      <Stamp model={model} theme={theme} style={{ top: 166, right: 205 }} />

      <ItemsTable
        model={model}
        theme={theme}
        styles={{
          header: { backgroundColor: theme.accentSoft, borderRadius: 6 },
          headerText: { color: theme.accentInk, fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
          row: { borderBottomWidth: 0.75, borderBottomColor: theme.line, paddingVertical: 7.5 },
          headingText: { color: theme.accentInk },
        }}
      />

      <TotalsSection
        model={model}
        theme={theme}
        titleStyle={sx(label, { color: theme.accentInk })}
        style={{ marginTop: 16 }}
        grandBackground={
          <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={236} height={34}>
            <Defs>
              <LinearGradient id="total" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={from} />
                <Stop offset="1" stopColor={to} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={236} height={34} rx={8} ry={8} fill="url(#total)" />
          </Svg>
        }
        totals={{
          width: 236,
          row: { paddingHorizontal: 10, paddingVertical: 3.5 },
          strongRow: { paddingHorizontal: 10, borderTopWidth: 0.75, borderTopColor: theme.line, marginTop: 3, paddingTop: 6 },
          grandRow: { height: 34, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 0, marginTop: 6 },
          grandLabel: { color: onHeader },
          grandValue: { color: onHeader, fontSize: 13 },
          note: { paddingHorizontal: 10 },
        }}
      />

      <RunningHeader model={model} theme={theme} style={{ color: '#ffffff' }} />
      <PageFooter model={model} theme={theme} />
    </DocShell>
  );
}

export const gradient: TemplateDefinition = {
  id: 'gradient',
  name: 'Gradient',
  description: 'Vibrant gradient header in your brand colour, with the logo on a clean white card.',
  tags: ['Colorful', 'Modern'],
  defaultAccent: '#7c3aed',
  fonts: { body: 'manrope', heading: 'manrope', mono: 'plexmono' },
  render: (props) => <Gradient {...props} />,
};
