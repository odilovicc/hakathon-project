import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  Category,
  TxKind,
  Costume,
  GoalDetails,
  GoalChange,
  GoalTransferInput,
  CheckinResponse,
  Dashboard,
  Goal,
  GoalInput,
  GoalResponse,
  MeResponse,
  Pet,
  Profile,
  Transaction,
  TransactionInput,
  TransactionList,
  TransactionCalendar,
  MuseumList,
  MuseumInput,
  MuseumItem,
  SubscriptionList,
  SubscriptionInput,
  Subscription,
  SubscriptionStatus,
  SavingsTransfer,
} from '@shared/api';
import type { Currency } from '@shared/types';
import { api, ApiError } from './api';

export const keys = {
  me: ['me'] as const,
  goal: ['goal'] as const,
  pet: ['pet'] as const,
  dashboard: ['dashboard'] as const,
  transactions: ['transactions'] as const,
  categories: ['categories'] as const,
  wardrobe: ['wardrobe'] as const,
  goalDetails: ['goalDetails'] as const,
  museum: ['museum'] as const,
  subscriptions: ['subscriptions'] as const,
};

/** Сохраняем подписчиков me: clear() отсоединяет их и может оставить пустой экран. */
async function replaceSession(qc: QueryClient, me: MeResponse | null) {
  await qc.cancelQueries();
  qc.setQueryData(keys.me, me);
  qc.removeQueries({ predicate: (query) => query.queryKey[0] !== keys.me[0] });
}

/** Текущий пользователь или null, если не вошёл. */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await api<MeResponse>('GET', '/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<MeResponse>('POST', '/auth/login', body),
    onSuccess: (me) => replaceSession(qc, me),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string; name: string; currency: Currency }) =>
      api<MeResponse>('POST', '/auth/register', body),
    onSuccess: (me) => replaceSession(qc, me),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('POST', '/auth/logout'),
    onSuccess: () => replaceSession(qc, null),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Profile>) => api<MeResponse>('PUT', '/profile', patch),
    onSuccess: (me) => qc.setQueryData(keys.me, me),
  });
}

export function useGoal(enabled = true) {
  return useQuery({
    queryKey: keys.goal,
    queryFn: () => api<GoalResponse>('GET', '/goal'),
    enabled,
  });
}

export function useSaveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GoalInput) => api<Goal>('POST', '/goal', body),
    onSuccess: async (goal) => {
      qc.setQueryData<GoalResponse>(keys.goal, { goal });
      await refreshGoal(qc);
    },
  });
}

async function refreshGoal(qc: QueryClient) {
  await Promise.all(
    [keys.goalDetails, keys.wardrobe, keys.pet, keys.dashboard, keys.museum].map((queryKey) =>
      qc.invalidateQueries({ queryKey }),
    ),
  );
}

export function useWardrobe() {
  return useQuery({
    queryKey: keys.wardrobe,
    queryFn: () => api<Costume[]>('GET', '/pet/costumes'),
  });
}

export function useGoalDetails(page = 1) {
  return useQuery({
    queryKey: [...keys.goalDetails, page],
    queryFn: () => api<GoalDetails>('GET', `/goal/details?page=${page}`),
  });
}

export function useGoalTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, ...body }: GoalTransferInput & { type: 'deposit' | 'withdraw' }) =>
      api<GoalChange>('POST', `/goal/${type}`, body),
    onSuccess: async (result) => {
      qc.setQueryData<GoalResponse>(keys.goal, { goal: result.goal });
      await refreshGoal(qc);
    },
  });
}

export function useWearCostume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api<Costume[]>('PUT', `/pet/costumes/${id}/activate`, { active }),
    onSuccess: (costumes) => qc.setQueryData(keys.wardrobe, costumes),
  });
}

