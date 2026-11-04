/**
 * 앱 데이터 공급자.
 * - 체험 모드: 메모리 저장소 + 예시 데이터 (1단계와 같음)
 * - 서버 모드: 로그인한 사용자의 데이터를 Supabase에서 불러오고, 바꾸면 서버에 저장
 * 화면은 useAppState()(읽기)와 useRepository()(쓰기)만 쓰므로 어느 모드인지 몰라도 된다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';

import { dataMode } from './config';
import { createMemoryRepository } from './memoryRepository';
import { reducer } from './reducer';
import type { Repository } from './repository';
import { createEmptyState, createSampleState, type AppState } from './sampleData';
import { createCloudRepository, loadAll } from './supabase/repository';

export type DataStatus = 'loading' | 'ready' | 'error';

interface AppDataContextValue {
  state: AppState;
  repo: Repository;
  status: DataStatus;
  reload: () => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    dataMode === 'demo' ? createSampleState() : createEmptyState(),
  );
  const [status, setStatus] = useState<DataStatus>(dataMode === 'demo' ? 'ready' : 'loading');
  const stateRef = useRef(state);
  stateRef.current = state;

  const reload = useCallback(() => {
    if (dataMode !== 'cloud') return;
    setStatus('loading');
    loadAll()
      .then((data) => {
        dispatch({ type: 'hydrate', data });
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const repo = useMemo<Repository>(
    () => (dataMode === 'cloud' ? createCloudRepository(dispatch, () => stateRef.current) : createMemoryRepository(dispatch)),
    [],
  );

  const value = useMemo(() => ({ state, repo, status, reload }), [state, repo, status, reload]);
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

function useAppDataContext(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('AppDataProvider 안에서만 사용할 수 있습니다');
  return ctx;
}

/** 현재 데이터 (읽기) */
export function useAppState(): AppState {
  return useAppDataContext().state;
}

/** 데이터 바꾸기 (쓰기) */
export function useRepository(): Repository {
  return useAppDataContext().repo;
}

/** 불러오기 상태 (서버 모드) */
export function useDataStatus(): { status: DataStatus; reload: () => void } {
  const { status, reload } = useAppDataContext();
  return { status, reload };
}

/**
 * 글씨 배율. 로그인·동의 화면처럼 데이터 공급자 밖에서도 쓰이므로 없으면 기본값 1.
 */
export function useFontScale(): number {
  return useContext(AppDataContext)?.state.settings.fontScale ?? 1;
}
