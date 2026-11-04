/** 병원 방문 일정 입력 양식 (새 일정 / 고치기 공용) */
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, ChoiceButtons, Card, Notice, Screen, Stepper, TextField } from '@/components/ui';
import type { AppointmentInput, RemindBefore } from '@/types/domain';
import { addDays, addMinutes, formatLongDate, formatRelativeDate, formatTime, startOfDay } from '@/utils/date';
import { remindBeforeLabel } from '@/utils/labels';
import { checkText } from '@/utils/validate';
import { spacing } from '@/theme';

const remindOptions = (Object.keys(remindBeforeLabel) as RemindBefore[]).map((value) => ({
  value,
  label: remindBeforeLabel[value],
}));

interface Props {
  title: string;
  initial?: AppointmentInput;
  onSubmit: (input: AppointmentInput) => void;
  /** 고치기 화면에서 보여줄 질문 메모·지우기 버튼 */
  extra?: ReactNode;
}

function defaultVisitAt(): Date {
  // 기본값: 내일 오전 10시
  const d = addDays(startOfDay(new Date()), 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

export function AppointmentForm({ title, initial, onSubmit, extra }: Props) {
  const [hospitalName, setHospitalName] = useState(initial?.hospitalName ?? '');
  const [department, setDepartment] = useState(initial?.department ?? '');
  const [visitAt, setVisitAt] = useState(() => (initial ? new Date(initial.visitAt) : defaultVisitAt()));
  const [remindBefore, setRemindBefore] = useState<RemindBefore>(initial?.remindBefore ?? 'day_before');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [nameError, setNameError] = useState<string | null>(null);

  const setDay = (day: Date) => {
    const next = new Date(day);
    next.setHours(visitAt.getHours(), visitAt.getMinutes(), 0, 0);
    setVisitAt(next);
  };

  const submit = () => {
    const err = checkText(hospitalName, '병원 이름', 40);
    setNameError(err);
    if (err) return;
    onSubmit({
      hospitalName: hospitalName.trim(),
      department: department.trim() || undefined,
      visitAt: visitAt.toISOString(),
      remindBefore,
      memo: memo.trim() || undefined,
    });
  };

  const today = startOfDay(new Date());

  return (
    <Screen title={title} showBack footer={<AppButton label="저장하기" onPress={submit} large testID="save" />}>
      <TextField label="병원 이름" value={hospitalName} onChangeText={setHospitalName} maxLength={40} error={nameError} testID="hospital" />
      <TextField label="진료과 (선택)" value={department} onChangeText={setDepartment} maxLength={20} help="예: 내과, 정형외과" />

      <Card>
        <Stepper
          label="가는 날"
          valueText={`${formatRelativeDate(visitAt)}`}
          spokenValue={formatLongDate(visitAt)}
          steps={[
            { label: '오늘', onPress: () => setDay(today) },
            { label: '내일', onPress: () => setDay(addDays(today, 1)) },
            { label: '하루 앞으로', onPress: () => setDay(addDays(startOfDay(visitAt), -1)) },
            { label: '하루 뒤로', onPress: () => setDay(addDays(startOfDay(visitAt), 1)) },
            { label: '일주일 뒤로', onPress: () => setDay(addDays(startOfDay(visitAt), 7)) },
          ]}
        />
        <AppText tone="sub" center>
          {formatLongDate(visitAt)}
        </AppText>
      </Card>

      <Card>
        <Stepper
          label="가는 시각"
          valueText={formatTime(visitAt)}
          steps={[
            { label: '1시간 앞당기기', onPress: () => setVisitAt(addMinutes(visitAt, -60)) },
            { label: '1시간 늦추기', onPress: () => setVisitAt(addMinutes(visitAt, 60)) },
            { label: '10분 앞당기기', onPress: () => setVisitAt(addMinutes(visitAt, -10)) },
            { label: '10분 늦추기', onPress: () => setVisitAt(addMinutes(visitAt, 10)) },
          ]}
        />
      </Card>

      <ChoiceButtons label="알림" options={remindOptions} value={remindBefore} onChange={setRemindBefore} columns={1} />
      <Notice text="고른 때에 휴대폰 알림을 보내 드려요. 설정에서 끌 수 있어요." />
      <TextField label="메모 (선택)" value={memo} onChangeText={setMemo} maxLength={200} multiline placeholder="예: 신분증, 약 봉투 챙기기" />

      {extra ? <View style={styles.extra}>{extra}</View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  extra: { gap: spacing.md, marginTop: spacing.md },
});
