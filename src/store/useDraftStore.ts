import { create } from 'zustand';

import type { Workout, WorkoutExercise } from '../types';

/** Черновик тренировки в конструкторе (не сохраняется между запусками). */
interface DraftState {
  draft: Workout | null;
  setDraft: (w: Workout | null) => void;
  patchDraft: (patch: Partial<Workout>) => void;
  addExercises: (items: WorkoutExercise[]) => void;
}

export const useDraftStore = create<DraftState>()((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  patchDraft: (patch) => set((s) => (s.draft ? { draft: { ...s.draft, ...patch } } : {})),
  addExercises: (items) =>
    set((s) => (s.draft ? { draft: { ...s.draft, exercises: [...s.draft.exercises, ...items] } } : {})),
}));
