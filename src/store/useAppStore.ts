import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { BUILTIN_WORKOUTS } from '../data/programs';
import { uid } from '../lib/id';
import type {
  ActiveSession,
  Profile,
  ReactionResult,
  ScheduledWorkout,
  Session,
  Settings,
  Workout,
} from '../types';

export const DEFAULT_CATALOG_URL =
  'https://raw.githubusercontent.com/alexsan4o/Traning-App/main/catalog/workouts.json';

export const DEFAULT_PROFILE: Profile = {
  name: '',
  sport: 'football',
  level: 'intermediate',
  equipment: [],
  weeklyTarget: 3,
  onboarded: false,
};

export const DEFAULT_SETTINGS: Settings = {
  onlineEnabled: true,
  aiEnabled: true,
  catalogUrl: DEFAULT_CATALOG_URL,
  defaultRestSec: 60,
  vibration: true,
  voice: true,
  keepAwake: true,
  restNotifications: true,
  animations: true,
};

export interface CatalogCache {
  fetchedAt: string;
  url: string;
  workouts: Workout[];
}

export interface AppData {
  profile: Profile;
  settings: Settings;
  workouts: Workout[];
  favoriteIds: string[];
  sessions: Session[];
  schedule: ScheduledWorkout[];
  activeSession: ActiveSession | null;
  reactionResults: ReactionResult[];
  catalog: CatalogCache | null;
}

interface AppActions {
  setProfile: (patch: Partial<Profile>) => void;
  setSettings: (patch: Partial<Settings>) => void;
  saveWorkout: (w: Workout) => void;
  deleteWorkout: (id: string) => void;
  toggleFavorite: (id: string) => void;
  scheduleWorkout: (date: string, workoutId: string) => void;
  unschedule: (id: string) => void;
  startSession: (workout: Workout) => void;
  updateActive: (patch: Partial<ActiveSession>) => void;
  discardActive: () => void;
  addSession: (s: Session) => void;
  updateSession: (id: string, patch: Partial<Session>) => void;
  deleteSession: (id: string) => void;
  addReactionResult: (r: ReactionResult) => void;
  setCatalog: (c: CatalogCache | null) => void;
  importData: (data: Partial<AppData>) => void;
  resetAll: () => void;
}

export type AppState = AppData & AppActions;

const initialData: AppData = {
  profile: DEFAULT_PROFILE,
  settings: DEFAULT_SETTINGS,
  workouts: [],
  favoriteIds: [],
  sessions: [],
  schedule: [],
  activeSession: null,
  reactionResults: [],
  catalog: null,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialData,
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      saveWorkout: (w) =>
        set((s) => {
          const updated = { ...w, updatedAt: new Date().toISOString() };
          const exists = s.workouts.some((x) => x.id === w.id);
          return {
            workouts: exists ? s.workouts.map((x) => (x.id === w.id ? updated : x)) : [updated, ...s.workouts],
          };
        }),
      deleteWorkout: (id) =>
        set((s) => ({
          workouts: s.workouts.filter((w) => w.id !== id),
          favoriteIds: s.favoriteIds.filter((f) => f !== id),
          schedule: s.schedule.filter((x) => x.workoutId !== id),
        })),
      toggleFavorite: (id) =>
        set((s) => ({
          favoriteIds: s.favoriteIds.includes(id) ? s.favoriteIds.filter((f) => f !== id) : [id, ...s.favoriteIds],
        })),
      scheduleWorkout: (date, workoutId) =>
        set((s) => ({ schedule: [...s.schedule, { id: uid('sch_'), date, workoutId }] })),
      unschedule: (id) => set((s) => ({ schedule: s.schedule.filter((x) => x.id !== id) })),
      startSession: (workout) =>
        set({
          activeSession: {
            workoutId: workout.id,
            startedAt: new Date().toISOString(),
            exerciseIndex: 0,
            logs: workout.exercises.map((e) => ({
              uid: e.uid,
              exerciseId: e.exerciseId,
              name: e.name,
              category: e.category,
              kind: e.kind,
              muscles: e.muscles,
              targetSets: e.sets,
              sets: [],
            })),
          },
        }),
      updateActive: (patch) =>
        set((s) => (s.activeSession ? { activeSession: { ...s.activeSession, ...patch } } : {})),
      discardActive: () => set({ activeSession: null }),
      addSession: (session) => set((s) => ({ sessions: [session, ...s.sessions], activeSession: null })),
      updateSession: (id, patch) =>
        set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),
      addReactionResult: (r) => set((s) => ({ reactionResults: [r, ...s.reactionResults].slice(0, 200) })),
      setCatalog: (catalog) => set({ catalog }),
      importData: (data) =>
        set((s) => ({
          profile: data.profile ? { ...s.profile, ...data.profile } : s.profile,
          settings: data.settings ? { ...s.settings, ...data.settings } : s.settings,
          workouts: mergeById(s.workouts, data.workouts),
          sessions: mergeById(s.sessions, data.sessions),
          schedule: mergeById(s.schedule, data.schedule),
          favoriteIds: Array.from(new Set([...s.favoriteIds, ...(data.favoriteIds ?? [])])),
          reactionResults: data.reactionResults ?? s.reactionResults,
        })),
      resetAll: () => set({ ...initialData }),
    }),
    {
      name: 'athlete-coach-v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s): AppData => ({
        profile: s.profile,
        settings: s.settings,
        workouts: s.workouts,
        favoriteIds: s.favoriteIds,
        sessions: s.sessions,
        schedule: s.schedule,
        activeSession: s.activeSession,
        reactionResults: s.reactionResults,
        catalog: s.catalog,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppData>;
        return {
          ...current,
          ...p,
          profile: { ...DEFAULT_PROFILE, ...p.profile },
          settings: { ...DEFAULT_SETTINGS, ...p.settings },
        };
      },
    },
  ),
);

function mergeById<T extends { id: string }>(current: T[], incoming?: T[]): T[] {
  if (!incoming?.length) return current;
  const map = new Map(current.map((x) => [x.id, x]));
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values());
}

/** Поиск тренировки во всех источниках: свои, встроенные, онлайн-каталог. */
export function findWorkout(state: Pick<AppData, 'workouts' | 'catalog'>, id: string): Workout | undefined {
  return (
    state.workouts.find((w) => w.id === id) ??
    BUILTIN_WORKOUTS.find((w) => w.id === id) ??
    state.catalog?.workouts.find((w) => w.id === id)
  );
}

export function useWorkout(id: string | undefined): Workout | undefined {
  const workouts = useAppStore((s) => s.workouts);
  const catalog = useAppStore((s) => s.catalog);
  return id ? findWorkout({ workouts, catalog }, id) : undefined;
}
