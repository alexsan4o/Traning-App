/**
 * Движок анимации упражнений: 3D-скелет манекена, обратная кинематика рук и ног,
 * камера в ракурсе ¾ и сборка 2D-примитивов для отрисовки (SVG).
 * Модуль не зависит от React Native — его можно тестировать и рендерить где угодно.
 *
 * Мировые координаты: x — вперёд (куда смотрит спортсмен), y — вверх (пол на y = 0),
 * z — вправо от спортсмена. Единица — условный «пиксель», рост манекена ≈ 175.
 */

export type V3 = [number, number, number];
export type V2 = [number, number];

// ——— Векторная математика ———
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rad = (deg: number) => (deg * Math.PI) / 180;
const rotY = (v: V3, deg: number): V3 => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ——— Пропорции манекена ———
export const BODY = {
  hipHalf: 8,
  spine: 50,
  shoulderHalf: 16,
  neck: 7,
  headR: 10.5,
  upperArm: 31,
  forearm: 29,
  thigh: 42,
  shin: 41,
  ankle: 5,
  foot: 15,
};
/** Высота таза стоя: голень + бедро + лодыжка. */
export const HIP_H = BODY.shin + BODY.thigh + BODY.ankle;

// ——— Поза ———

/**
 * Конечность в позе:
 * - относительная: направление [pitch, spread] в системе корпуса (0 — вниз, 90 — вперёд, 180 — вверх;
 *   spread — отведение в сторону, 90 — строго в сторону) и доля длины r (1 — прямая);
 * - абсолютная: точка кисти или лодыжки в мировых координатах.
 * pole — куда сгибается локоть/колено, в системе корпуса [вперёд, вверх, наружу].
 */
export type Limb = { a: V2; r?: number; pole?: V3 } | { at: V3; pole?: V3 };

export interface Pose {
  /** Центр таза. */
  hip: V3;
  /** Наклон корпуса вперёд (90 — горизонтально лицом вниз, −90 — лёжа на спине). */
  pitch?: number;
  /** Поворот корпуса вокруг вертикали. */
  yaw?: number;
  /** Боковой наклон (положительный — вправо). */
  roll?: number;
  /** Поворот таза, если отличается от корпуса (скручивания). */
  hipYaw?: number;
  /** Кивок и поворот головы. */
  head?: V2;
  armR: Limb;
  armL: Limb;
  legR: Limb;
  legL: Limb;
  /** Наклон стоп: 0 — плоско, + носки вниз (на носках), − носки вверх. */
  toeR?: number;
  toeL?: number;
  /** Свободный предмет (мяч). */
  ball?: V3;
  /** Произвольный параметр для реквизита (фаза скакалки, поворот педалей). */
  k?: number;
}

export interface Frame {
  f: V3;
  u: V3;
  s: V3;
}

export interface Skeleton {
  frame: Frame;
  pelvis: V3;
  hipR: V3;
  hipL: V3;
  chest: V3;
  head: V3;
  neckBase: V3;
  shR: V3;
  shL: V3;
  elR: V3;
  elL: V3;
  haR: V3;
  haL: V3;
  knR: V3;
  knL: V3;
  anR: V3;
  anL: V3;
  toR: V3;
  toL: V3;
  heR: V3;
  heL: V3;
  ball?: V3;
  k: number;
}

export function bodyFrame(pitch = 0, yaw = 0, roll = 0): Frame {
  const p = rad(pitch);
  const r = rad(roll);
  // Наклон вперёд: вертикаль корпуса поворачивается к «вперёд».
  const u1: V3 = [Math.sin(p), Math.cos(p), 0];
  const f1: V3 = [Math.cos(p), -Math.sin(p), 0];
  const s1: V3 = [0, 0, 1];
  // Боковой наклон вокруг оси «вперёд».
  const u2 = add(mul(u1, Math.cos(r)), mul(s1, Math.sin(r)));
  const s2 = sub(mul(s1, Math.cos(r)), mul(u1, Math.sin(r)));
  return { f: rotY(f1, yaw), u: rotY(u2, yaw), s: rotY(s2, yaw) };
}

const inFrame = (fr: Frame, side: number, v: V3): V3 =>
  add(add(mul(fr.f, v[0]), mul(fr.u, v[1])), mul(fr.s, v[2] * side));

