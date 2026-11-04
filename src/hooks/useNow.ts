import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * 현재 시각. 1분마다, 그리고 앱을 다시 열 때 새로 고친다.
 * (밤 12시가 지나면 '오늘' 화면이 다음 날로 바뀌도록)
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return now;
}
