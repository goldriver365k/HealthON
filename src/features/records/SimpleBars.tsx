/**
 * 하루별 단순 막대 (보조 표시). 차트 라이브러리 없이 기본 View로 그린다.
 * 숫자 표와 요약 문장이 기본 정보이며, 막대는 스크린리더가 읽지 않는다.
 */
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { fromDateKey } from '@/utils/date';

const HEIGHT = 110;

/** fromZero: 횟수처럼 0부터 비교해야 하는 값 (막대 길이가 값에 비례) */
export function SimpleBars({
  data,
  caption,
  fromZero,
}: {
  /** label: 막대 아래 글 (없으면 날짜의 '일') */
  data: { dateKey: string; value: number | null; label?: string }[];
  caption: string;
  fromZero?: boolean;
}) {
  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // 차이가 작아도 막대 높이 차이가 보이도록 최저값 아래쪽 여유를 둔다
  const floor = fromZero ? 0 : min - Math.max((max - min) * 0.6, 5);
  const span = max - floor || 1;
  const showEvery = data.length > 10 ? 5 : 1;

  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <AppText variant="caption" tone="sub">
        {caption}
      </AppText>
      <View style={styles.bars}>
        {data.map((d, i) => (
          <View key={d.dateKey} style={styles.col}>
            <View style={styles.track}>
              {d.value === null ? (
                <View style={styles.empty} />
              ) : (
                <View style={[styles.bar, { height: fromZero && d.value === 0 ? 2 : Math.max(6, ((d.value - floor) / span) * HEIGHT) }]} />
              )}
            </View>
            {(data.length - 1 - i) % showEvery === 0 ? (
              <AppText variant="caption" tone="sub" maxFontSizeMultiplier={1} style={styles.day}>
                {d.label ?? fromDateKey(d.dateKey).getDate()}
              </AppText>
            ) : (
              <View style={styles.dayPlaceholder} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  col: { flex: 1, alignItems: 'center' },
  track: { height: HEIGHT, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  bar: { width: '70%', maxWidth: 28, backgroundColor: colors.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  empty: { width: '70%', maxWidth: 28, height: 2, backgroundColor: colors.border },
  day: { fontSize: 13, lineHeight: 18 },
  dayPlaceholder: { height: 18 },
});
