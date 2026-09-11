import React from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Text, View } from 'react-native';
import { ApiIncomeImportBatch, previewIncomeImport, confirmIncomeImport } from '../api';
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
  const { t, go, refreshIncomeRecord } = useApp();
  const [batch, setBatch] = React.useState<ApiIncomeImportBatch | null>(null);
  const [busy, setBusy] = React.useState<'pick' | 'confirm' | null>(null);
  const [error, setError] = React.useState('');

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
    try {
      const preview = await previewIncomeImport({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        file: asset.file,
      });
      setBatch(preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('imp_failed'));
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
    if (!batch || busy || batch.status === 'confirmed' || batch.ready_count === 0) return;
    setBusy('confirm');
    setError('');
    try {
      const confirmed = await confirmIncomeImport(batch.id);
      setBatch(confirmed);
      await refreshIncomeRecord();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('imp_failed'));
    } finally {
      setBusy(null);
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
        {batch.status === 'confirmed' ? (
          <Text style={{ color: C.confirm, fontFamily: DISP_FONT, fontSize: 16, lineHeight: 22 }}>
            {t('imp_confirmed', { n: batch.imported_count })}
          </Text>
        ) : null}
      </Card>

      <StackS>
        {batch.rows.map(row => (
          <Card key={row.id} gap={5} style={{ borderLeftWidth: 4, borderLeftColor: row.is_valid ? C.confirm : C.caution }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <BodyS>{t('imp_row', { n: row.row_number })}</BodyS>
              <Badge label={row.is_valid ? t('imp_ready', { n: 1 }) : t('imp_attention', { n: 1 })} />
            </View>
            {row.is_valid ? (
              <Text style={{ color: C.ink, fontSize: 15, lineHeight: 21 }}>
                {rm(Number(row.amount))} · {row.date} · {row.source_name}
              </Text>
            ) : (
              <Text style={{ color: C.short, fontSize: 14, lineHeight: 20 }}>{row.error_message}</Text>
            )}
            <BodyS muted>{t('imp_raw', {
              amount: row.raw_amount || '—',
              date: row.raw_date || '—',
              source: row.raw_source || '—',
            })}</BodyS>
          </Card>
        ))}
      </StackS>

      {batch.status === 'preview' && batch.ready_count > 0 ? (
        <Btn
          label={busy === 'confirm' ? t('imp_confirming') : t('imp_confirm', { n: batch.ready_count })}
          onPress={() => { void confirm(); }}
        />
      ) : null}
      {batch.status === 'preview' && batch.ready_count === 0 ? (
        <NoteC><BodyS>{t('imp_no_ready')}</BodyS></NoteC>
      ) : null}
      {batch.status === 'confirmed' ? (
        <BtnLine label={t('imp_view_pattern')} onPress={() => go('pattern')} />
      ) : null}
    </>
  ) : null;

  const body = (
    <>
      {batch ? preview : picker}
      {error ? <NoteC><BodyS>{error || t('imp_failed')}</BodyS></NoteC> : null}
    </>
  );

  return embedded ? body : <ScreenShell back title={t('imp_title')}>{body}</ScreenShell>;
}

export function ImportIncomeScreen() {
  return <IncomeCsvBody />;
}
