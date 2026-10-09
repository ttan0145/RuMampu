import React from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { todayIso, useApp } from '../state';
import { BodyS, Btn, BtnLine, Chip, Chips, Display, TextField } from '../ui';
import { notificationSchedulingSupported } from '../notifications';
import {
  isValidReminderDay, nextReminderDate, parseReminderTime, REMINDER_REPEATS,
  type RecordReminderKind, type ReminderRepeat, type ReminderRule,
} from '../reminder-date';

/* A new reminder starts as every day at 20:00: a calm end-of-day nudge. */
const DEFAULT_RULE: ReminderRule = { repeat: 'daily', day: 1, time: '20:00' };

/* One line describing when a reminder fires, for the Profile row. */
export function useReminderSummary() {
  const { t, monthName } = useApp();
  return (rule: ReminderRule): string => {
    switch (rule.repeat ?? 'monthly') {
      case 'daily': return t('rm_sum_daily', { t: rule.time });
      case 'weekly': return t('rm_sum_weekly', { d: t(`br_wd${rule.weekday ?? 1}`), t: rule.time });
      case 'once': {
        const [y, m, d] = (rule.date ?? todayIso()).split('-').map(Number);
        return t('rm_sum_once', { d: `${d} ${monthName(m - 1)} ${y}`, t: rule.time });
      }
      default: return t('rm_sum_monthly', { n: rule.day, t: rule.time });
    }
  };
}

/* Choose when RuMampu reminds you to record income or expenses: every day,
   every week or every month, like a repeating calendar entry. Saving turns the
   reminder on. */
const SHEET_REPEATS = REMINDER_REPEATS.filter(value => value !== 'once');
export function ReminderSheet({ kind, onClose }: { kind: RecordReminderKind | null; onClose: () => void }) {
  const { S, t, monthName, toast, setRecordReminder } = useApp();
  const [repeat, setRepeat] = React.useState<ReminderRepeat>('daily');
  const [weekday, setWeekday] = React.useState(1);
  const [day, setDay] = React.useState('1');
  const [time, setTime] = React.useState(DEFAULT_RULE.time);
  const [saving, setSaving] = React.useState(false);

  /* Opening the sheet starts from what is saved, or from the default. */
  React.useEffect(() => {
    if (!kind) return;
    const saved = S.notificationPreferences.reminders[kind] ?? DEFAULT_RULE;
    /* A one-off reminder is no longer offered here; show it as daily. */
    setRepeat(saved.repeat === 'once' ? 'daily' : saved.repeat ?? 'monthly');
    setWeekday(saved.weekday ?? 1);
    setDay(String(saved.day ?? 1));
    setTime(saved.time ?? DEFAULT_RULE.time);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const parsedDay = Number(day.trim());
  const rule: ReminderRule = {
    repeat, time, weekday,
    day: isValidReminderDay(parsedDay) ? parsedDay : 1,
  };
  const next = parseReminderTime(time) ? nextReminderDate(rule, new Date()) : null;
  const firstAsk = notificationSchedulingSupported() && !S.notificationPreferences.permission_asked;

  const save = () => {
    if (!kind) return;
    if (repeat === 'monthly' && !isValidReminderDay(parsedDay)) { toast(t('br_day_invalid'), 'error'); return; }
    if (!parseReminderTime(time)) { toast(t('br_time_invalid'), 'error'); return; }
    setSaving(true);
    void setRecordReminder(kind, rule, true).then(result => {
      if (result === 'saved') { toast(t('saved')); onClose(); }
      else toast(t('nt_denied'), 'error');
    }).catch(() => toast(t('br_failed'), 'error')).finally(() => setSaving(false));
  };

  return (
    <Modal visible={Boolean(kind)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.backdrop}>
        <View style={st.card}>
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            <Display cls="h-m">{t(kind === 'expenses' ? 'rm_expenses_t' : 'rm_income_t')}</Display>
            <BodyS muted>{t(kind === 'expenses' ? 'rm_expenses_b' : 'rm_income_b')}</BodyS>
            <BodyS muted>{t('br_repeat')}</BodyS>
            <Chips>
              {SHEET_REPEATS.map(value => (
                <Chip key={value} label={t(`br_rep_${value}`)} on={repeat === value}
                  selectionRole="radio" onPress={() => setRepeat(value)} />
              ))}
            </Chips>
            {repeat === 'weekly' ? (
              <>
                <BodyS muted>{t('br_weekday')}</BodyS>
                <Chips>
                  {[1, 2, 3, 4, 5, 6, 0].map(value => (
                    <Chip key={value} label={t(`br_wd${value}`)} on={weekday === value}
                      selectionRole="radio" onPress={() => setWeekday(value)} />
                  ))}
                </Chips>
              </>
            ) : null}
            {repeat === 'monthly' ? (
              <>
                <BodyS muted>{t('br_choose')}</BodyS>
                <TextField value={day} onChangeText={setDay} keyboardType="number-pad" inputMode="numeric"
                  accessibilityLabel={t('br_choose')} />
                <BodyS muted>{t('br_short_month')}</BodyS>
              </>
            ) : null}
            <BodyS muted>{t('br_time')}</BodyS>
            <TextField value={time} onChangeText={setTime} placeholder="20:00" accessibilityLabel={t('br_time')} />
            {next ? (
              <BodyS muted>{t('br_next', {
                d: `${next.getDate()} ${monthName(next.getMonth())} ${next.getFullYear()}`, t: time,
              })}</BodyS>
            ) : null}
            {/* AC8.22.1: before the phone's one permission prompt, one line on what RuMampu will send. */}
            {firstAsk ? <BodyS muted>{t('br_permission_why')}</BodyS> : null}
            {!notificationSchedulingSupported() ? <BodyS muted>{t('br_web_note')}</BodyS> : null}
            <Btn disabled={saving} label={saving ? t('saving') : t('save')} onPress={save} />
            <BtnLine label={t('cancel')} onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(25,35,36,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 380, maxHeight: '90%', backgroundColor: '#fff', borderRadius: 20, padding: 18 },
});
