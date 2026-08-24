import React from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Text, View } from 'react-native';
import { ApiIncomeImportBatch, previewIncomeImport, confirmIncomeImport } from '../api';
import { rm } from '../calc';
import { useApp } from '../state';
import { C, DISP_FONT } from '../theme';
import { Badge, BodyS, Btn, BtnLine, Card, Display, NoteC, StackS } from '../ui';
import { ScreenShell } from './shell';

export function ImportIncomeScreen() {
  const { t, go, refreshIncomeRecord } = useApp();
  const [batch, setBatch] = React.useState<ApiIncomeImportBatch | null>(null);
  const [busy, setBusy] = React.useState<'pick' | 'confirm' | null>(null);
  const [error, setError] = React.useState('');

  const chooseFile = async () => {
    if (busy) return;
    setBusy('pick');
    setError('');
    setBatch(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
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

  return (
    <ScreenShell back title={t('imp_title')}>
      <Display cls="h-m">{t('imp_intro')}</Display>
      <Card gap={8}>
        <BodyS muted>{t('imp_format')}</BodyS>
        <Btn label={busy === 'pick' ? t('imp_reading') : t('imp_select')} onPress={() => { void chooseFile(); }} />
      </Card>

      {error ? <NoteC><BodyS>{error || t('imp_failed')}</BodyS></NoteC> : null}

      {batch ? (
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
      ) : null}
    </ScreenShell>
  );
}
