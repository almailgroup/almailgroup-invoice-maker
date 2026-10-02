import { Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import {
  DocShell,
  ItemsTable,
  Lines,
  Logo,
  PageFooter,
  RunningHeader,
  Stamp,
  TotalsSection,
  clientLines,
  companyContactLines,
  companyIdLine,
  sx,
} from './shared';
import { templateMeta } from '../template-meta';
import type { TemplateDefinition, TemplateProps } from './types';

const NIGHT = '#0b1220';
const GRID = '#e2e8f0';

function Mono({ model, theme }: TemplateProps) {
  const c = model.company;
  const mono = theme.fonts.mono;
  const label: Style = {
    fontFamily: mono,
    fontSize: 6.5,
    fontWeight: 500,
    color: theme.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 5,
  };
  const cell: Style = { flex: 1, padding: 10, borderRightWidth: 0.75, borderRightColor: GRID };

  return (
    <DocShell model={model} theme={theme} pageStyle={{ paddingTop: 0 }}>
      <View
        style={{
          backgroundColor: NIGHT,
          marginHorizontal: -40,
          paddingHorizontal: 40,
          paddingTop: 34,
          paddingBottom: 22,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 0,
        }}
      >
        <View style={{ width: '55%' }}>
          {c.logo ? (
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: '#ffffff',
                borderRadius: 4,
                paddingVertical: 6,
                paddingHorizontal: 10,
                marginBottom: 10,
              }}
            >
              <Logo src={c.logo} width={130} height={36} />
            </View>
          ) : null}
          <Text
            style={{
              fontFamily: mono,
              fontSize: c.logo ? 9 : 14,
              fontWeight: 600,
              color: '#ffffff',
            }}
          >
            {c.name}
          </Text>
          <Text
            style={{
              fontFamily: mono,
              fontSize: 7,
              color: '#94a3b8',
              marginTop: 3,
              lineHeight: 1.5,
            }}
          >
            {[c.addressLines.join(', '), companyContactLines(model, false).join(' · ')]
              .filter(Boolean)
              .join('\n')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={{
              fontFamily: mono,
              fontSize: 22,
              fontWeight: 600,
              color: theme.accentBright,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {model.title}
          </Text>
          {model.number ? (
            <Text style={{ fontFamily: mono, fontSize: 10, color: '#ffffff', marginTop: 3 }}>
              {model.number}
            </Text>
          ) : null}
        </View>
      </View>
      <View
        style={{
          height: 3,
          backgroundColor: theme.accent,
          marginHorizontal: -40,
          marginBottom: 18,
        }}
      />

      <View
        style={{ flexDirection: 'row', borderWidth: 0.75, borderColor: GRID, marginBottom: 18 }}
      >
        <View style={sx(cell, { flex: 1.3 })}>
          <Text style={label}>{model.recipientLabel}</Text>
          <Text style={{ fontSize: 9.5, fontWeight: 700, color: theme.ink, marginBottom: 2 }}>
            {model.client.name || '—'}
          </Text>
          <Lines
            lines={clientLines(model, false)}
            style={{ fontSize: 7.5, color: theme.body, lineHeight: 1.45 }}
          />
        </View>
        {model.shipTo ? (
          <View style={cell}>
            <Text style={label}>{model.labels.shipTo}</Text>
            <Text style={{ fontSize: 9, fontWeight: 700, color: theme.ink, marginBottom: 2 }}>
              {model.shipTo.name}
            </Text>
            <Lines
              lines={model.shipTo.lines}
              style={{ fontSize: 7.5, color: theme.body, lineHeight: 1.45 }}
            />
          </View>
        ) : null}
        <View style={cell}>
          {model.meta.map((m) => (
            <View key={m.label} style={{ marginBottom: 7 }}>
              <Text style={sx(label, { marginBottom: 1 })}>{m.label}</Text>
              <Text style={{ fontFamily: mono, fontSize: 8.5, color: theme.ink }}>{m.value}</Text>
            </View>
          ))}
        </View>
        <View
          style={sx(cell, {
            borderRightWidth: 0,
            backgroundColor: '#f8fafc',
            alignItems: 'flex-end',
          })}
        >
          <Text style={label}>{model.amountDue.label}</Text>
          <Text style={{ fontFamily: mono, fontSize: 15, fontWeight: 600, color: theme.ink }}>
            {model.amountDue.value}
          </Text>
          {model.amountDue.caption ? (
            <Text style={{ fontFamily: mono, fontSize: 6.5, color: theme.muted, marginTop: 4 }}>
              {model.amountDue.caption}
            </Text>
          ) : null}
          {model.deposit ? (
            <Text
              style={{
                fontFamily: mono,
                fontSize: 6.5,
                color: theme.accentInk,
                marginTop: 6,
                textAlign: 'right',
              }}
            >
              {`${model.deposit.label}: ${model.deposit.value}`}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Placed before the table so it always lands on the first page. */}
      <Stamp model={model} theme={theme} style={{ top: 150, right: 60 }} />

      <ItemsTable
        model={model}
        theme={theme}
        styles={{
          container: { borderWidth: 0.75, borderColor: GRID },
          header: { backgroundColor: '#f8fafc', borderBottomWidth: 0.75, borderBottomColor: GRID },
          headerText: {
            fontFamily: mono,
            fontSize: 6.5,
            fontWeight: 500,
            color: theme.muted,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          },
          row: { borderTopWidth: 0.5, borderTopColor: GRID, paddingVertical: 7 },
          cell: { fontFamily: mono, fontSize: 8 },
          amount: { fontFamily: mono, fontWeight: 600 },
          columnLines: GRID,
          headingText: {
            fontFamily: mono,
            fontSize: 8,
            fontWeight: 600,
            color: theme.accentInk,
            textTransform: 'uppercase',
          },
        }}
      />

      <TotalsSection
        model={model}
        theme={theme}
        titleStyle={label}
        style={{ marginTop: 16 }}
        totals={{
          width: 240,
          container: { borderWidth: 0.75, borderColor: GRID },
          row: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderBottomWidth: 0.5,
            borderBottomColor: GRID,
          },
          label: { fontFamily: mono, fontSize: 7.5 },
          value: { fontFamily: mono, fontSize: 8 },
          strongRow: {
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderBottomWidth: 0.5,
            borderBottomColor: GRID,
          },
          grandRow: { backgroundColor: NIGHT, paddingHorizontal: 10, paddingVertical: 9 },
          grandLabel: {
            fontFamily: mono,
            color: '#ffffff',
            fontSize: 8.5,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          },
          grandValue: { fontFamily: mono, color: theme.accentBright, fontSize: 12.5 },
          note: { paddingHorizontal: 10 },
        }}
      />

      {companyIdLine(model) ? (
        <Text
          fixed
          style={{
            position: 'absolute',
            left: 40,
            right: 40,
            bottom: 36,
            fontFamily: mono,
            fontSize: 6.5,
            color: theme.faint,
          }}
        >
          {companyIdLine(model)}
        </Text>
      ) : null}
      <RunningHeader
        model={model}
        theme={theme}
        style={{ fontFamily: mono, color: '#94a3b8', top: 12 }}
      />
      <PageFooter model={model} theme={theme} textStyle={{ fontFamily: mono, fontSize: 6.5 }} />
    </DocShell>
  );
}

export const mono: TemplateDefinition = {
  ...templateMeta('mono'),
  fonts: { body: 'plexsans', heading: 'plexsans', mono: 'jetbrainsmono' },
  render: (props) => <Mono {...props} />,
};
