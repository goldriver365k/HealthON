import { StyleSheet, Text, type TextProps } from 'react-native';

import { useFontScale } from '@/data/store';
import { colors, fontFamily, fontSize, lineHeightRatio, maxFontSizeMultiplier, type TextVariant } from '@/theme';

type Tone = 'default' | 'sub' | 'primary' | 'danger' | 'onPrimary' | 'sample';

const toneColor: Record<Tone, string> = {
  default: colors.text,
  sub: colors.textSub,
  primary: colors.primary,
  danger: colors.danger,
  onPrimary: colors.textOnPrimary,
  sample: colors.sampleText,
};

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: Tone;
  bold?: boolean;
  center?: boolean;
}

/**
 * 앱의 모든 글씨. 글씨 크기는 theme/typography 기준 × 앱 글씨 배율.
 * 휴대폰 글씨 확대 설정도 반영된다(최대 배율 제한).
 */
export function AppText({ variant = 'body', tone = 'default', bold, center, style, ...rest }: AppTextProps) {
  const scale = useFontScale();
  const size = Math.round(fontSize[variant] * scale);
  const isHeavy = variant === 'title' || variant === 'date' || variant === 'number' || variant === 'heading';
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        {
          fontSize: size,
          lineHeight: Math.round(size * lineHeightRatio),
          color: toneColor[tone],
          // 굵기는 서체 파일로 정한다 (사용자 지정 서체에 fontWeight를 함께 주면 기기에 따라 다른 서체로 바뀔 수 있음)
          fontFamily: bold || isHeavy ? fontFamily.bold : fontFamily.regular,
        },
        center && styles.center,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
