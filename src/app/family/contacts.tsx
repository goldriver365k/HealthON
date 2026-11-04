/** 긴급 연락처 관리 (추가·지우기). 순서대로 가족 안심 화면에 전화 버튼이 생긴다. */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, Card, EmptyState, SampleBadge, Screen, TextField, useFlash } from '@/components/ui';
import { useAppState, useRepository } from '@/data/store';
import { spacing } from '@/theme';
import { useSafeAction } from '@/hooks/useSafeAction';
import { confirmAsync } from '@/utils/confirm';
import { checkPhone } from '@/utils/phone';
import { checkText } from '@/utils/validate';

export default function ContactsScreen() {
  const state = useAppState();
  const repo = useRepository();
  const flash = useFlash();
  const { run } = useSafeAction();
  const contacts = [...state.emergencyContacts].sort((a, b) => a.priority - b.priority);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [errors, setErrors] = useState<{ name?: string | null; phone?: string | null }>({});

  const add = () => run(async () => {
    const next = { name: checkText(name, '이름', 20), phone: checkPhone(phone) };
    setErrors(next);
    if (next.name || next.phone) return;
    await repo.addEmergencyContact({ name: name.trim(), phone: phone.trim(), relationLabel: relation.trim() || undefined });
    setName('');
    setPhone('');
    setRelation('');
    flash({ message: '긴급 연락처를 추가했어요' });
  });

  return (
    <Screen title="긴급 연락처" subtitle="급할 때 바로 전화할 사람" showBack>
      <Card>
        {contacts.length === 0 ? <EmptyState text="등록한 연락처가 없어요." /> : null}
        {contacts.map((c, i) => (
          <View key={c.id} style={styles.row}>
            <View style={styles.info}>
              <View style={styles.line}>
                <AppText variant="heading">
                  {i + 1}. {c.name}
                  {c.relationLabel ? ` (${c.relationLabel})` : ''}
                </AppText>
                <SampleBadge source={c.source} />
              </View>
              <AppText tone="sub">{c.phone}</AppText>
            </View>
            <AppButton
              label="지우기"
              variant="ghost"
              block={false}
              accessibilityLabel={`${c.name} 연락처 지우기`}
              onPress={() =>
                run(async () => {
                  const ok = await confirmAsync({ title: `${c.name} 연락처를 지울까요?`, confirmLabel: '지우기', destructive: true });
                  if (ok) await repo.deleteEmergencyContact(c.id);
                })
              }
            />
          </View>
        ))}
      </Card>

      <Card>
        <AppText variant="heading">새 연락처 추가</AppText>
        <TextField label="이름" value={name} onChangeText={setName} maxLength={20} error={errors.name} />
        <TextField label="전화번호" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={13} error={errors.phone} placeholder="010-0000-0000" />
        <TextField label="관계 (선택)" value={relation} onChangeText={setRelation} maxLength={10} placeholder="예: 딸" />
        <AppButton label="추가하기" icon="add" onPress={add} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  info: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
