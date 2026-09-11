import React from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ApiError,
  ApiIncomeImportBatch,
  ApiIncomeImportRow,
  confirmIncomeImport,
  previewIncomeImport,
  updateIncomeImportRow,
} from '../api';
import { rm } from '../calc';
import { useApp } from '../state';
import { C, DISP_FONT } from '../theme';
import { Badge, BodyS, Btn, BtnLine, Card, Display, NoteC, StackS } from '../ui';
import { Drop } from '../incard';
import { ScreenShell } from './shell';

const INCOME_CSV_SAMPLE = [
  'amount,date,source',
  '880,2026-03-06,Grab weekly payout',
  '927,2026-03-13,Grab weekly payout',
  '550,2026-03-14,Freelance design',
].join('\n');

type IncomeCsvBodyProps = { embedded?: boolean };
type ImportRowDraft = {
  rowId: number;
  amount: string;
  date: string;
  source: string;
};

function importError(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError && caught.payload && typeof caught.payload === 'object') {
    const body = caught.payload as { error?: { fields?: Record<string, string[] | string> } };
    const fields = body.error?.fields;
    for (const key of ['row', 'batch']) {
      const detail = fields?.[key];
      if (Array.isArray(detail) && detail[0]) return detail[0];
      if (typeof detail === 'string' && detail) return detail;
    }
  }
  return caught instanceof Error ? caught.message : fallback;
}

/**
 * EN: US1.8 separates file selection/preview from confirmation, then refreshes authoritative income.
 * 中文：US1.8 分开文件选择/预览与确认，确认后再刷新权威收入记录。
 */
/**
 * EN: The CSV flow is shared by the embedded Income › Import tab and the
 * legacy standalone route. Keeping the request/confirmation state here means
 * both entry points use the same US1.8 contract.
 * 中文：CSV 流程同时供 Income › Import 标签和旧的独立路由使用，确保两个入口共用同一套 US1.8 接口与确认状态。
 */