export function usePet(enabled = true) {
  return useQuery({
    queryKey: keys.pet,
    queryFn: () => api<Pet>('GET', '/pet'),
    enabled,
    refetchInterval: 60_000,
    retry: (count, e) => !(e instanceof ApiError && e.status === 404) && count < 1,
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: keys.dashboard,
    queryFn: () => api<Dashboard>('GET', '/dashboard'),
    refetchInterval: 60_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api<Category[]>('GET', '/categories'),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; kind: TxKind }) =>
      api<Category>('POST', '/categories', body),
    onSuccess: (category) => {
      qc.setQueryData<Category[]>(keys.categories, (current) =>
        current ? [...current, category] : [category],
      );
      return qc.invalidateQueries({ queryKey: keys.categories });
    },
  });
}

export function useTransactions(params: URLSearchParams) {
  const query = params.toString();
  return useQuery({
    queryKey: [...keys.transactions, query],
    queryFn: () => api<TransactionList>('GET', `/transactions?${query}`),
  });
}

export function useTransactionCalendar(params: URLSearchParams) {
  const query = params.toString();
  return useQuery({
    queryKey: [...keys.transactions, 'calendar', query],
    queryFn: () => api<TransactionCalendar>('GET', `/transactions/calendar?${query}`),
  });
}

async function refreshMoney(qc: QueryClient) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: keys.dashboard }),
    qc.invalidateQueries({ queryKey: keys.transactions }),
    qc.invalidateQueries({ queryKey: keys.subscriptions }),
  ]);
}

export function useSaveTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: TransactionInput & { id?: number }) =>
      api<Transaction>(id ? 'PUT' : 'POST', id ? `/transactions/${id}` : '/transactions', body),
    onSuccess: () => refreshMoney(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>('DELETE', `/transactions/${id}`),
    onSuccess: () => refreshMoney(qc),
  });
}

export function useCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { spent_today: number; feeling: number }) =>
      api<CheckinResponse>('POST', '/checkin', body),
    onSuccess: async (result) => {
      qc.setQueryData(keys.pet, result.pet);
      qc.setQueryData<Dashboard>(keys.dashboard, (current) =>
        current ? { ...current, checkinDoneToday: true } : current,
      );
      await refreshMoney(qc);
    },
  });
}

export function useNamePet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<Pet>('POST', '/pet/name', { name }),
    onSuccess: (pet) => {
      qc.setQueryData(keys.pet, pet);
      qc.setQueryData<MeResponse | null>(keys.me, (me) => (me ? { ...me, hasPet: true } : me));
    },
  });
}

export function useMuseum() {
  return useQuery({ queryKey: keys.museum, queryFn: () => api<MuseumList>('GET', '/museum') });
}

export function useAddMuseum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MuseumInput) => api<MuseumItem>('POST', '/museum', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.museum }),
  });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: keys.subscriptions,
    queryFn: () => api<SubscriptionList>('GET', '/subscriptions'),
  });
}

async function refreshSubscriptions(qc: QueryClient) {
  await Promise.all(
    [keys.subscriptions, keys.dashboard, keys.transactions].map((queryKey) =>
      qc.invalidateQueries({ queryKey }),
    ),
  );
}

export function useAddSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubscriptionInput) => api<Subscription>('POST', '/subscriptions', body),
    onSuccess: () => refreshSubscriptions(qc),
  });
}

export function useSubscriptionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: SubscriptionStatus }) =>
      api<Subscription>('POST', `/subscriptions/${id}/status`, { status }),
    onSuccess: () => refreshSubscriptions(qc),
  });
}

export function useSavingsTransfer(source: 'museum' | 'subscriptions') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, goalId }: { id: number; goalId: number }) =>
      api<SavingsTransfer>('POST', `/${source}/${id}/transfer`, { goalId }),
    onSuccess: async (result) => {
      if (result.pet) qc.setQueryData(keys.pet, result.pet);
      await Promise.all([
        refreshGoal(qc),
        qc.invalidateQueries({ queryKey: keys.goal }),
        qc.invalidateQueries({ queryKey: keys.subscriptions }),
      ]);
    },
  });
}
