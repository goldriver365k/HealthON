import { Alert, Platform } from 'react-native';

/**
 * "정말 할까요?" 확인창. 기본 Alert 사용(추가 패키지 없음).
 * 웹 미리보기에서는 브라우저 confirm 으로 대신한다.
 */
export function confirmAsync(options: {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const { title, message, confirmLabel, cancelLabel = '그만두기', destructive } = options;

  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(text) : false);
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** 간단한 안내창 */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message, [{ text: '확인' }]);
}
