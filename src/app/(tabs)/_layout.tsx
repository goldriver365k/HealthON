import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, AppText } from '@/components/ui';
import { colors, fontFamily, fontSize, shadows, spacing, type IconName } from '@/theme';

/**
 * 하단 메뉴 4개 고정.
 * 선택된 탭: 배경색 + 굵은 글씨 + 진한 아이콘 (색만으로 구분하지 않도록 글씨 굵기와 배경을 함께 바꿈)
 */
const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: '오늘', icon: 'today' },
  { name: 'records', title: '건강기록', icon: 'records' },
  { name: 'meds', title: '약·병원', icon: 'meds' },
  { name: 'family', title: '가족 안심', icon: 'family' },
];

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveBackgroundColor: colors.primarySoft,
        tabBarStyle: {
          height: 80 + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          boxShadow: shadows.tabBar,
        },
        tabBarItemStyle: { paddingVertical: spacing.xs },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarAccessibilityLabel: `${t.title} 메뉴`,
            tabBarIcon: ({ focused }) => (
              <AppIcon name={t.icon} size={30} color={focused ? colors.primary : colors.tabInactive} />
            ),
            tabBarLabel: ({ focused }) => (
              // 탭 이름은 앱 글씨 배율과 상관없이 17pt 고정 (4개가 한 줄에 다 보이도록)
              <AppText variant="caption" bold={focused} tone={focused ? 'primary' : 'sub'} numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.tabLabel}>
                {t.title}
              </AppText>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: fontSize.caption, lineHeight: 24, fontFamily: fontFamily.regular },
});
