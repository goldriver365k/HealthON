/**
 * 혈압·혈당·체중 입력 양식 (새 기록 / 고치기 공용).
 * ⚠ 입력값에 대한 건강 판정 문구를 넣지 않는다. 범위 검사는 입력 실수 확인용.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, Card, ChoiceButtons, Screen, Stepper, TextField } from '@/components/ui';
import type { GlucoseTiming, Measurement, MeasurementInput, MeasurementKind } from '@/types/domain';
import { addDays, addMinutes, formatRelativeDate, formatTime } from '@/utils/date';
import { glucoseTimingLabel, kindLabel, kindUnit } from '@/utils/labels';
import { parseDecimalInRange, parseIntInRange } from '@/utils/validate';
import { spacing } from '@/theme';

interface Props {
  kind: MeasurementKind;
  initial?: Measurement;
  onSubmit: (input: MeasurementInput) => void;
  onDelete?: () => void;
}

const timingOptions = (Object.keys(glucoseTimingLabel) as GlucoseTiming[]).map((value) => ({
  value,
  label: glucoseTimingLabel[value],
}));

export function MeasurementForm({ kind, initial, onSubmit, onDelete }: Props) {
  const isEdit = !!initial;

  const [systolic, setSystolic] = useState(initial?.kind === 'bp' ? String(initial.systolic) : '');
  const [diastolic, setDiastolic] = useState(initial?.kind === 'bp' ? String(initial.diastolic) : '');
  const [pulse, setPulse] = useState(initial?.kind === 'bp' && initial.pulse ? String(initial.pulse) : '');
  const [glucose, setGlucose] = useState(initial?.kind === 'glucose' ? String(initial.glucoseMgdl) : '');
  const [timing, setTiming] = useState<GlucoseTiming>(initial?.kind === 'glucose' ? initial.glucoseTiming : 'fasting');
  const [weight, setWeight] = useState(initial?.kind === 'weight' ? initial.weightKg.toFixed(1) : '');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [measuredAt, setMeasuredAt] = useState(() => (initial ? new Date(initial.measuredAt) : new Date()));
  const [editTime, setEditTime] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [timeError, setTimeError] = useState<string | null>(null);

  const shift = (next: Date) => {
    if (next.getTime() > Date.now()) {
      setMeasuredAt(new Date());
      setTimeError('앞으로의 시각은 기록할 수 없어서 지금 시각으로 맞췄어요');
    } else {
      setMeasuredAt(next);
      setTimeError(null);
    }
  };

  const submit = () => {
    const base = { measuredAt: measuredAt.toISOString(), memo: memo.trim() || undefined };
    if (kind === 'bp') {
      const s = parseIntInRange(systolic, 'systolic');
      const d = parseIntInRange(diastolic, 'diastolic');
      const p = parseIntInRange(pulse, 'pulse', false);
      const next = {
        systolic: s && !s.ok ? s.message : null,
        diastolic: d && !d.ok ? d.message : null,
        pulse: p && !p.ok ? p.message : null,
      };
      if (!next.systolic && !next.diastolic && s?.ok && d?.ok && s.value <= d.value) {
        next.diastolic = '아래 숫자가 위 숫자보다 커요. 다시 확인해 주세요';
      }
      setErrors(next);
      if (next.systolic || next.diastolic || next.pulse || !s?.ok || !d?.ok) return;
      onSubmit({ kind: 'bp', systolic: s.value, diastolic: d.value, pulse: p?.ok ? p.value : undefined, ...base });
    } else if (kind === 'glucose') {
      const g = parseIntInRange(glucose, 'glucose');
      setErrors({ glucose: g && !g.ok ? g.message : null });
      if (!g?.ok) return;
      onSubmit({ kind: 'glucose', glucoseMgdl: g.value, glucoseTiming: timing, ...base });
    } else {
      const w = parseDecimalInRange(weight, 'weight');
      setErrors({ weight: w.ok ? null : w.message });
      if (!w.ok) return;
      onSubmit({ kind: 'weight', weightKg: w.value, ...base });
    }
  };

  const title = `${kindLabel[kind]} ${isEdit ? '고치기' : '기록하기'}`;

  return (
    <Screen
      title={title}
      showBack
      footer={<AppButton label={isEdit ? '고친 내용 저장하기' : '저장하기'} onPress={submit} large testID="save" />}>
      {kind === 'bp' && (
        <>
          <View style={styles.row}>
            <View style={styles.col}>
              <TextField label="위 숫자" value={systolic} onChangeText={setSystolic} keyboardType="number-pad" maxLength={3} big unit={kindUnit.bp} error={errors.systolic} testID="systolic" />
            </View>
            <View style={styles.col}>
              <TextField label="아래 숫자" value={diastolic} onChangeText={setDiastolic} keyboardType="number-pad" maxLength={3} big unit={kindUnit.bp} error={errors.diastolic} testID="diastolic" />
            </View>
          </View>
          <TextField label="맥박 (없으면 비워 두세요)" value={pulse} onChangeText={setPulse} keyboardType="number-pad" maxLength={3} big unit="회" error={errors.pulse} testID="pulse" />
        </>
      )}

      {kind === 'glucose' && (
        <>
          <TextField label="혈당 숫자" value={glucose} onChangeText={setGlucose} keyboardType="number-pad" maxLength={3} big unit={kindUnit.glucose} error={errors.glucose} testID="glucose" />
          <ChoiceButtons label="언제 재셨어요?" options={timingOptions} value={timing} onChange={setTiming} />
        </>
      )}

      {kind === 'weight' && (
        <TextField label="체중" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" maxLength={5} big unit={kindUnit.weight} error={errors.weight} help="예: 62.5" testID="weight" />
      )}

      <Card>
        <AppText variant="label" bold>
          잰 시각
        </AppText>
        <AppText variant="heading">
          {formatRelativeDate(measuredAt)} {formatTime(measuredAt)}
        </AppText>
        {timeError ? <AppText tone="danger">! {timeError}</AppText> : null}
        {!editTime ? (
          <AppButton label="시간 바꾸기" variant="secondary" icon="edit" onPress={() => setEditTime(true)} />
        ) : (
          <Stepper
            label="시각 조정"
            valueText={`${formatRelativeDate(measuredAt)} ${formatTime(measuredAt)}`}
            steps={[
              { label: '1시간 전', onPress: () => shift(addMinutes(measuredAt, -60)) },
              { label: '1시간 뒤', onPress: () => shift(addMinutes(measuredAt, 60)) },
              { label: '10분 전', onPress: () => shift(addMinutes(measuredAt, -10)) },
              { label: '10분 뒤', onPress: () => shift(addMinutes(measuredAt, 10)) },
              { label: '하루 전', onPress: () => shift(addDays(measuredAt, -1)) },
              { label: '지금으로', onPress: () => shift(new Date()) },
            ]}
          />
        )}
      </Card>

      <TextField label="메모 (선택)" value={memo} onChangeText={setMemo} maxLength={200} multiline placeholder="예: 아침 산책 후" />

      {onDelete ? <AppButton label="이 기록 지우기" variant="danger" icon="delete" onPress={onDelete} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  col: { flex: 1, minWidth: 140 },
});
