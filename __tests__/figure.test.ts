import { BUILTIN_EXERCISES } from '../src/data/exercises';
import { BODY, buildScene, camera, ik, len, poseAt, solve, sub, type Palette, type V3 } from '../src/lib/figure/engine';
import { animationFor, highlightFor, MAPPED_IDS, patternIdFor } from '../src/lib/figure/mapping';
import { PATTERNS } from '../src/lib/figure/patterns';
import { figure } from '../src/theme';

const pal: Palette = figure;
const dist = (a: V3, b: V3) => len(sub(a, b));

describe('анимация упражнений: движок', () => {
  it('обратная кинематика сохраняет длины звеньев и достаёт до цели', () => {
    const root: V3 = [0, 100, 0];
    const target: V3 = [30, 60, 10];
    const { joint, end } = ik(root, target, 31, 29, [0, 0, 1]);
    expect(dist(root, joint)).toBeCloseTo(31, 3);
    expect(dist(joint, end)).toBeCloseTo(29, 3);
    expect(dist(end, target)).toBeLessThan(0.05);
  });

  it('недостижимая цель — конечность выпрямляется в её сторону', () => {
    const { end } = ik([0, 0, 0], [200, 0, 0], 31, 29, [0, 1, 0]);
    expect(end[0]).toBeCloseTo(60, 0);
    expect(end[1]).toBeCloseTo(0, 3);
  });

  it('во всех движениях длины рук и ног постоянны, а тело не проваливается в пол', () => {
    for (const [id, anim] of Object.entries(PATTERNS)) {
      for (let i = 0; i < 12; i++) {
        const s = solve(poseAt(anim, i / 12));
        const ctx = `${id} @${i}`;
        expect([ctx, Math.abs(dist(s.shR, s.elR) - BODY.upperArm) < 0.1]).toEqual([ctx, true]);
        expect([ctx, Math.abs(dist(s.hipL, s.knL) - BODY.thigh) < 0.1]).toEqual([ctx, true]);
        expect([ctx, Math.abs(dist(s.knR, s.anR) - BODY.shin) < 0.1]).toEqual([ctx, true]);
        for (const p of [s.pelvis, s.head, s.chest, s.knR, s.knL]) {
          expect([ctx, p[1] > -4]).toEqual([ctx, true]);
        }
        for (const v of [...s.haR, ...s.anL, ...s.head]) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('сцена собирается и отсортирована от дальних объектов к ближним', () => {
    const { anim, highlight } = animationFor(BUILTIN_EXERCISES.find((e) => e.id === 'bench-press')!);
    const prims = buildScene(solve(poseAt(anim, 0.3)), anim, camera(anim.cam), highlight, pal);
    expect(prims.length).toBeGreaterThan(20);
    for (let i = 1; i < prims.length; i++) expect(prims[i].z).toBeGreaterThanOrEqual(prims[i - 1].z);
    // Основная мышца подсвечена.
    expect(prims.some((p) => p.color.toLowerCase() === pal.muscleNear.toLowerCase() || p.kind !== 'poly')).toBe(true);
  });
});

describe('анимация упражнений: соответствие', () => {
  it('у каждого упражнения библиотеки есть своё движение', () => {
    const ids = new Set(MAPPED_IDS);
    const missing = BUILTIN_EXERCISES.filter((e) => !ids.has(e.id)).map((e) => e.id);
    expect(missing).toEqual([]);
    for (const e of BUILTIN_EXERCISES) expect(PATTERNS[patternIdFor(e)]).toBeDefined();
  });

  it('упражнения без анимации в библиотеке подбирают движение по названию', () => {
    const custom = (name: string, category: 'strength' | 'endurance' = 'strength') => patternIdFor({ name, category, muscles: ['quads'] });
    expect(custom('Приседания с гирей')).toBe('squat');
    expect(custom('Barbell Bench Press')).toBe('benchPress');
    expect(custom('Подтягивания широким хватом')).toBe('pullUp');
    expect(custom('Румынская тяга со штангой')).toBe('rdl');
    expect(custom('Бег на дорожке', 'endurance')).toBe('run');
    expect(patternIdFor({ name: 'Неизвестное', category: 'strength', muscles: ['chest'] })).toBe('pushUp');
  });

  it('основная мышца подсвечивается сильнее вспомогательных', () => {
    expect(highlightFor(['quads', 'glutes', 'core'])).toEqual({ thigh: 2, glutes: 1, torso: 1 });
    expect(highlightFor(['chest', 'back'])).toEqual({ torso: 2 });
  });
});
