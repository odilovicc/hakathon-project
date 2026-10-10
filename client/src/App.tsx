import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { MotionConfig } from 'framer-motion';
import { applyTheme, useUi } from '@/store/ui';
import { PetPlayground } from '@/pages/PetPlayground';
import { Auth } from '@/pages/Auth';
import { Onboarding } from '@/pages/Onboarding';
import { useMe } from '@/lib/queries';
import { Flow, ErrorMessage } from '@/ui/Flow';
import { Button } from '@/ui/Button';

const Cabinet = lazy(() =>
  import('@/components/Cabinet').then((module) => ({ default: module.Cabinet })),
);
const Landing = lazy(() =>
  import('@/pages/Landing').then((module) => ({ default: module.Landing })),
);

function Entry({ onboarding = false }: { onboarding?: boolean }) {
  const me = useMe();
  if (me.isPending)
    return (
      <Flow>
        <main className="flow-card centered" role="status">
          Открываем кубышку…
        </main>
      </Flow>
    );
  if (me.isError)
    return (
      <Flow>
        <main className="flow-card centered">
          <ErrorMessage message={me.error.message} />
          <Button onClick={() => void me.refetch()}>Попробовать снова</Button>
        </main>
      </Flow>
    );
  if (!me.data) return <Navigate to="/login" replace />;
  if (!me.data.profile.onboardingDone || !me.data.hasPet)
    return onboarding ? <Onboarding /> : <Navigate to="/onboarding" replace />;
  return onboarding ? (
    <Navigate to="/app" replace />
  ) : (
    <Suspense
      fallback={
        <Flow>
          <main className="flow-card centered" role="status">
            Открываем кабинет…
          </main>
        </Flow>
      }
    >
      <Cabinet />
    </Suspense>
  );
}

export function App() {
  const theme = useUi((s) => s.theme);
  useEffect(() => applyTheme(theme), [theme]);

  return (
    // reducedMotion="user": при prefers-reduced-motion Framer оставляет только opacity.
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Suspense
                fallback={
                  <main className="flow-card centered" role="status">
                    Открываем Кубышку…
                  </main>
                }
              >
                <Landing />
              </Suspense>
            }
          />
          <Route path="/login" element={<Auth key="login" />} />
          <Route path="/register" element={<Auth key="register" register />} />
          <Route path="/onboarding" element={<Entry onboarding />} />
          <Route path="/app/*" element={<Entry />} />
          <Route path="/playground" element={<PetPlayground />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  );
}
