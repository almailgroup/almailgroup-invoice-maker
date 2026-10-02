import { Circle, Svg, Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { tint } from '@/lib/color';
import {
  DocShell,
  ItemsTable,
  Lines,
  Logo,
  MetaRows,
  PageFooter,
  RunningHeader,
  Stamp,
  TNUM,
  TotalsSection,
  clientLines,
  companyContactLines,
  companyIdLine,
  sx,
} from './shared';
import { templateMeta } from '../template-meta';
import type { TemplateDefinition, TemplateProps } from './types';

function Creative({ model, theme }: TemplateProps) {
  const c = model.company;
  const label: Style = {
    fontSize: 7,
    fontWeight: 700,
    color: theme.accentInk,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 5,
  };
  const card: Style = { borderRadius: 10, padding: 13 };

  return (
    <DocShell model={model} theme={theme} pageStyle={{ paddingTop: 40 }}>
      {/* Decorative shapes (first page only) */}
      <Svg style={{ position: 'absolute', top: 0, right: 0 }} width={240} height={150}>
        <Circle cx={220} cy={10} r={120} fill={tint(theme.accent, 0.86)} />
        <Circle cx={132} cy={-18} r={62} fill={theme.accent} />
        <Circle cx={210} cy={118} r={16} fill={tint(theme.accent, 0.55)} />
      </Svg>
      {/* Bottom-left accent; must be `fixed` because non-fixed absolute nodes in
          the bottom margin break react-pdf's pagination. */}
      <View
        fixed
        style={{ position: 'absolute', bottom: 0, left: 0, width: 90, height: 90 }}
        render={({ pageNumber }) =>
          pageNumber === 1 ? (
            <Svg width={90} height={90}>
              <Circle cx={-10} cy={100} r={85} fill={tint(theme.accent, 0.9)} />
            </Svg>
          ) : null
        }
      />

      <View style={{ width: '62%', marginBottom: 20 }}>
        {c.logo ? (
          <Logo src={c.logo} width={150} height={46} />
        ) : (
          <Text style={{ fontSize: 15, fontWeight: 800, color: theme.ink }}>{c.name}</Text>
        )}
        <Text
          style={{
            fontFamily: theme.fonts.heading,
            fontSize: 34,
            fontWeight: 800,
            color: theme.ink,
            letterSpacing: -1,
            marginTop: 18,
          }}
        >
          {model.title}
        </Text>
        {model.number ? (
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: theme.accentSoft,
              borderRadius: 10,
              paddingVertical: 3,
              paddingHorizontal: 10,
              marginTop: 6,
            }}
          >
            <Text style={sx({ fontSize: 9, fontWeight: 700, color: theme.accentInk }, TNUM)}>
              {model.number}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 20 }}>
        <View style={sx(card, { flex: 1.2, backgroundColor: theme.surface, marginRight: 10 })}>
          <Text style={label}>{model.labels.from}</Text>
          <Text style={{ fontSize: 9.5, fontWeight: 700, color: theme.ink, marginBottom: 2 }}>
            {c.name}
          </Text>
          <Lines
            lines={[...c.addressLines, ...companyContactLines(model, false), companyIdLine(model)]}
            style={{ fontSize: 7.5, color: theme.body, lineHeight: 1.45 }}
          />
        </View>
        <View style={sx(card, { flex: 1.2, backgroundColor: theme.surface, marginRight: 10 })}>
          <Text style={label}>{model.recipientLabel}</Text>
          <Text style={{ fontSize: 9.5, fontWeight: 700, color: theme.ink, marginBottom: 2 }}>
            {model.client.name || '—'}
          </Text>
          <Lines
            lines={clientLines(model, false)}
            style={{ fontSize: 7.5, color: theme.body, lineHeight: 1.45 }}
          />
          {model.shipTo ? (
            <View style={{ marginTop: 8 }}>
              <Text style={label}>{model.labels.shipTo}</Text>
              <Lines
                lines={model.shipTo.lines}
                style={{ fontSize: 7.5, color: theme.body, lineHeight: 1.45 }}
              />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <View style={sx(card, { backgroundColor: theme.accent, marginBottom: 10 })}>
            <Text style={sx(label, { color: theme.onAccent, opacity: 0.85 })}>
              {model.amountDue.label}
            </Text>
            <Text style={sx({ fontSize: 17, fontWeight: 800, color: theme.onAccent }, TNUM)}>
              {model.amountDue.value}
            </Text>
            {model.amountDue.caption ? (
              <Text style={{ fontSize: 7.5, color: theme.onAccent, opacity: 0.85, marginTop: 3 }}>
                {model.amountDue.caption}
              </Text>
            ) : null}
          </View>
          <MetaRows
            rows={[
              ...model.meta,
              ...(model.deposit
                ? [{ label: model.deposit.label, value: model.deposit.value }]
                : []),
            ]}
            labelStyle={{ fontSize: 8, color: theme.muted }}
            valueStyle={{ fontSize: 8, fontWeight: 700, color: theme.ink }}
            rowStyle={{ paddingVertical: 2, paddingHorizontal: 4 }}
          />
        </View>
      </View>

      {/* Placed before the table so it always lands on the first page. */}
      <Stamp model={model} theme={theme} style={{ top: 150, right: 190 }} />

      <ItemsTable
        model={model}
        theme={theme}
        styles={{
          header: { backgroundColor: theme.accentSoft, borderRadius: 8 },
          headerText: {
            color: theme.accentInk,
            fontSize: 7.5,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          },
          row: { borderBottomWidth: 0.75, borderBottomColor: theme.line, paddingVertical: 7.5 },
          headingText: { color: theme.accentInk },
        }}
      />

      <TotalsSection
        model={model}
        theme={theme}
        titleStyle={label}
        style={{ marginTop: 16 }}
        totals={{
          width: 236,
          row: { paddingHorizontal: 10, paddingVertical: 3.5 },
          strongRow: {
            paddingHorizontal: 10,
            borderTopWidth: 0.75,
            borderTopColor: theme.line,
            marginTop: 3,
            paddingTop: 6,
          },
          grandRow: {
            backgroundColor: theme.accent,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 9,
            marginTop: 6,
          },
          grandLabel: { color: theme.onAccent },
          grandValue: { color: theme.onAccent, fontSize: 13 },
          note: { paddingHorizontal: 10 },
        }}
      />

      <RunningHeader model={model} theme={theme} />
      <PageFooter model={model} theme={theme} style={{ left: 110 }} />
    </DocShell>
  );
}

export const creative: TemplateDefinition = {
  ...templateMeta('creative'),
  fonts: { body: 'manrope', heading: 'manrope', mono: 'jetbrainsmono' },
  render: (props) => <Creative {...props} />,
};
