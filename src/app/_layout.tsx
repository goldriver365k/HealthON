/**
 * 앱 전체 틀.
 * 🔒 화면 접근 순서: 로그인 → 필수 동의 → 앱 화면. 조건이 맞지 않으면 화면 자체가 열리지 않는다.
 *    (체험 모드는 로그인·동의 없이 바로 앱 화면 — 예시 데이터만 다룸)
 * 화면 전환 효과는 기본값만 사용.
 */
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { FlashProvider } from '@/components/ui';
import { LoadingView } from '@/components/ui/LoadingView';
import { AuthProvider, useAuth } from '@/data/auth';
import { AppDataProvider, useDataStatus } from '@/data/store';
import { NotificationSync } from '@/notifications/NotificationSync';
import { colors } from '@/theme';

const APP_SCREENS = [
  '(tabs)',
  'record/new',
  'record/[id]',
  'meds/new',
  'meds/[id]',
  'appointments/new',
  'appointments/[id]',
  'family/[linkId]',
  'family/invite',
  'family/join',
  'family/contacts',
  'settings',
  'notifications-intro',
] as const;

function RootStack({ signedIn, ready }: { signedIn: boolean; ready: boolean }) {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !ready}>
        <Stack.Screen name="consent" />
      </Stack.Protected>
      <Stack.Protected guard={ready}>
        {APP_SCREENS.map((name) => (
          <Stack.Screen key={name} name={name} />
        ))}
      </Stack.Protected>
    </Stack>
  );
}

/** 서버 모드: 데이터를 다 불러온 뒤 앱 화면을 보여준다 */
function DataGate() {
  const { status, reload } = useDataStatus();
  if (status !== 'ready') return <LoadingView error={status === 'error'} onRetry={reload} />;
  return (
    <>
      <NotificationSync />
      <RootStack signedIn ready />
    </>
  );
}

function Root() {
  const auth = useAuth();
  if (auth.initializing) return <LoadingView />;
  const signedIn = !!auth.userId;
  const ready = signedIn && auth.hasAllConsents;
  if (!ready) return <RootStack signedIn={signedIn} ready={false} />;
  return (
    // 사용자가 바뀌면 데이터 공급자를 새로 만든다 (이전 사용자 데이터가 남지 않도록)
    <AppDataProvider key={auth.userId}>
      <DataGate />
    </AppDataProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <FlashProvider>
        <StatusBar style="dark" />
        <Root />
      </FlashProvider>
    </AuthProvider>
  );
}
