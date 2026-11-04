import { SymbolView } from 'expo-symbols';

import { colors, icons, sizes, type IconName } from '@/theme';

/**
 * 아이콘. 장식용이므로 스크린리더는 읽지 않는다(옆 글자가 뜻을 전달).
 */
export function AppIcon({ name, size = sizes.icon, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return (
    <SymbolView
      name={icons[name]}
      size={size}
      tintColor={color}
      accessible={false}
      importantForAccessibility="no"
      style={{ width: size, height: size }}
    />
  );
}
