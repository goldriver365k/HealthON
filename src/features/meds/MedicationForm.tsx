/**
 * 약 등록·고치기 양식.
 * ⚠ 앱이 약의 양·횟수·시간을 제안하거나 바꾸라고 하지 않는다. 사용자가 정한 대로만 저장.
 */
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, Card, ChoiceButtons, Notice, Screen, Stepper, TextField } from '@/components/ui';
import type { DoseSlot, MedicationInput } from '@/types/domain';
import { formatTimeOfDay, shiftTimeOfDay } from '@/utils/date';
import { doseSlotDefaultTime, doseSlotLabel } from '@/utils/labels';
import {
  applyEnvelope,
  envelopeMemo,
  mealTimingLabel,
  timesPerDayLabel,
  type FixedSlot,
  type MealTiming,
  type TimesPerDay,
} from '@/utils/medPreset';
import { checkText } from '@/utils/validate';
import { spacing } from '@/theme';

const SLOTS: FixedSlot[] = ['morning', 'noon', 'evening', 'bedtime'];
const slotOptions = SLOTS.map((value) => ({ value, label: doseSlotLabel[value] }));
// 세 칸에 들어가도록 짧게 ('하루'는 질문에 있음)
const countOptions = (Object.keys(timesPerDayLabel) as TimesPerDay[]).map((value) => ({ value, label: `${value}번` }));
const mealOptions = (Object.keys(mealTimingLabel) as MealTiming[]).map((value) => ({ value, label: mealTimingLabel[value] }));

interface Props {
  title: string;
  initial?: MedicationInput;
  onSubmit: (input: MedicationInput) => void;
  /** 고치기 화면에서 추가로 보여줄 내용 (복용 현황, 그만 먹기, 지우기) */
  extra?: ReactNode;
}

export function MedicationForm({ title, initial, onSubmit, extra }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [doseText, setDoseText] = useState(initial?.doseText ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [times, setTimes] = useState<Partial<Record<FixedSlot, string>>>(() => {
    const t: Partial<Record<FixedSlot, string>> = {};
    initial?.schedules.forEach((s) => {
      if (s.slot !== 'custom') t[s.slot] = s.timeOfDay;
    });
    return t;
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  // 약 봉투에 적힌 대로 고르기 ('' = 아직 안 고름)
  const [count, setCount] = useState<TimesPerDay | ''>('');
  const [meal, setMeal] = useState<MealTiming | ''>('');

  const pickEnvelope = (c: TimesPerDay | '', m: MealTiming | '') => {
    setCount(c);
    setMeal(m);
    setSlotError(null);
    setTimes((prev) => applyEnvelope(prev, c || null, m || null));
  };

  const selected = SLOTS.filter((s) => times[s]);

  const toggleSlot = (slot: FixedSlot) => {
    setSlotError(null);
    setTimes((prev) => {
      const next = { ...prev };
      if (next[slot]) delete next[slot];
      else next[slot] = doseSlotDefaultTime[slot];
      return next;
    });
  };

  const submit = () => {
    const nErr = checkText(name, '약 이름', 40);
    const sErr = selected.length === 0 ? '언제 드시는지 하나 이상 골라 주세요' : null;
    setNameError(nErr);
    setSlotError(sErr);
    if (nErr || sErr) return;
    // 봉투에서 고른 내용은 메모가 비어 있을 때만 메모로 남긴다
    const autoMemo = envelopeMemo(count || null, meal || null);
    onSubmit({
      name: name.trim(),
      doseText: doseText.trim() || undefined,
      memo: memo.trim() || autoMemo || undefined,
      schedules: selected.map((slot) => ({ slot, timeOfDay: times[slot]! })),
    });
  };

  return (
    <Screen title={title} showBack footer={<AppButton label="저장하기" onPress={submit} large testID="save" />}>
      <TextField label="약 이름" value={name} onChangeText={setName} maxLength={40} error={nameError} help="약 봉투나 처방전에 적힌 이름을 적어 주세요" testID="med-name" />
      <TextField label="한 번에 얼마나 (선택)" value={doseText} onChangeText={setDoseText} maxLength={20} help="예: 1알, 반 알" />

      <Card>
        <AppText variant="heading" accessibilityRole="header">
          약 봉투에 적힌 대로 고르기 (선택)
        </AppText>
        <AppText tone="sub">고르면 아래 약 시간이 자동으로 채워져요. 그다음 아래에서 고칠 수 있어요.</AppText>
        <ChoiceButtons label="하루 몇 번 드세요?" options={countOptions} value={count} onChange={(c) => pickEnvelope(c, meal)} columns={3} />
        <ChoiceButtons label="식사와 언제 드세요?" options={mealOptions} value={meal} onChange={(m) => pickEnvelope(count, m)} columns={1} />
      </Card>

      <ChoiceButtons label="언제 드세요? (여러 개 고를 수 있어요)" options={slotOptions} value={selected} onChange={toggleSlot} />
      {slotError ? <AppText tone="danger" bold>! {slotError}</AppText> : null}

      {selected.map((slot) => (
        <Card key={slot}>
          <Stepper
            label={`${doseSlotLabel[slot]} 약 시간`}
            valueText={formatTimeOfDay(times[slot]!)}
            steps={[
              { label: '30분 앞당기기', onPress: () => setTimes((p) => ({ ...p, [slot]: shiftTimeOfDay(p[slot]!, -30) })) },
              { label: '30분 늦추기', onPress: () => setTimes((p) => ({ ...p, [slot]: shiftTimeOfDay(p[slot]!, 30) })) },
            ]}
          />
        </Card>
      ))}

      <Notice text="정한 시간에 휴대폰 알림을 보내 드려요. 설정에서 끌 수 있어요." />
      <TextField label="메모 (선택)" value={memo} onChangeText={setMemo} maxLength={200} multiline placeholder="예: 식사 후에 먹기" />

      {extra ? <View style={styles.extra}>{extra}</View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  extra: { gap: spacing.md, marginTop: spacing.md },
});
