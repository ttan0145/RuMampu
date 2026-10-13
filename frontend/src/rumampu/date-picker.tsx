import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BODY_FONT, C, DISP_FONT } from './theme';

type PickerMode = 'date' | 'month';

type Props = {
  value: string;
  mode: PickerMode;
  monthNames: string[];
  onChange: (value: string) => void;
  maximumDate?: Date;
  /** Days before this one cannot be chosen (time of day is ignored). */
  minimumDate?: Date;
  allowedMonths?: string[];
  compact?: boolean;
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

/** Quick choices stay compact; the calendar field appears only on request. */
export function ReviewDateField({ value, monthNames, onChange, todayLabel, yesterdayLabel, pickLabel, disabled = false, fullWidth = false }: {
  value: string;
  monthNames: string[];
  onChange: (value: string) => void;
  todayLabel: string;
  yesterdayLabel: string;
  pickLabel: string;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const [choosing, setChoosing] = React.useState(false);
  const [optionsOpen, setOptionsOpen] = React.useState(false);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const presets = [{ value: isoDate(today), label: todayLabel }, { value: isoDate(yesterday), label: yesterdayLabel }];
  const custom = Boolean(value) && !presets.some(preset => preset.value === value);
  const selectedLabel = custom ? value : choosing ? pickLabel : presets.find(preset => preset.value === value)?.label || pickLabel;
  return (
    <View style={{ gap: 6, alignItems: 'flex-end', alignSelf: 'flex-end', width: fullWidth ? '100%' : 145, maxWidth: '100%' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={selectedLabel} disabled={disabled}
        accessibilityState={{ disabled, expanded: optionsOpen }}
        onPress={() => setOptionsOpen(open => !open)} style={st.reviewSelect}>
        <Text numberOfLines={1} style={st.reviewChoiceText}>{selectedLabel}</Text>
        <Text style={st.reviewChoiceText}>▾</Text>
      </Pressable>
      {optionsOpen ? <View style={st.reviewOptions}>
        {presets.map(preset => <Pressable key={preset.value} accessibilityRole="button" disabled={disabled}
          accessibilityState={{ disabled, selected: !choosing && value === preset.value }}
          onPress={() => { setChoosing(false); setOptionsOpen(false); onChange(preset.value); }}
          style={[st.reviewOption, !choosing && value === preset.value && { backgroundColor: C.card }]}>
          <Text style={st.reviewChoiceText}>{preset.label}</Text>
        </Pressable>)}
        <Pressable accessibilityRole="button" disabled={disabled}
          onPress={() => { setChoosing(true); setOptionsOpen(false); }} style={st.reviewOption}>
          <Text style={st.reviewChoiceText}>{pickLabel}</Text>
        </Pressable>
      </View> : null}
      {choosing ? <View style={{ width: '100%' }} pointerEvents={disabled ? 'none' : 'auto'}>
        <DatePickerField value={value} mode="date" monthNames={monthNames} compact
          onChange={next => { if (!disabled) onChange(next); }} />
      </View> : null}
    </View>
  );
}

export function DatePickerField({ value, mode, monthNames, onChange, maximumDate, minimumDate, allowedMonths, compact = false }: Props) {
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
  const min = minimumDate
    ? new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate())
    : new Date(0, 0, 1);
  const canChooseMonth = (year: number, month: number) => {
    if (allowedMonths && !allowedMonths.includes(isoMonth(year, month))) return false;
    const candidate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    if (candidate < min) return false;
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
        style={[st.field, compact && st.compactField]}
      >
        <Text numberOfLines={1} style={[st.fieldText, compact && st.compactText]}>{display}</Text>
        <Text style={[st.calendar, compact && st.compactCalendar]}>▣</Text>
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={st.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={st.card}>
            {mode === 'month' ? (
              <>
                <View style={st.header}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Previous year" onPress={() => setViewYear(y => Math.max(1, y - 1))} style={st.arrow}><Text style={st.arrowText}>‹</Text></Pressable>
                  <Text style={st.title}>{viewYear}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Next year" onPress={() => setViewYear(y => Math.min(9999, y + 1))} style={st.arrow}><Text style={st.arrowText}>›</Text></Pressable>
                </View>
                <View style={st.monthGrid}>
                  {monthNames.map((name, month) => {
                    const selected = viewYear === parsed.getFullYear() && month === parsed.getMonth();
                    const enabled = canChooseMonth(viewYear, month);
                    return (
                      <Pressable
                        key={`${viewYear}-${month}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${name} ${viewYear}`}
                        accessibilityState={{ disabled: !enabled, selected }}
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
                    const enabled = candidate <= max && candidate >= min;
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
  reviewSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 40, width: '100%', paddingHorizontal: 10, borderWidth: 1.5, borderColor: C.ink40, borderRadius: 10, backgroundColor: C.paper },
  reviewOptions: { borderWidth: 1, borderColor: C.ink14, borderRadius: 10, backgroundColor: C.paper, overflow: 'hidden', alignSelf: 'stretch' },
  reviewOption: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center' },
  reviewChoiceText: { fontFamily: BODY_FONT, fontSize: 14, color: C.ink, flexShrink: 1 },
  compactField: { minHeight: 40, paddingHorizontal: 10, borderRadius: 10, gap: 6 },
  compactText: { fontFamily: BODY_FONT, fontSize: 14, flexShrink: 1 },
  compactCalendar: { fontSize: 14 },
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