/** Двухзвенная обратная кинематика: сустав между root и target, изгиб в сторону pole. */
export function ik(root: V3, target: V3, l1: number, l2: number, pole: V3): { joint: V3; end: V3 } {
  const d0 = sub(target, root);
  const dist = len(d0);
  const e = norm(d0);
  const d = clamp(dist, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  if (dist >= l1 + l2 - 0.01) {
    return { joint: add(root, mul(e, l1)), end: add(root, mul(e, l1 + l2)) };
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let n = sub(pole, mul(e, dot(pole, e)));
  if (len(n) < 1e-4) n = Math.abs(e[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  n = norm(n);
  return { joint: add(add(root, mul(e, a)), mul(n, h)), end: add(root, mul(e, d)) };
}

function limbDir(fr: Frame, side: number, a: V2): V3 {
  const p = rad(a[0]);
  const sp = rad(a[1]);
  return norm(add(add(mul(fr.u, -Math.cos(p) * Math.cos(sp)), mul(fr.f, Math.sin(p) * Math.cos(sp))), mul(fr.s, side * Math.sin(sp))));
}

function solveLimb(fr: Frame, side: number, root: V3, limb: Limb, l1: number, l2: number, defPole: V3, floor: number) {
  const pole = inFrame(fr, side, limb.pole ?? defPole);
  let target = 'at' in limb ? limb.at : add(root, mul(limbDir(fr, side, limb.a), (limb.r ?? 0.99) * (l1 + l2)));
  // Кисть или стопа не проходит сквозь пол — упирается в него.
  if (!('at' in limb) && target[1] < floor) target = [target[0], floor, target[2]];
  const res = ik(root, target, l1, l2, pole);
  // Колено или локоть под полом — сгибаем конечность в другую сторону (длины сохраняются).
  if (res.joint[1] < 2) {
    const e = norm(sub(res.end, root));
    const foot = add(root, mul(e, dot(sub(res.joint, root), e)));
    const flipped = sub(mul(foot, 2), res.joint);
    if (flipped[1] > res.joint[1]) return { joint: flipped, end: res.end };
  }
  return res;
}

const ARM_POLE: V3 = [-0.35, -0.6, 0.6];
const LEG_POLE: V3 = [1, 0, 0.12];

/** Прямая кинематика: поза → точки суставов в мире. */
export function solve(pose: Pose): Skeleton {
  const fr = bodyFrame(pose.pitch, pose.yaw, pose.roll);
  const sP = pose.hipYaw !== undefined ? rotY([0, 0, 1], pose.hipYaw) : fr.s;
  const pelvis = pose.hip;
  const hipR = add(pelvis, mul(sP, BODY.hipHalf));
  const hipL = add(pelvis, mul(sP, -BODY.hipHalf));
  const chest = add(pelvis, mul(fr.u, BODY.spine));
  const shR = add(add(chest, mul(fr.s, BODY.shoulderHalf)), mul(fr.u, -4));
  const shL = add(add(chest, mul(fr.s, -BODY.shoulderHalf)), mul(fr.u, -4));
  const [nod, turn] = pose.head ?? [0, 0];
  const headFr = bodyFrame((pose.pitch ?? 0) + nod, (pose.yaw ?? 0) + turn, pose.roll);
  const neckBase = add(chest, mul(fr.u, 1));
  const head = add(neckBase, mul(headFr.u, BODY.neck + BODY.headR));

  const armR = solveLimb(fr, 1, shR, pose.armR, BODY.upperArm, BODY.forearm, ARM_POLE, 4);
  const armL = solveLimb(fr, -1, shL, pose.armL, BODY.upperArm, BODY.forearm, ARM_POLE, 4);
  const legR = solveLimb(fr, 1, hipR, pose.legR, BODY.thigh, BODY.shin, LEG_POLE, BODY.ankle);
  const legL = solveLimb(fr, -1, hipL, pose.legL, BODY.thigh, BODY.shin, LEG_POLE, BODY.ankle);

  const fYaw = rotY([1, 0, 0], pose.hipYaw ?? pose.yaw ?? 0);
  const foot = (knee: V3, ankle: V3, toe = 0) => {
    const shin = norm(sub(ankle, knee));
    const t = rad(toe);
    const flat = norm(add(mul(fYaw, Math.cos(t)), [0, -Math.sin(t), 0]));
    const perp = norm(sub(fr.f, mul(shin, dot(fr.f, shin))));
    const w = clamp((Math.abs(shin[1]) - 0.35) / 0.4, 0, 1);
    let dir = norm(lerp3(perp, flat, w));
    // Носок не уходит под пол: стопа ложится на него.
    if (ankle[1] + dir[1] * BODY.foot < 1) {
      const dy = clamp((1 - ankle[1]) / BODY.foot, -1, 1);
      const hz = norm(Math.hypot(dir[0], dir[2]) > 1e-3 ? [dir[0], 0, dir[2]] : [shin[0], 0, shin[2]]);
      const h = Math.sqrt(1 - dy * dy);
      dir = [hz[0] * h, dy, hz[2] * h];
    }
    return { toe: add(ankle, mul(dir, BODY.foot)), heel: add(ankle, mul(dir, -4)) };
  };
  const fR = foot(legR.joint, legR.end, pose.toeR);
  const fL = foot(legL.joint, legL.end, pose.toeL);

  return {
    frame: fr,
    pelvis,
    hipR,
    hipL,
    chest,
    head,
    neckBase,
    shR,
    shL,
    elR: armR.joint,
    elL: armL.joint,
    haR: armR.end,
    haL: armL.end,
    knR: legR.joint,
    knL: legL.joint,
    anR: legR.end,
    anL: legL.end,
    toR: fR.toe,
    toL: fL.toe,
    heR: fR.heel,
    heL: fL.heel,
    ball: pose.ball,
    k: pose.k ?? 0,
  };
}

// ——— Интерполяция поз ———

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

function mixLimb(a: Limb, b: Limb, t: number, sa: Skeleton, sb: Skeleton, key: 'haR' | 'haL' | 'anR' | 'anL'): Limb {
  const pole = a.pole && b.pole ? lerp3(a.pole, b.pole, t) : (t < 0.5 ? a.pole : b.pole);
  if ('a' in a && 'a' in b) {
    return { a: [lerp(a.a[0], b.a[0], t), lerp(a.a[1], b.a[1], t)], r: lerp(a.r ?? 0.99, b.r ?? 0.99, t), pole };
  }
  const pa = 'at' in a ? a.at : sa[key];
  const pb = 'at' in b ? b.at : sb[key];
  return { at: lerp3(pa, pb, t), pole };
}

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const sa = solve(a);
  const sb = solve(b);
  const n = (x: number | undefined, y: number | undefined) => lerp(x ?? 0, y ?? 0, t);
  return {
    hip: lerp3(a.hip, b.hip, t),
    pitch: n(a.pitch, b.pitch),
    yaw: n(a.yaw, b.yaw),
    roll: n(a.roll, b.roll),
    hipYaw: a.hipYaw === undefined && b.hipYaw === undefined ? undefined : n(a.hipYaw ?? a.yaw, b.hipYaw ?? b.yaw),
    head: [n(a.head?.[0], b.head?.[0]), n(a.head?.[1], b.head?.[1])],
    armR: mixLimb(a.armR, b.armR, t, sa, sb, 'haR'),
    armL: mixLimb(a.armL, b.armL, t, sa, sb, 'haL'),
    legR: mixLimb(a.legR, b.legR, t, sa, sb, 'anR'),
    legL: mixLimb(a.legL, b.legL, t, sa, sb, 'anL'),
    toeR: n(a.toeR, b.toeR),
    toeL: n(a.toeL, b.toeL),
    ball: a.ball && b.ball ? lerp3(a.ball, b.ball, t) : (a.ball ?? b.ball),
    k: n(a.k, b.k),
  };
}

// ——— Анимация ———

export interface Key {
  pose: Pose;
  /** Доля времени перехода к следующему кадру (по умолчанию 1). */
  d?: number;
  /** Линейный переход без сглаживания (бег, вращение педалей). */
  linear?: boolean;
}

export type EnvItem =
  | { type: 'box'; c: V3; size: V3; color?: string; front?: boolean }
  | { type: 'bar'; y: number; x: number; half?: number }
  | { type: 'wall'; x: number }
  | { type: 'post'; c: V3; h: number }
  | { type: 'roller'; c: V3 }
  | { type: 'cone'; c: V3 }
  | { type: 'bike' }
  | { type: 'rail'; x0: number; x1: number }
  /** Наклонная площадка (спинка скамьи, упор) — толстый отрезок. */
  | { type: 'slab'; a: V3; b: V3; w: number };

export type Held =
  | 'barbell'
  | 'barbellBack'
  | 'barbellFront'
  | 'barbellHip'
  | 'dumbbells'
  | 'dumbbellR'
  | 'dumbbellChest'
  | 'kettlebell'
  | 'kettlebellChest'
  | 'medball'
  | 'plates'
  | 'wheel'
  | 'rope'
  | 'stick'
  | 'handle'
  | 'landmine'
  | 'footplate';

export interface Band {
  /** Точка крепления (мир). */
  from: V3;
  /** К какой руке (или обеим). */
  to: 'R' | 'L' | 'both' | 'knees' | 'feet' | 'hands';
}

export interface Anim {
  keys: Key[];
  /** Длительность цикла, с. */
  cycle: number;
  /** Азимут камеры: 90 — строго сбоку, 0 — спереди. */
  cam?: number;
  env?: EnvItem[];
  held?: Held[];
  bands?: Band[];
  /** Мяч: футбольный, баскетбольный, медбол или маленький (теннисный). */
  ball?: 'football' | 'basket' | 'med' | 'small';
  /** Статичное удержание — лёгкое «дыхание». */
  hold?: boolean;
}

/** Поза в момент phase ∈ [0, 1) цикла. */
export function poseAt(anim: Anim, phase: number): Pose {
  const keys = anim.keys;
  if (keys.length === 1) {
    const p = keys[0].pose;
    if (!anim.hold) return p;
    const b = Math.sin(phase * Math.PI * 2);
    return { ...p, hip: [p.hip[0], p.hip[1] + b * 0.8, p.hip[2]], pitch: (p.pitch ?? 0) + b * 1.2 };
  }
  const total = keys.reduce((acc, k) => acc + (k.d ?? 1), 0);
  let x = (((phase % 1) + 1) % 1) * total;
  for (let i = 0; i < keys.length; i++) {
    const d = keys[i].d ?? 1;
    if (x <= d) {
      const t = d > 0 ? x / d : 0;
      const next = keys[(i + 1) % keys.length];
      return mixPose(keys[i].pose, next.pose, keys[i].linear ? t : ease(t));
    }
    x -= d;
  }
  return keys[0].pose;
}

// ——— Камера и примитивы ———

export interface Camera {
  right: V3;
  toward: V3;
  tilt: number;
}

export function camera(azimuth = 62, tiltDeg = 12): Camera {
  const a = rad(azimuth);
  return { right: [Math.sin(a), 0, -Math.cos(a)], toward: [Math.cos(a), 0, Math.sin(a)], tilt: rad(tiltDeg) };
}

export const project = (cam: Camera, p: V3): V2 => [
  dot(p, cam.right),
  -p[1] * Math.cos(cam.tilt) + dot(p, cam.toward) * Math.sin(cam.tilt),
];
export const depthOf = (cam: Camera, p: V3) => dot(p, cam.toward) * Math.cos(cam.tilt) + p[1] * Math.sin(cam.tilt);

export type Prim =
  | { kind: 'line'; a: V2; b: V2; w: number; color: string; z: number; opacity?: number }
  | { kind: 'poly'; pts: V2[]; color: string; z: number; stroke?: string; sw?: number; closed?: boolean; opacity?: number }
  | { kind: 'circle'; c: V2; r: number; color: string; z: number; stroke?: string; sw?: number; opacity?: number };

export interface Palette {
  bodyNear: string;
  bodyFar: string;
  muscleNear: string;
  muscleFar: string;
  secondaryNear: string;
  secondaryFar: string;
  metal: string;
  plate: string;
  equip: string;
  equipDark: string;
  shadow: string;
  band: string;
  ballFootball: string;
  ballBasket: string;
  ballMed: string;
  ballSmall: string;
}

/** Смешивание двух цветов #RRGGBB. */
export function mixColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, clamp(t, 0, 1)));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** Какие части тела подсвечены: 2 — основная мышца, 1 — вспомогательная. */
export type Highlight = Partial<Record<Part, 1 | 2>>;
export type Part = 'torso' | 'shoulders' | 'upperArm' | 'forearm' | 'thigh' | 'shin' | 'glutes' | 'neck';

function circle3(center: V3, normal: V3, r: number, n = 14): V3[] {
  const a = norm(Math.abs(normal[1]) < 0.9 ? [normal[2], 0, -normal[0]] : [1, 0, 0]);
  const b: V3 = norm([
    normal[1] * a[2] - normal[2] * a[1],
    normal[2] * a[0] - normal[0] * a[2],
    normal[0] * a[1] - normal[1] * a[0],
  ]);
  const pts: V3[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push(add(center, add(mul(a, Math.cos(t) * r), mul(b, Math.sin(t) * r))));
  }
  return pts;
}

/** Сборка кадра: скелет + окружение + реквизит → примитивы, отсортированные по глубине. */
export function buildScene(sk: Skeleton, anim: Anim, cam: Camera, hl: Highlight, pal: Palette): Prim[] {
  const prims: Prim[] = [];
  const P = (p: V3) => project(cam, p);
  const Z = (p: V3) => depthOf(cam, p);
  // Глубина → светлота: ближние части светлее.
  const refZ = Z(sk.pelvis);
  const shade = (near: string, far: string, p: V3) => mixColor(far, near, 0.5 + (Z(p) - refZ) / 36);
  const bodyColor = (part: Part | null, p: V3) => {
    const level = part ? hl[part] : undefined;
    if (level === 2) return shade(pal.muscleNear, pal.muscleFar, p);
    if (level === 1) return shade(pal.secondaryNear, pal.secondaryFar, p);
    return shade(pal.bodyNear, pal.bodyFar, p);
  };
  const seg = (a: V3, b: V3, w: number, part: Part | null) => {
    const mid = lerp3(a, b, 0.5);
    prims.push({ kind: 'line', a: P(a), b: P(b), w, color: bodyColor(part, mid), z: Z(mid) });
  };
  const disc = (c: V3, normal: V3, r: number, color: string, zBias = 0, stroke?: string) => {
    prims.push({ kind: 'poly', pts: circle3(c, normal, r).map(P), color, z: Z(c) + zBias, stroke, sw: stroke ? 1.5 : undefined, closed: true });
  };

  // Тень на полу.
  prims.push({
    kind: 'poly',
    pts: circle3([sk.pelvis[0], 0.2, sk.pelvis[2]], [0, 1, 0], 46, 18).map(P),
    color: pal.shadow,
    z: -1e4,
    closed: true,
  });

  // Окружение.
  for (const e of anim.env ?? []) {
    if (e.type === 'box') {
      const [cx, cy, cz] = e.c;
      const [lx, ly, lz] = e.size.map((v) => v / 2) as V3;
      const v = (x: number, y: number, z: number): V3 => [cx + x * lx, cy + y * ly, cz + z * lz];
      const faces: { pts: V3[]; n: V3; light: number }[] = [
        { pts: [v(-1, 1, -1), v(1, 1, -1), v(1, 1, 1), v(-1, 1, 1)], n: [0, 1, 0], light: 1 },
        { pts: [v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], n: [1, 0, 0], light: 0.55 },
        { pts: [v(-1, -1, -1), v(-1, 1, -1), v(-1, 1, 1), v(-1, -1, 1)], n: [-1, 0, 0], light: 0.55 },
        { pts: [v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], n: [0, 0, 1], light: 0.75 },
        { pts: [v(-1, -1, -1), v(1, -1, -1), v(1, 1, -1), v(-1, 1, -1)], n: [0, 0, -1], light: 0.75 },
      ];
      const base = e.color ?? pal.equip;
      for (const f of faces) {
        const facing = dot(f.n, cam.toward) * Math.cos(cam.tilt) + f.n[1] * Math.sin(cam.tilt);
        if (facing <= 0.01) continue;
        prims.push({
          kind: 'poly',
          pts: f.pts.map(P),
          color: mixColor(pal.equipDark, base, f.light),
          z: e.front ? Z(e.c) : Math.min(Z(e.c), refZ) - 60,
          closed: true,
        });
      }
    } else if (e.type === 'bar') {
      const h = e.half ?? 48;
      prims.push({ kind: 'line', a: P([e.x, e.y, -h]), b: P([e.x, e.y, h]), w: 4, color: pal.metal, z: Z([e.x, e.y, 0]) - 40 });
      for (const z of [-h, h]) {
        prims.push({ kind: 'line', a: P([e.x, e.y, z]), b: P([e.x, e.y + 30, z]), w: 4, color: pal.equipDark, z: Z([e.x, e.y, z]) - 40 });
      }
    } else if (e.type === 'wall') {
      prims.push({
        kind: 'poly',
        pts: [P([e.x, 0, -60]), P([e.x, 190, -60]), P([e.x, 190, 60]), P([e.x, 0, 60])],
        color: pal.equipDark,
        z: -9e3,
        closed: true,
        opacity: 0.6,
      });
    } else if (e.type === 'post') {
      prims.push({ kind: 'line', a: P(e.c), b: P([e.c[0], e.c[1] + e.h, e.c[2]]), w: 7, color: pal.equipDark, z: Z(e.c) - 80 });
    } else if (e.type === 'roller') {
      prims.push({ kind: 'line', a: P(add(e.c, [0, 0, -24])), b: P(add(e.c, [0, 0, 24])), w: 17, color: pal.equip, z: Z(e.c) - 20 });
    } else if (e.type === 'cone') {
      const b0 = P(add(e.c, [-6, 0, 0]));
      const b1 = P(add(e.c, [6, 0, 0]));
      const top = P(add(e.c, [0, 14, 0]));
      prims.push({ kind: 'poly', pts: [b0, top, b1], color: '#F97316', z: Z(e.c) - 5, closed: true });
    } else if (e.type === 'slab') {
      prims.push({ kind: 'line', a: P(e.a), b: P(e.b), w: e.w, color: pal.equip, z: Math.min(Z(lerp3(e.a, e.b, 0.5)), refZ) - 30 });
    } else if (e.type === 'rail') {
      prims.push({ kind: 'line', a: P([e.x0, 14, 0]), b: P([e.x1, 14, 0]), w: 6, color: pal.equipDark, z: Z([0, 14, 0]) - 50 });
      prims.push({ kind: 'poly', pts: [P([e.x1 - 6, 4, -14]), P([e.x1 + 20, 4, -14]), P([e.x1 + 20, 44, -14]), P([e.x1 - 6, 44, -14])], color: pal.equip, z: -8e3, closed: true });
    } else if (e.type === 'bike') {
      const k = sk.k;
      const wheel = (cx: number) => ({
        kind: 'poly' as const,
        pts: circle3([cx, 24, 0], [0, 0, 1], 24, 20).map(P),
        color: 'transparent',
        stroke: pal.metal,
        sw: 3,
        z: Z([cx, 24, 0]) - 60,
        closed: true,
      });
      prims.push(wheel(-46), wheel(50));
      const frame: [V3, V3][] = [
        [[-46, 24, 0], [0, 26, 0]],
        [[0, 26, 0], [-14, 74, 0]],
        [[-14, 74, 0], [36, 70, 0]],
        [[0, 26, 0], [36, 70, 0]],
        [[36, 70, 0], [50, 24, 0]],
        [[-46, 24, 0], [-14, 74, 0]],
        [[36, 70, 0], [34, 82, 0]],
      ];
      for (const [a, b] of frame) prims.push({ kind: 'line', a: P(a), b: P(b), w: 4, color: pal.equip, z: Z([0, 40, -6]) - 40 });
      prims.push({ kind: 'line', a: P([-22, 76, 0]), b: P([-6, 76, 0]), w: 6, color: pal.equipDark, z: Z([0, 76, 0]) - 30 });
      const crank = (ang: number, side: number): V3 => [Math.cos(ang) * 12, 26 + Math.sin(ang) * 12, side * 9];
      for (const [ang, side] of [
        [k, 1],
        [k + Math.PI, -1],
      ] as const) {
        const p = crank(ang, side);
        prims.push({ kind: 'line', a: P([0, 26, side * 5]), b: P(p), w: 3, color: pal.metal, z: Z(p) - 2 });
      }
    }
  }

  // Тело: сегменты с глубинной сортировкой.
  const W = { upperArm: 10, forearm: 8.5, thigh: 15, shin: 11.5, foot: 7, neck: 8 };
  seg(sk.shR, sk.elR, W.upperArm, 'upperArm');
  seg(sk.elR, sk.haR, W.forearm, 'forearm');
  seg(sk.shL, sk.elL, W.upperArm, 'upperArm');
  seg(sk.elL, sk.haL, W.forearm, 'forearm');
  seg(sk.hipR, sk.knR, W.thigh, 'thigh');
  seg(sk.knR, sk.anR, W.shin, 'shin');
  seg(sk.hipL, sk.knL, W.thigh, 'thigh');
  seg(sk.knL, sk.anL, W.shin, 'shin');
  seg(sk.heR, sk.toR, W.foot, null);
  seg(sk.heL, sk.toL, W.foot, null);
  for (const [h, part] of [
    [sk.haR, 'forearm'],
    [sk.haL, 'forearm'],
  ] as const) {
    prims.push({ kind: 'circle', c: P(h), r: 4.6, color: bodyColor(hl[part] ? part : null, h), z: Z(h) + 0.1 });
  }
  // Плечевые суставы и ягодицы — небольшие «шары», чтобы подсветка читалась с любого ракурса.
  for (const sh of [sk.shR, sk.shL]) prims.push({ kind: 'circle', c: P(sh), r: 7, color: bodyColor('shoulders', sh), z: Z(sh) + 0.5 });
  for (const hp of [sk.hipR, sk.hipL]) {
    const g = add(hp, mul(sk.frame.f, -3));
    prims.push({ kind: 'circle', c: P(g), r: 9, color: bodyColor('glutes', g), z: Z(g) - 0.5 });
  }
  // Корпус: многоугольник с толстой скруглённой обводкой.
  const fr = sk.frame;
  const waist = add(sk.pelvis, mul(fr.u, 22));
  const torsoPts = [
    add(sk.shR, mul(fr.u, 2)),
    add(sk.shL, mul(fr.u, 2)),
    add(waist, mul(fr.s, -12)),
    sk.hipL,
    sk.hipR,
    add(waist, mul(fr.s, 12)),
  ];
  const torsoC = lerp3(sk.pelvis, sk.chest, 0.5);
  const torsoCol = bodyColor('torso', torsoC);
  prims.push({ kind: 'poly', pts: torsoPts.map(P), color: torsoCol, stroke: torsoCol, sw: 13, z: Z(torsoC), closed: true });
  seg(sk.neckBase, lerp3(sk.neckBase, sk.head, 0.55), W.neck, 'neck');
  prims.push({ kind: 'circle', c: P(sk.head), r: BODY.headR, color: bodyColor(null, sk.head), z: Z(sk.head) });

  // Реквизит в руках.
  const mid = lerp3(sk.haR, sk.haL, 0.5);
  const axis = norm(sub(sk.haR, sk.haL));
  const latAxis = len(sub(sk.haR, sk.haL)) > 8 ? axis : fr.s;
  const barbell = (c: V3, ax: V3) => {
    prims.push({ kind: 'line', a: P(add(c, mul(ax, -58))), b: P(add(c, mul(ax, 58))), w: 3.5, color: pal.metal, z: Z(c) });
    for (const sgn of [-1, 1]) {
      const pc = add(c, mul(ax, sgn * 46));
      disc(pc, ax, 17, pal.plate, 0.2, pal.metal);
    }
  };
  const dumbbell = (h: V3, ax: V3) => {
    prims.push({ kind: 'line', a: P(add(h, mul(ax, -9))), b: P(add(h, mul(ax, 9))), w: 3, color: pal.metal, z: Z(h) + 0.2 });
    for (const sgn of [-1, 1]) disc(add(h, mul(ax, sgn * 8)), ax, 6.5, pal.plate, 0.3, pal.metal);
  };
  for (const item of anim.held ?? []) {
    if (item === 'barbell') barbell(mid, latAxis);
    else if (item === 'barbellBack') barbell(add(add(sk.chest, mul(fr.f, -7)), mul(fr.u, -3)), fr.s);
    else if (item === 'barbellFront') barbell(add(add(sk.chest, mul(fr.f, 8)), mul(fr.u, -3)), fr.s);
    else if (item === 'barbellHip') barbell(add(sk.pelvis, mul(fr.f, 10)), fr.s);
    else if (item === 'dumbbells') {
      dumbbell(sk.haR, fr.s);
      dumbbell(sk.haL, fr.s);
    } else if (item === 'dumbbellR') dumbbell(sk.haR, fr.s);
    else if (item === 'dumbbellChest') dumbbell(add(mid, [0, -2, 0]), [0, 1, 0]);
    else if (item === 'kettlebell' || item === 'kettlebellChest') {
      const c = item === 'kettlebell' ? add(mid, mul(norm(sub(mid, lerp3(sk.elR, sk.elL, 0.5))), 9)) : add(mid, [0, -3, 0]);
      prims.push({ kind: 'circle', c: P(c), r: 8.5, color: pal.plate, stroke: pal.metal, sw: 1.5, z: Z(c) + 0.3 });
    } else if (item === 'medball') {
      const c = sk.ball ?? add(mid, mul(fr.f, 8));
      prims.push({ kind: 'circle', c: P(c), r: 11, color: pal.ballMed, stroke: pal.equipDark, sw: 1.5, z: Z(c) + 0.3 });
    } else if (item === 'plates') {
      disc(sk.haR, fr.s, 12, pal.plate, 0.3, pal.metal);
      disc(sk.haL, fr.s, 12, pal.plate, 0.3, pal.metal);
    } else if (item === 'wheel') {
      prims.push({ kind: 'poly', pts: circle3(mid, fr.f, 17, 20).map(P), color: 'transparent', stroke: pal.metal, sw: 3.5, z: Z(mid) + 0.3, closed: true });
    } else if (item === 'handle') {
      prims.push({ kind: 'line', a: P(add(mid, mul(latAxis, -10))), b: P(add(mid, mul(latAxis, 10))), w: 3.5, color: pal.metal, z: Z(mid) + 0.3 });
    } else if (item === 'footplate') {
      const c = lerp3(sk.toR, sk.toL, 0.5);
      const push = norm(sub(c, sk.pelvis));
      const perp = norm([-push[1], push[0], 0]);
      const corners = [
        add(add(c, mul(perp, 18)), [0, 0, 26]),
        add(add(c, mul(perp, 18)), [0, 0, -26]),
        add(add(c, mul(perp, -18)), [0, 0, -26]),
        add(add(c, mul(perp, -18)), [0, 0, 26]),
      ].map((q) => add(q, mul(push, 4)));
      prims.push({ kind: 'poly', pts: corners.map(P), color: pal.equip, stroke: pal.equipDark, sw: 2, z: Z(c) - 20, closed: true });
    } else if (item === 'landmine') {
      const end: V3 = [-70, 3, 0];
      prims.push({ kind: 'line', a: P(end), b: P(add(mid, mul(norm(sub(mid, end)), 14))), w: 3.5, color: pal.metal, z: Z(lerp3(end, mid, 0.5)) });
      disc(add(mid, mul(norm(sub(mid, end)), 6)), norm(sub(mid, end)), 13, pal.plate, 0.3, pal.metal);
    } else if (item === 'stick') {
      const fwd = norm([fr.f[0], 0, fr.f[2]]);
      const tip: V3 = [sk.pelvis[0] + fwd[0] * 62, 3, sk.haR[2] * 0.5];
      const dir = norm(sub(tip, sk.haL));
      const blade = add(tip, mul(fwd, 16));
      prims.push({ kind: 'line', a: P(add(sk.haL, mul(dir, -8))), b: P(tip), w: 3.5, color: '#D6B98C', z: Z(mid) + 0.3 });
      prims.push({ kind: 'line', a: P(tip), b: P(blade), w: 4, color: '#D6B98C', z: Z(tip) + 0.3 });
    } else if (item === 'rope') {
      // Скакалка: кривая через кисти и точку, вращающуюся вокруг тела.
      const ang = sk.k * Math.PI * 2;
      const center = add(sk.pelvis, [0, 14, 0]);
      const target = add(center, [Math.sin(ang) * 60, -Math.cos(ang) * 104, 0]);
      const ctrl = sub(mul(target, 2), mid);
      const pts: V3[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const a = lerp3(sk.haR, ctrl, t);
        const b = lerp3(ctrl, sk.haL, t);
        pts.push(lerp3(a, b, t));
      }
      prims.push({ kind: 'poly', pts: pts.map(P), color: 'transparent', stroke: pal.band, sw: 2, z: Z(ctrl), closed: false });
    }
  }
  if (sk.ball && anim.ball) {
    const color = { basket: pal.ballBasket, football: pal.ballFootball, med: pal.ballMed, small: pal.ballSmall }[anim.ball];
    prims.push({ kind: 'circle', c: P(sk.ball), r: anim.ball === 'small' ? 6 : anim.ball === 'med' ? 11 : 10, color, stroke: pal.equipDark, sw: 1.5, z: Z(sk.ball) + 0.5 });
  }
  for (const b of anim.bands ?? []) {
    const ends: V3[] =
      b.to === 'both' ? [sk.haR, sk.haL] : b.to === 'R' ? [sk.haR] : b.to === 'L' ? [sk.haL] : b.to === 'knees' ? [sk.knR, sk.knL] : [sk.anR, sk.anL];
    if (b.to === 'hands') {
      prims.push({ kind: 'line', a: P(sk.haR), b: P(sk.haL), w: 3, color: pal.band, z: Z(mid) + 1 });
      continue;
    }
    if (b.to === 'knees' || b.to === 'feet') {
      prims.push({ kind: 'line', a: P(ends[0]), b: P(ends[1]), w: 3, color: pal.band, z: Z(lerp3(ends[0], ends[1], 0.5)) + 5 });
      continue;
    }
    for (const e of ends) prims.push({ kind: 'line', a: P(b.from), b: P(e), w: 2.5, color: pal.band, z: Z(lerp3(b.from, e, 0.5)) });
  }

  return prims.sort((a, b) => a.z - b.z);
}

/** Границы всех примитивов — для подгонки области просмотра. */
export function boundsOf(prims: Prim[], acc = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }) {
  const addPt = (p: V2, pad: number) => {
    acc.x0 = Math.min(acc.x0, p[0] - pad);
    acc.y0 = Math.min(acc.y0, p[1] - pad);
    acc.x1 = Math.max(acc.x1, p[0] + pad);
    acc.y1 = Math.max(acc.y1, p[1] + pad);
  };
  for (const pr of prims) {
    if (pr.z <= -1e4) continue;
    if (pr.kind === 'line') {
      addPt(pr.a, pr.w / 2);
      addPt(pr.b, pr.w / 2);
    } else if (pr.kind === 'circle') addPt(pr.c, pr.r);
    else for (const p of pr.pts) addPt(p, (pr.sw ?? 0) / 2);
  }
  return acc;
}
