import { StyleSheet, View } from 'react-native';

import { colors, sizes, spacing } from '@/theme';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

/**
 * 완료 상태 표시. 색만으로 구분하지 않고 항상 아이콘 모양 + 글자를 함께 쓴다.
 * 완료: ✓(채운 원) + "했어요" / 미완료: ○(빈 원) + "아직이에요"
 */
export function StatusMark({ done, doneText = '했어요', todoText = '아직이에요' }: { done: boolean; doneText?: string; todoText?: string }) {
  return (
    <View style={styles.row}>
      <AppIcon name={done ? 'done' : 'todo'} color={done ? colors.primary : colors.textSub} size={sizes.icon} />
      <AppText bold={done} tone={done ? 'primary' : 'sub'}>
        {done ? doneText : todoText}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