export function IncomeCsvBody({ embedded = false }: IncomeCsvBodyProps) {
  const { t, go, refreshIncomeRecord, toast } = useApp();
  const [batch, setBatch] = React.useState<ApiIncomeImportBatch | null>(null);
  const [busy, setBusy] = React.useState<'pick' | 'confirm' | null>(null);
  const [error, setError] = React.useState('');
  const [editDraft, setEditDraft] = React.useState<ImportRowDraft | null>(null);
  const [editBusy, setEditBusy] = React.useState(false);
  const [editError, setEditError] = React.useState('');
  const [patternAvailable, setPatternAvailable] = React.useState(false);

  const previewFile = async (asset: {
    uri: string;
    name: string;
    mimeType?: string | null;
    file?: File;
  }) => {
    if (busy) return;
    setBusy('pick');
    setError('');
    setBatch(null);
    setEditDraft(null);
    setEditError('');
    try {
      const preview = await previewIncomeImport({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        file: asset.file,
      });
      setBatch(preview);
    } catch (caught) {
      setError(importError(caught, t('imp_failed')));
    } finally {
      setBusy(null);
    }
  };

  const chooseFile = async () => {
    if (busy) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      await previewFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        file: asset.file,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('imp_failed'));
    }
  };

  const downloadTemplate = () => {
    if (typeof document === 'undefined') return;
    const blob = new Blob([
      'amount,date,source\n100.00,2026-01-15,Freelance project\n',
    ], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'rumampu-income-template.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const trySample = () => {
    if (typeof File === 'undefined') {
      setError(t('imp_failed'));
      return;
    }
    const file = new File([INCOME_CSV_SAMPLE], 'rumampu-income-sample.csv', { type: 'text/csv' });
    void previewFile({ uri: '', name: file.name, mimeType: file.type, file });
  };

  const confirm = async () => {
    if (!batch || busy || editDraft || batch.status === 'confirmed' || batch.ready_count === 0) return;
    setBusy('confirm');
    setError('');
    try {
      const confirmed = await confirmIncomeImport(batch.id);
      setBatch(null);
      setPatternAvailable(true);
      setEditDraft(null);
      toast(t('imp_confirmed', { n: confirmed.imported_count }));
      await refreshIncomeRecord();
    } catch (caught) {
      setError(importError(caught, t('imp_failed')));
    } finally {
      setBusy(null);
    }
  };

  const editRow = (row: ApiIncomeImportRow) => {
    setEditDraft({
      rowId: row.id,
      amount: row.amount ?? row.raw_amount,
      date: row.date ?? row.raw_date,
      source: row.source_name || row.raw_source,
    });
    setEditError('');
  };

  const saveRow = async () => {
    if (!batch || !editDraft || editBusy) return;
    setEditBusy(true);
    setEditError('');
    try {
      const updated = await updateIncomeImportRow(batch.id, editDraft.rowId, {
        amount: editDraft.amount,
        date: editDraft.date,
        source: editDraft.source,
      });
      setBatch(updated);
      setEditDraft(null);
      toast(t('ie_saved'));
    } catch (caught) {
      setEditError(importError(caught, t('imp_failed')));
    } finally {
      setEditBusy(false);
    }
  };

  const picker = embedded ? (
    <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, gap: 10 }}>
      <Drop
        icon="csv"
        title={t('cvi_pick')}
        hint={t('cv_hint')}
        onPress={() => { void chooseFile(); }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
        <BtnLine label={t('cv_tpl')} onPress={downloadTemplate} style={{ fontSize: 14 }} />
        <BtnLine label={t('cv_sample')} onPress={trySample} style={{ fontSize: 14 }} />
      </View>
    </View>
  ) : (
    <>
      <Display cls="h-m">{t('imp_intro')}</Display>
      <Card gap={8}>
        <BodyS muted>{t('imp_format')}</BodyS>
        <Btn label={busy === 'pick' ? t('imp_reading') : t('imp_select')} onPress={() => { void chooseFile(); }} />
      </Card>
    </>
  );

  const preview = batch ? (
    <>
      <Card gap={10}>
        <BodyS muted>{t('imp_summary', { name: batch.file_name, total: batch.total_rows })}</BodyS>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Badge label={t('imp_ready', { n: batch.ready_count })} />
          {batch.error_count ? <Badge label={t('imp_attention', { n: batch.error_count })} /> : null}
        </View>
      </Card>

      <StackS>
        {batch.rows.map(row => {
          const editing = editDraft?.rowId === row.id;
          return (
            <Card key={row.id} gap={8} style={{ borderLeftWidth: 4, borderLeftColor: row.is_valid ? C.confirm : C.caution }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <BodyS>{t('imp_row', { n: row.row_number })}</BodyS>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Badge label={row.is_valid ? t('imp_ready', { n: 1 }) : t('imp_attention', { n: 1 })} />
                  {!editDraft ? (
                    <Pressable
                      onPress={() => editRow(row)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('edit')} ${t('imp_row', { n: row.row_number })}`}
                      style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.65 }]}
                    >
                      <Text style={styles.editButtonText}>{t('edit')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {editing && editDraft ? (
                <View style={styles.editor}>
                  <BodyS muted>{t('inc_amount')}</BodyS>
                  <TextInput
                    value={editDraft.amount}
                    onChangeText={amount => setEditDraft(current => current ? { ...current, amount } : current)}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    accessibilityLabel={`${t('inc_amount')} ${t('imp_row', { n: row.row_number })}`}
                    placeholderTextColor={C.ink40}
                    style={styles.input}
                  />
                  <BodyS muted>{t('inc_date')}</BodyS>
                  <TextInput
                    value={editDraft.date}
                    onChangeText={date => setEditDraft(current => current ? { ...current, date } : current)}
                    accessibilityLabel={`${t('inc_date')} ${t('imp_row', { n: row.row_number })}`}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={C.ink40}
                    style={styles.input}
                  />
                  <BodyS muted>{t('inc_source')}</BodyS>
                  <TextInput
                    value={editDraft.source}
                    onChangeText={source => setEditDraft(current => current ? { ...current, source } : current)}
                    accessibilityLabel={`${t('inc_source')} ${t('imp_row', { n: row.row_number })}`}
                    placeholderTextColor={C.ink40}
                    style={styles.input}
                  />
                  {editError ? <Text style={styles.editError}>{editError}</Text> : null}
                  <Btn
                    label={editBusy ? t('inc_saving') : t('ie_save')}
                    disabled={editBusy}
                    onPress={() => { void saveRow(); }}
                  />
                  <View style={{ alignItems: 'center' }}>
                    <BtnLine
                      label={t('cancel')}
                      onPress={() => { setEditDraft(null); setEditError(''); }}
                      style={{ fontSize: 13.5 }}
                    />
                  </View>
                </View>
              ) : (
                <>
                  {row.is_valid ? (
                    <Text style={{ color: C.ink, fontSize: 15, lineHeight: 21 }}>
                      {rm(Number(row.amount))} · {row.date} · {row.source_name}
                    </Text>
                  ) : (
                    <Text style={{ color: C.short, fontSize: 14, lineHeight: 20 }}>{row.error_message}</Text>
                  )}
                </>
              )}
              <BodyS muted>{t('imp_raw', {
                amount: row.raw_amount || '—',
                date: row.raw_date || '—',
                source: row.raw_source || '—',
              })}</BodyS>
            </Card>
          );
        })}
      </StackS>

      {batch.status === 'preview' && batch.ready_count > 0 ? (
        <Btn
          label={busy === 'confirm' ? t('imp_confirming') : t('imp_confirm', { n: batch.ready_count })}
          disabled={Boolean(editDraft)}
          onPress={() => { void confirm(); }}
        />
      ) : null}
      {batch.status === 'preview' && batch.ready_count === 0 ? (
        <NoteC><BodyS>{t('imp_no_ready')}</BodyS></NoteC>
      ) : null}
    </>
  ) : null;

  const body = (
    <>
      {batch ? preview : picker}
      {patternAvailable ? (
        <View style={{ alignItems: 'center' }}>
          <BtnLine label={t('imp_view_pattern')} onPress={() => go('pattern')} />
        </View>
      ) : null}
      {error ? <NoteC><BodyS>{error || t('imp_failed')}</BodyS></NoteC> : null}
    </>
  );

  return embedded ? body : <ScreenShell back title={t('imp_title')}>{body}</ScreenShell>;
}

export function ImportIncomeScreen() {
  return <IncomeCsvBody />;
}

const styles = StyleSheet.create({
  editButton: {
    minHeight: 32,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: C.brand,
    fontFamily: DISP_FONT,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  editor: {
    gap: 6,
    paddingTop: 2,
  },
  input: {
    minHeight: 42,
    backgroundColor: C.paper,
    borderWidth: 1.5,
    borderColor: C.ink40,
    borderRadius: 12,
    paddingHorizontal: 11,
    fontSize: 14,
    color: C.ink,
  },
  editError: {
    color: C.short,
    fontSize: 13,
    lineHeight: 18,
  },
});
