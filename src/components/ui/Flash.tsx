import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, sizes, spacing } from '@/theme';
import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { notify } from '@/utils/confirm';

interface FlashMessage {
  message: string;
  /** 있으면 [되돌리기] 버튼 표시 */
  undo?: () => void | Promise<void>;
}

const FlashContext = createContext<(msg: FlashMessage) => void>(() => {});

/** 화면 아래 잠깐 보이는 안내줄 ("저장했어요" + 되돌리기). 6초 뒤 사라짐, 애니메이션 없음. */
export function FlashProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<FlashMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((msg: FlashMessage) => {
    if (timer.current) clearTimeout(timer.current);
    setCurrent(msg);
    AccessibilityInfo.announceForAccessibility(msg.message);
    timer.current = setTimeout(() => setCurrent(null), 6000);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <FlashContext.Provider value={show}>
      {children}
      {current ? (
        <View style={[styles.bar, { bottom: insets.bottom + 96 }]} accessibilityLiveRegion="polite">
          <AppText tone="onPrimary" bold style={styles.text}>
            {current.message}
          </AppText>
          {current.undo ? (
            <AppButton
              label="되돌리기"
              variant="secondary"
              block={false}
              onPress={() => {
                Promise.resolve(current.undo?.()).catch((e: unknown) =>
                  notify('되돌리지 못했어요', e instanceof Error ? e.message : undefined),
                );
                setCurrent(null);
              }}
            />
          ) : null}
        </View>
      ) : null}
    </FlashContext.Provider>
  );
}

export function useFlash() {
  return useContext(FlashContext);
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: sizes.screenPadding,
    right: sizes.screenPadding,
    backgroundColor: colors.text,
    borderRadius: sizes.radius,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: { flex: 1 },
});
