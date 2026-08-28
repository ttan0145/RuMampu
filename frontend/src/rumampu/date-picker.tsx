import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, DISP_FONT } from './theme';

type PickerMode = 'date' | 'month';

type Props = {
  value: string;
  mode: PickerMode;
  monthNames: string[];
  onChange: (value: string) => void;
  maximumDate?: Date;
};

function parseValue(value: string, mode: PickerMode): Date {
  const match = mode === 'date'
    ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    : /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = mode === 'date' ? Number(match[3]) : 1;
  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isoMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function DatePickerField({ value, mode, monthNames, onChange, maximumDate }: Props) {
  const [open, setOpen] = React.useState(false);
  const parsed = parseValue(value, mode);
  const [viewYear, setViewYear] = React.useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(parsed.getMonth());

  React.useEffect(() => {
    const next = parseValue(value, mode);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }, [value, mode]);

  const display = mode === 'month'
    ? `${monthNames[parsed.getMonth()] ?? String(parsed.getMonth() + 1)} ${parsed.getFullYear()}`
    : `${parsed.getDate()} ${monthNames[parsed.getMonth()] ?? String(parsed.getMonth() + 1)} ${parsed.getFullYear()}`;

  const max = maximumDate ?? new Date(9999, 11, 31);
  const canChooseMonth = (year: number, month: number) => {
    const candidate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return candidate <= max || (year === max.getFullYear() && month === max.getMonth());
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const cells: Array<number | null> = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7) cells.push(null);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mode === 'date' ? 'Choose date' : 'Choose month'}
        onPress={() => setOpen(true)}
        style={st.field}
      >
        <Text style={st.fieldText}>{display}</Text>
        <Text style={st.calendar}>▣</Text>
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={st.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={st.card}>
            {mode === 'month' ? (
              <>
                <View style={st.header}>
                  <Pressable onPress={() => setViewYear(y => y - 1)} style={st.arrow}><Text style={st.arrowText}>‹</Text></Pressable>
                  <Text style={st.title}>{viewYear}</Text>
                  <Pressable onPress={() => setViewYear(y => y + 1)} style={st.arrow}><Text style={st.arrowText}>›</Text></Pressable>
                </View>
                <View style={st.monthGrid}>
                  {monthNames.map((name, month) => {
                    const selected = viewYear === parsed.getFullYear() && month === parsed.getMonth();
                    const enabled = canChooseMonth(viewYear, month);
                    return (
                      <Pressable
                        key={`${viewYear}-${month}`}
                        disabled={!enabled}
                        onPress={() => {
                          onChange(isoMonth(viewYear, month));
                          setOpen(false);
                        }}
                        style={[st.monthCell, selected && st.selected, !enabled && st.disabled]}
                      >
                        <Text style={[st.monthText, selected && st.selectedText]} numberOfLines={1}>{name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <View style={st.header}>
                  <Pressable onPress={() => shiftMonth(-1)} style={st.arrow}><Text style={st.arrowText}>‹</Text></Pressable>
                  <Text style={st.title}>{monthNames[viewMonth]} {viewYear}</Text>
                  <Pressable
                    onPress={() => shiftMonth(1)}
                    disabled={new Date(viewYear, viewMonth + 1, 1) > max}
                    style={st.arrow}
                  ><Text style={st.arrowText}>›</Text></Pressable>
                </View>
                <View style={st.weekRow}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => <Text key={`${x}-${i}`} style={st.week}>{x}</Text>)}
                </View>
                <View style={st.dayGrid}>
                  {cells.map((day, index) => {
                    if (day == null) return <View key={`blank-${index}`} style={st.dayCell} />;
                    const candidate = new Date(viewYear, viewMonth, day);
                    const enabled = candidate <= max;
                    const selected = candidate.getFullYear() === parsed.getFullYear()
                      && candidate.getMonth() === parsed.getMonth()
                      && candidate.getDate() === parsed.getDate();
                    return (
                      <Pressable
                        key={day}
                        disabled={!enabled}
                        onPress={() => {
                          onChange(isoDate(candidate));
                          setOpen(false);
                        }}
                        style={[st.dayCell, selected && st.selected, !enabled && st.disabled]}
                      >
                        <Text style={[st.dayText, selected && st.selectedText]}>{day}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  field: {
    minHeight: 48, borderWidth: 1.5, borderColor: C.ink40, borderRadius: 12,
    paddingHorizontal: 14, backgroundColor: C.paper, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  fieldText: { fontSize: 17, color: C.ink },
  calendar: { fontSize: 18, color: C.brand },
  backdrop: { flex: 1, backgroundColor: 'rgba(60,81,82,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 390, backgroundColor: C.paper, borderRadius: 18, padding: 18, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: DISP_FONT, fontSize: 19, color: C.ink },
  arrow: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 30, lineHeight: 32, color: C.brand },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthCell: { width: '31%', minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  monthText: { fontSize: 13, color: C.ink },
  weekRow: { flexDirection: 'row' },
  week: { width: '14.2857%', textAlign: 'center', fontSize: 12, color: C.ink64 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  dayText: { fontSize: 14, color: C.ink },
  selected: { backgroundColor: C.brand },
  selectedText: { color: C.paper, fontWeight: '700' },
  disabled: { opacity: 0.25 },
});
