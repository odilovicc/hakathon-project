import { lazy, Suspense, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router';
import { Bank, House, ListBullets, Plus, Repeat, SignOut, Target } from '@phosphor-icons/react';
import { useLogout, usePet, useWardrobe } from '@/lib/queries';
import { auraTierFor } from '@shared/pet';
import { Kubysh } from '@/pet/Kubysh';
import { ThemeSwitch } from '@/ui/ThemeSwitch';
import { Button } from '@/ui/Button';
import { ErrorMessage } from '@/ui/Flow';
import { TransactionForm } from './TransactionForm';
import '@/styles/cabinet.css';

const Home = lazy(() => import('@/pages/Home').then((module) => ({ default: module.Home })));
const GoalPage = lazy(() =>
  import('@/pages/Goal').then((module) => ({ default: module.GoalPage })),
);
const Transactions = lazy(() =>
  import('@/pages/Transactions').then((module) => ({ default: module.Transactions })),
);
const MuseumPage = lazy(() =>
  import('@/pages/Museum').then((module) => ({ default: module.MuseumPage })),
);
const SubscriptionsPage = lazy(() =>
  import('@/pages/Subscriptions').then((module) => ({ default: module.SubscriptionsPage })),
);

export function Cabinet() {
  const [add, setAdd] = useState(false);
  const logout = useLogout();
  const pet = usePet();
  const wardrobe = useWardrobe();
  const location = useLocation();
  const reduced = useReducedMotion();
  const hasOperationAction =
    location.pathname === '/app' || location.pathname === '/app/transactions';
  return (
    <div className="cabinet">
      <aside className="cabinet-sidebar">
        <Link to="/app" className="brand">
          кубышка<span>.</span>
        </Link>
        <nav aria-label="Разделы кабинета">
          <NavLink to="/app" end>
            <House weight="duotone" size={23} />
            Сегодня
          </NavLink>
          <NavLink to="/app/transactions">
            <ListBullets weight="duotone" size={23} />
            Операции
          </NavLink>
          <NavLink to="/app/goal">
            <Target weight="duotone" size={23} />
            Цель
          </NavLink>
          <NavLink to="/app/museum">
            <Bank weight="duotone" size={23} />
            Музей
          </NavLink>
          <NavLink to="/app/subscriptions">
            <Repeat weight="duotone" size={23} />
            Подписки
          </NavLink>
        </nav>
        <div className="sidebar-pet">
          {pet.data && (
            <>
              <Kubysh
                mood={pet.data.mood}
                stage={pet.data.stage}
                auraTier={auraTierFor(pet.data.careDays)}
                size={48}
                costumes={wardrobe.data
                  ?.filter((c) => c.isActive && !c.isLockedBack)
                  .map((c) => c.key)}
              />
              <span>
                {pet.data.name}
                <small>{pet.data.careDays} дн. заботы</small>
              </span>
            </>
          )}
        </div>
      </aside>
      <div className="cabinet-body">
        <a href="#page-content" className="skip-link">
          К содержимому
        </a>
        <header className="cabinet-header">
          <Link to="/app" className="brand mobile-brand">
            кубышка<span>.</span>
          </Link>
          <ThemeSwitch />
          <button
            className="icon-button"
            type="button"
            title="Выйти"
            aria-label="Выйти"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <SignOut size={23} />
          </button>
          <Button
            variant="secondary"
            onClick={() => setAdd(true)}
            className={`quick-add ${hasOperationAction ? 'quick-add-redundant' : ''}`}
          >
            <Plus size={20} />
            Записать операцию
          </Button>
        </header>
        <ErrorMessage message={logout.error?.message} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            id="page-content"
            tabIndex={-1}
            key={location.pathname}
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 8 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense
              fallback={
                <p className="list-status" role="status">
                  Открываем страницу…
                </p>
              }
            >
              <Routes location={location}>
                <Route index element={<Home onAdd={() => setAdd(true)} />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="goal" element={<GoalPage />} />
                <Route path="museum" element={<MuseumPage />} />
                <Route path="subscriptions" element={<SubscriptionsPage />} />
                <Route path="*" element={<Navigate to="/app" replace />} />
              </Routes>
            </Suspense>
          </motion.main>
        </AnimatePresence>
      </div>
      {add && <TransactionForm onClose={() => setAdd(false)} />}
    </div>
  );
}
