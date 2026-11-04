import { useCallback, useRef, useState } from 'react';

import { notify } from '@/utils/confirm';

/**
 * 저장·삭제 같은 작업을 안전하게 실행한다.
 * - 실패하면 한국어 안내창을 띄우고 화면은 그대로 둔다 (입력한 내용이 사라지지 않음)
 * - 실행 중 버튼을 여러 번 눌러도 한 번만 실행 (busy)
 */
export function useSafeAction() {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const run = useCallback(async (fn: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify('하지 못했어요', e instanceof Error && e.message ? e.message : '잠시 뒤 다시 해 주세요.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  return { run, busy };
}
