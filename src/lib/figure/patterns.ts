import { HIP_H, solve, type Anim, type EnvItem, type Held, type Key, type Limb, type Pose, type V3 } from './engine';

/**
 * Библиотека движений. Каждое движение — несколько ключевых поз, между которыми
 * движок плавно интерполирует. Кисти и стопы задаются либо точкой в мире
 * (упор в пол, гриф, педали), либо направлением относительно корпуса.
 */

const H = HIP_H - 1;
const FR: V3 = [2, 5, 9];
const FL: V3 = [0, 5, -9];
const deg = (r: number) => (r * 180) / Math.PI;

/** Рука/нога по направлению: pitch 0 — вниз, 90 — вперёд, 180 — вверх; spread — в сторону. */
const dir = (pitch: number, spread = 8, r = 0.98, pole?: V3): Limb => ({ a: [pitch, spread], r, pole });
/** Кисть/стопа в точке мира. */
const at = (p: V3, pole?: V3): Limb => ({ at: p, pole });

const HANG = dir(6, 10);
const ELBOW_DOWN: V3 = [0, -1, 0.25];
const RACK = dir(150, 12, 0.32, [0.6, -1, 0.35]);

function stand(o: Partial<Pose> = {}): Pose {
  return { hip: [0, H, 0], armR: HANG, armL: HANG, legR: at(FR), legL: at(FL), ...o };
}

const both = (l: Limb) => ({ armR: l, armL: l });
const legs = (l: Limb) => ({ legR: l, legL: l });

function keys(...poses: (Pose | [Pose, number] | [Pose, number, boolean])[]): Key[] {
  return poses.map((p) => (Array.isArray(p) ? { pose: p[0], d: p[1], linear: p[2] } : { pose: p }));
}

/** Точки на грифе для хвата, если гриф лежит у плеч (сзади/спереди). */
function barHands(pose: Pose, fwd: number, down: number, half: number) {
  const s = solve(pose);
  const { f, u, s: side } = s.frame;
  const c: V3 = [
    s.chest[0] + f[0] * fwd - u[0] * down,
    s.chest[1] + f[1] * fwd - u[1] * down,
    s.chest[2] + f[2] * fwd - u[2] * down,
  ];
  return {
    R: [c[0] + side[0] * half, c[1] + side[1] * half, c[2] + side[2] * half] as V3,
    L: [c[0] - side[0] * half, c[1] - side[1] * half, c[2] - side[2] * half] as V3,
  };
}

/** Прямая линия тела от лодыжек (на носках) до плеч заданной высоты — планка, отжимания. */
function bodyLine(ankleX: number, shoulderY: number, ankleY = 12): Pick<Pose, 'hip' | 'pitch' | 'legR' | 'legL'> {
  const l1 = 82;
  const l2 = 46;
  const b = Math.asin(Math.max(-1, Math.min(1, (shoulderY - ankleY) / (l1 + l2))));
  return {
    hip: [ankleX + l1 * Math.cos(b), ankleY + l1 * Math.sin(b), 0],
    pitch: 90 - deg(b),
    legR: at([ankleX, ankleY, 7]),
    legL: at([ankleX, ankleY, -7]),
  };
}

// Лёжа на спине (голова — назад по оси x), лицом вниз, сидя, на четвереньках.
const supine = (o: Partial<Pose> = {}): Pose => ({
  hip: [0, 10, 0],
  pitch: -90,
  armR: dir(10, 18),
  armL: dir(10, 18),
  ...legs(dir(0, 3)),
  ...o,
});
const prone = (o: Partial<Pose> = {}): Pose => ({
  hip: [0, 10, 0],
  pitch: 90,
  head: [-20, 0],
  armR: dir(0, 20),
  armL: dir(0, 20),
  ...legs(dir(0, 3)),
  toeR: 0,
  toeL: 0,
  ...o,
});
const seated = (o: Partial<Pose> = {}): Pose => ({
  hip: [0, 11, 0],
  pitch: 0,
  armR: dir(10, 18),
  armL: dir(10, 18),
  legR: at([82, 8, 9]),
  legL: at([82, 8, -9]),
  ...o,
});
function allFours(o: Partial<Pose> = {}): Pose {
  const hip: V3 = [-24, 47, 0];
  return {
    hip,
    pitch: 84,
    head: [-10, 0],
    armR: at([24, 5, 13], [-1, 0, 0.3]),
    armL: at([24, 5, -13], [-1, 0, 0.3]),
    legR: at([-64, 6, 8]),
    legL: at([-64, 6, -8]),
    toeR: 0,
    toeL: 0,
    ...o,
  };
}
/** Сидя на скамье (таз на высоте сиденья). */
const benchSeat = (o: Partial<Pose> = {}): Pose => ({
  hip: [0, 50, 0],
  armR: HANG,
  armL: HANG,
  legR: at([38, 5, 12]),
  legL: at([38, 5, -12]),
  ...o,
});

const SEAT: EnvItem = { type: 'box', c: [0, 20, 0], size: [34, 40, 30] };
const BOX: EnvItem = { type: 'box', c: [44, 18, 0], size: [42, 36, 42] };

// ——— Приседания ———

const squatBottom = (o: Partial<Pose> = {}): Pose => stand({ hip: [-24, 50, 0], pitch: 38, ...o });

type SquatArms = 'forward' | 'goblet' | 'back' | 'front' | 'hang' | 'rack';

function squat(arms: SquatArms, held?: Held[], o: { slow?: number; wide?: boolean; cycle?: number } = {}): Anim {
  const wide = o.wide ? { legR: at([4, 5, 30]), legL: at([2, 5, -30]) } : {};
  const top = stand({ ...wide });
  const bot = squatBottom({ ...wide, ...(o.wide ? { hip: [-14, 50, 0], pitch: 22 } : {}) });
  const armPose = (p: Pose, bottom: boolean): Pose => {
    switch (arms) {
      case 'forward':
        return { ...p, ...both(dir(bottom ? 92 : 12, 8)) };
      case 'goblet':
        return { ...p, ...both(dir(125, 3, 0.42, [0, -1, 0.3])) };
      case 'rack':
        return { ...p, ...both(RACK) };
      case 'back': {
        const h = barHands(p, -7, 3, 26);
        return { ...p, armR: at(h.R, [-0.3, -1, 0.6]), armL: at(h.L, [-0.3, -1, 0.6]) };
      }
      case 'front': {
        const h = barHands(p, 10, 3, 14);
        return { ...p, armR: at(h.R, [1, 0.2, 0.4]), armL: at(h.L, [1, 0.2, 0.4]) };
      }
      default:
        return { ...p, ...both(dir(bottom ? 14 : 2, 2)) };
    }
  };
  const slow = o.slow ?? 1;
  return { keys: keys([armPose(top, false), 1], [armPose(bot, true), slow]), cycle: o.cycle ?? 2.6 + (slow - 1) * 1.4, held };
}

function wallSit(): Anim {
  const p = stand({ hip: [-6, 47, 0], pitch: 0, legR: at([36, 5, 10]), legL: at([36, 5, -10]), ...both(dir(80, 10, 0.8)) });
  return { keys: keys(p), cycle: 3, hold: true, env: [{ type: 'wall', x: -22 }] };
}

function jumpSquat(tuck = false): Anim {
  const bot = squatBottom({ ...both(dir(-30, 10)) });
  const air = stand({ hip: [0, H + 26, 0], ...both(dir(160, 12)), legR: at([2, 29, 9]), legL: at([0, 29, -9]), toeR: 35, toeL: 35 });
  const tucked: Pose = {
    ...air,
    hip: [0, H + 34, 0],
    ...both(dir(95, 10, 0.8)),
    legR: dir(110, 6, 0.45, [1, 0.5, 0]),
    legL: dir(110, 6, 0.45, [1, 0.5, 0]),
  };
  const land = stand({ hip: [-8, H - 12, 0], pitch: 12, ...both(dir(40, 10)) });
  return { keys: keys([bot, 1], [air, 0.6], ...(tuck ? [[tucked, 0.5] as [Pose, number]] : []), [land, 0.8]), cycle: tuck ? 1.6 : 1.5 };
}

function thruster(held: Held[]): Anim {
  const bot = squatBottom({ ...both(RACK) });
  const mid = stand({ ...both(RACK) });
  const top = stand({ ...both(dir(176, 12)) });
  return { keys: keys([bot, 1], [mid, 0.5], [top, 0.8]), cycle: 2.4, held };
}

// ——— Выпады и шаги ———

function lunge(kind: 'forward' | 'reverse' | 'bulgarian' | 'jump', held?: Held[]): Anim {
  const armsP = held?.includes('dumbbells') ? both(dir(0, 12)) : both(dir(0, 22, 0.9));
  const front: V3 = [34, 5, 9];
  const backTop: V3 = kind === 'bulgarian' ? [-58, 45, -9] : [-40, 7, -9];
  const backBot: V3 = kind === 'bulgarian' ? [-58, 45, -9] : [-40, 7, -9];
  const top: Pose = { hip: [-3, kind === 'bulgarian' ? 84 : 80, 0], ...armsP, legR: at(front), legL: at(backTop), toeL: kind === 'bulgarian' ? -10 : 55 };
  const bot: Pose = { ...top, hip: [-6, 46, 0], pitch: 6, legL: at(backBot, [1, -0.6, 0]) };
  const env = kind === 'bulgarian' ? [{ type: 'box' as const, c: [-66, 20, -9] as V3, size: [30, 40, 26] as V3 }] : undefined;
  if (kind === 'jump') {
    const botB: Pose = { ...bot, legR: at([-40, 7, 9], [1, -0.6, 0]), legL: at([34, 5, -9]), toeR: 55, toeL: 0 };
    const air: Pose = { hip: [-3, H + 14, 0], ...armsP, legR: dir(20, 3, 0.9), legL: dir(-10, 3, 0.9), toeR: 30, toeL: 30 };
    const airB: Pose = { ...air, legR: dir(-10, 3, 0.9), legL: dir(20, 3, 0.9) };
    return { keys: keys([bot, 1], [air, 0.6], [botB, 1], [airB, 0.6]), cycle: 2.2, cam: 75 };
  }
  if (kind === 'reverse') {
    const standP = stand({ ...armsP, legR: at(front), legL: at([2, 5, -9]) });
    return { keys: keys(standP, bot), cycle: 2.6, held, cam: 75 };
  }
  return { keys: keys(top, bot), cycle: 2.6, held, env, cam: 75 };
}

function lateralLunge(deep = false): Anim {
  const standWide = stand({ legR: at([2, 5, 34]), legL: at([0, 5, -34]), ...both(dir(20, 10)) });
  const shift = (side: number): Pose => ({
    ...standWide,
    hip: [deep ? -18 : -12, deep ? 32 : 50, side * 26],
    pitch: deep ? 30 : 32,
    ...both(dir(90, 8, 0.9)),
    ...(side > 0 ? { legL: at([0, 5, -34]) } : { legR: at([2, 5, 34]) }),
    toeR: deep && side < 0 ? -40 : 0,
    toeL: deep && side > 0 ? -40 : 0,
  });
  return { keys: keys(standWide, shift(1), standWide, shift(-1)), cycle: 3.4, cam: 25 };
}

function stepUp(down = false): Anim {
  const base = stand({ hip: [-6, H, 0], legR: at([36, 41, 9]), legL: at([-6, 5, -9]) });
  const upP = stand({ hip: [30, H + 36, 0], legR: at([36, 41, 9]), legL: at([30, 41, -9]), ...both(HANG) });
  const lowered = stand({ hip: [24, H + 8, 0], pitch: 10, legR: at([36, 41, 9]), legL: at([4, 8, -9]), toeL: 20 });
  return { keys: down ? keys(upP, lowered) : keys(base, upP), cycle: 2.6, env: [BOX], cam: 72 };
}

// ——— Тяги и наклоны ———

function hinge(kind: 'deadlift' | 'rdl' | 'goodMorning' | 'sumo' | 'row' | 'rearFly' | 'tbar', held?: Held[]): Anim {
  const wide = kind === 'sumo' ? { legR: at([4, 5, 30]), legL: at([2, 5, -30]) } : {};
  const top = stand({ ...wide, ...both(dir(2, kind === 'sumo' ? 4 : 8)) });
  const hipBot: Record<string, [number, number, number, number]> = {
    deadlift: [-26, 56, 60, 20],
    sumo: [-16, 56, 34, 20],
    rdl: [-24, 78, 72, 34],
    goodMorning: [-22, 80, 72, 0],
    row: [-22, 74, 64, 0],
    rearFly: [-22, 74, 68, 0],
    tbar: [-22, 70, 58, 0],
  };
  const [hx, hy, pitch, barY] = hipBot[kind];
  const bottom: Pose = stand({ ...wide, hip: [hx, hy, 0], pitch });
  if (kind === 'goodMorning') {
    const ht = barHands(top, -7, 3, 26);
    const hb = barHands(bottom, -7, 3, 26);
    return {
      keys: keys(
        { ...top, armR: at(ht.R, [-0.3, -1, 0.6]), armL: at(ht.L, [-0.3, -1, 0.6]) },
        { ...bottom, armR: at(hb.R, [-0.3, -1, 0.6]), armL: at(hb.L, [-0.3, -1, 0.6]) },
      ),
      cycle: 2.8,
      held: ['barbellBack'],
    };
  }
  if (kind === 'row' || kind === 'tbar') {
    const hang: Pose = { ...bottom, ...both(dir(0, 10)) };
    const pulled: Pose = { ...bottom, ...both(dir(-30, 18, 0.45, [-1, 0.2, 0.5])) };
    return { keys: keys(hang, pulled), cycle: 2.4, held: held ?? ['barbell'], cam: 70 };
  }
  if (kind === 'rearFly') {
    const hang: Pose = { ...bottom, ...both(dir(0, 8, 0.95)) };
    const open: Pose = { ...bottom, ...both(dir(0, 80, 0.95)) };
    return { keys: keys(hang, open), cycle: 2.4, held: ['dumbbells'], cam: 30 };
  }
  const s = solve(bottom);
  const hand = (sh: V3, z: number): V3 => [sh[0] + 6, barY + 3, z];
  const b: Pose = {
    ...bottom,
    armR: kind === 'rdl' ? dir(0, 6) : at(hand(s.shR, kind === 'sumo' ? 12 : 20)),
    armL: kind === 'rdl' ? dir(0, 6) : at(hand(s.shL, kind === 'sumo' ? -12 : -20)),
  };
  return { keys: keys(top, b), cycle: 3, held: held ?? ['barbell'], cam: kind === 'sumo' ? 35 : 62 };
}

function singleLegRdl(): Anim {
  const top = stand({ legL: dir(10, 3, 0.95), toeL: 20 });
  const bot: Pose = { hip: [-4, H - 3, 0], pitch: 78, ...both(dir(0, 6)), legR: at([2, 5, 8]), legL: dir(0, 3), toeL: 0 };
  return { keys: keys(top, bot), cycle: 3, cam: 80 };
}

function kbSwing(): Anim {
  const back: Pose = stand({ hip: [-24, 70, 0], pitch: 55, ...both(dir(-25, 4)), legR: at([2, 5, 16]), legL: at([0, 5, -16]) });
  const front: Pose = stand({ hip: [2, H, 0], pitch: -4, ...both(dir(95, 4)), legR: at([2, 5, 16]), legL: at([0, 5, -16]) });
  return { keys: keys(back, front), cycle: 1.6, held: ['kettlebell'], cam: 75 };
}

function hyperextension(): Anim {
  const top: Pose = { hip: [0, 62, 0], pitch: 45, ...both(dir(150, 30, 0.4, [0, -1, 1])), legR: at([-56, 6, 8]), legL: at([-56, 6, -8]), toeR: -20, toeL: -20 };
  const bot: Pose = { ...top, pitch: 140 };
  return {
    keys: keys(top, [bot, 1.2]),
    cycle: 2.8,
    env: [
      { type: 'slab', a: [16, 44, 0], b: [-44, -6 + 50, 0], w: 12 },
      { type: 'slab', a: [6, 62, 0], b: [16, 52, 0], w: 16 },
    ],
    cam: 80,
  };
}

function gluteBridge(thrust = false): Anim {
  if (thrust) {
    const low: Pose = { hip: [-2, 14, 0], pitch: -53, ...both(dir(40, 70, 0.9)), legR: at([46, 5, 12], [1, 0.2, 0.1]), legL: at([46, 5, -12], [1, 0.2, 0.1]) };
    const up: Pose = { ...low, hip: [6, 42, 0], pitch: -90 };
    return { keys: keys(low, up), cycle: 2.4, held: ['barbellHip'], env: [{ type: 'box', c: [-56, 22, 0], size: [30, 44, 60] }], cam: 72 };
  }
  const base: Pose = { hip: [10, 11, 0], pitch: -90, ...both(dir(10, 22)), legR: at([52, 6, 12], [1, 0.2, 0.1]), legL: at([52, 6, -12], [1, 0.2, 0.1]) };
  const up: Pose = { ...base, hip: [12, 34, 0], pitch: -112 };
  return { keys: keys(base, up), cycle: 2.4, cam: 72 };
}

function calfRaise(kind: 'both' | 'single' | 'machine' | 'tibialis'): Anim {
  if (kind === 'tibialis') {
    const lean = stand({ hip: [-10, H - 2, 0], pitch: -10, legR: at([22, 5, 9]), legL: at([20, 5, -9]) });
    return { keys: keys(lean, { ...lean, toeR: -30, toeL: -30 }), cycle: 1.6, env: [{ type: 'wall', x: -26 }], cam: 80 };
  }
  const base = kind === 'single' ? stand({ legL: dir(-40, 2, 0.6, [1, 0, 0]) }) : stand();
  const arms = kind === 'machine' ? both(RACK) : {};
  const low = { ...base, ...arms };
  const high = { ...base, ...arms, hip: [2, H + 13, 0] as V3, legR: at([2, 18, 9]), legL: kind === 'single' ? base.legL : at([0, 18, -9]), toeR: 55, toeL: kind === 'single' ? 0 : 55 };
  return { keys: keys(low, high), cycle: 1.8, cam: 80 };
}

// ——— Тренажёры для ног ———

function legPress(single = false): Anim {
  const base: Pose = { hip: [0, 32, 0], pitch: -52, ...both(dir(60, 30, 0.7)), legR: at([46, 58, 11]), legL: at([46, 58, -11]) };
  const ext: Pose = { ...base, legR: at([66, 84, 11]), legL: single ? at([30, 40, -11]) : at([66, 84, -11]) };
  const low: Pose = { ...base, legL: single ? at([30, 40, -11]) : base.legL };
  return {
    keys: keys(low, ext),
    cycle: 2.6,
    held: ['footplate'],
    env: [
      { type: 'box', c: [-4, 14, 0], size: [40, 28, 34] },
      { type: 'slab', a: [-10, 30, 0], b: [-46, 78, 0], w: 18 },
      { type: 'slab', a: [30, 4, 0], b: [110, 110, 0], w: 6 },
    ],
    cam: 78,
  };
}

function legMachine(kind: 'extension' | 'curl'): Anim {
  if (kind === 'extension') {
    const bent = benchSeat({ hip: [0, 50, 0], ...both(dir(10, 25)), legR: at([30, 14, 9]), legL: at([30, 14, -9]) });
    const ext = { ...bent, legR: at([80, 50, 9]), legL: at([80, 50, -9]) };
    return { keys: keys(bent, ext), cycle: 2.2, env: [SEAT, { type: 'box', c: [-20, 60, 0], size: [8, 60, 30] }], cam: 80 };
  }
  const flat = prone({ hip: [0, 50, 0], ...both(dir(10, 25, 0.8)) });
  const curled = { ...flat, legR: dir(-45, 4, 0.71, [1, 0, 0]), legL: dir(-45, 4, 0.71, [1, 0, 0]) };
  return { keys: keys(flat, curled), cycle: 2.2, env: [{ type: 'box', c: [-4, 20, 0], size: [110, 40, 28] }], cam: 78 };
}

function nordic(): Anim {
  // Корпус поворачивается вокруг колен, голени лежат на полу.
  const up: Pose = { hip: [2, 47, 0], pitch: 0, ...both(dir(20, 20)), legR: at([-38, 6, 8]), legL: at([-38, 6, -8]), toeR: 0, toeL: 0 };
  const down: Pose = { ...up, hip: [34, 32, 0], pitch: 50, ...both(dir(85, 20, 0.9)) };
  return { keys: keys(up, [down, 1.6]), cycle: 3.4, cam: 80 };
}

// ——— Жимы ———

function pushUp(kind: 'normal' | 'close' | 'pike' | 'taps' | 'plank' | 'mountain' | 'bear'): Anim {
  const ankleX = -82;
  const w = kind === 'close' ? 9 : 19;
  const hand = (z: number): V3 => [36, 5, z];
  const pole: V3 = [-0.3, -0.7, 0.5];
  const high: Pose = { ...bodyLine(ankleX, 62), armR: at(hand(w), pole), armL: at(hand(-w), pole), toeR: 0, toeL: 0 };
  const low: Pose = { ...high, ...bodyLine(ankleX, 24), armR: at(hand(w), pole), armL: at(hand(-w), pole) };
  if (kind === 'pike') {
    const pk: Pose = { hip: [-10, 92, 0], pitch: 140, head: [30, 0], armR: at([34, 5, 16]), armL: at([34, 5, -16]), legR: at([-44, 5, 9]), legL: at([-44, 5, -9]), toeR: 40, toeL: 40 };
    const pkLow: Pose = { ...pk, hip: [-4, 78, 0], pitch: 150 };
    return { keys: keys(pk, pkLow), cycle: 2.4, cam: 75 };
  }
  if (kind === 'plank') {
    const pl: Pose = { ...bodyLine(ankleX, 36), armR: at([72, 5, 11], [1, -0.3, 0.2]), armL: at([72, 5, -11], [1, -0.3, 0.2]), toeR: 0, toeL: 0 };
    return { keys: keys(pl), cycle: 3, hold: true, cam: 70 };
  }
  if (kind === 'taps') {
    const s = solve(high);
    const tapR: Pose = { ...high, armR: at([s.shL[0] - 2, s.shL[1] - 6, s.shL[2] + 6]) };
    const tapL: Pose = { ...high, armL: at([s.shR[0] - 2, s.shR[1] - 6, s.shR[2] - 6]) };
    return { keys: keys(high, tapR, high, tapL), cycle: 2.2, cam: 55 };
  }
  if (kind === 'mountain' || kind === 'bear') {
    const bear = kind === 'bear';
    const base: Pose = bear
      ? { hip: [-30, 44, 0], pitch: 82, armR: at(hand(14)), armL: at(hand(-14)), legR: at([-50, 6, 9]), legL: at([-50, 6, -9]), toeR: 0, toeL: 0 }
      : high;
    const driveR: Pose = bear
      ? { ...base, armR: at([48, 8, 14]), legL: at([-38, 8, -9]) }
      : { ...base, legR: dir(95, 3, 0.5, [0, -1, 0]) };
    const driveL: Pose = bear
      ? { ...base, armL: at([48, 8, -14]), legR: at([-38, 8, 9]) }
      : { ...base, legL: dir(95, 3, 0.5, [0, -1, 0]) };
    return { keys: keys(driveR, base, driveL, base), cycle: bear ? 1.6 : 0.9, cam: 65 };
  }
  return { keys: keys(high, low), cycle: 2.2, cam: 70 };
}

function benchPress(kind: 'barbell' | 'dumbbells' | 'incline' | 'fly' | 'skull' | 'pullover'): Anim {
  const incline = kind === 'incline';
  const base: Pose = {
    hip: incline ? [8, 50, 0] : [8, 49, 0],
    pitch: incline ? -45 : -90,
    ...both(dir(90, 14)),
    legR: at([48, 5, 16]),
    legL: at([48, 5, -16]),
  };
  const s = solve(base);
  const { u } = s.frame;
  const off = (sh: V3, up: number, fwd: number, side: number): V3 => [sh[0] + u[0] * fwd + (incline ? 0 : 0), sh[1] + up + u[1] * fwd, sh[2] + side];
  const pole: V3 = [-0.2, -1, 0.7];
  const env: EnvItem[] = incline
    ? [
        { type: 'box', c: [4, 22, 0], size: [34, 44, 24] },
        { type: 'slab', a: [0, 40, 0], b: [-44, 84, 0], w: 22 },
      ]
    : [{ type: 'box', c: [-24, 22, 0], size: [92, 44, 24] }];
  const held: Held[] = kind === 'barbell' || kind === 'incline' || kind === 'skull' ? ['barbell'] : ['dumbbells'];
  if (kind === 'fly') {
    const top: Pose = { ...base, ...both(dir(90, 10, 0.95, [-1, 0, 1])) };
    const open: Pose = { ...base, ...both(dir(90, 80, 0.88, [-1, 0, 1])) };
    return { keys: keys(top, open), cycle: 2.8, held, env, cam: 40 };
  }
  if (kind === 'skull') {
    const top: Pose = { ...base, ...both(dir(100, 10)) };
    const bent: Pose = { ...base, ...both(dir(140, 10, 0.42, [1, 0.4, 0])) };
    return { keys: keys(top, bent), cycle: 2.4, held, env, cam: 75 };
  }
  if (kind === 'pullover') {
    const top: Pose = { ...base, ...both(dir(92, 6, 0.95)) };
    const back: Pose = { ...base, ...both(dir(172, 6, 0.95)) };
    return { keys: keys(top, back), cycle: 3, held: ['dumbbellChest'], env, cam: 78 };
  }
  const topR = off(s.shR, 0, 0, 0);
  const t = (sh: V3, side: number, bottom: boolean): V3 =>
    bottom ? [sh[0] + 10 * (incline ? 1 : 1), sh[1] + 12, sh[2] + side * 4] : [sh[0] + 6, sh[1] + 52, sh[2]];
  void topR;
  const upP: Pose = { ...base, armR: at(t(s.shR, 1, false), pole), armL: at(t(s.shL, -1, false), pole) };
  const downP: Pose = { ...base, armR: at(t(s.shR, 1, true), pole), armL: at(t(s.shL, -1, true), pole) };
  if (incline) {
    const ui = solve(base);
    const f = ui.frame.f;
    const upI = (sh: V3): V3 => [sh[0] - f[0] * 50, sh[1] - f[1] * 50, sh[2]];
    const downI = (sh: V3, side: number): V3 => [sh[0] - f[0] * 12 + 6, sh[1] - f[1] * 12 - 4, sh[2] + side * 4];
    return {
      keys: keys(
        { ...base, armR: at(upI(ui.shR), pole), armL: at(upI(ui.shL), pole) },
        { ...base, armR: at(downI(ui.shR, 1), pole), armL: at(downI(ui.shL, -1), pole) },
      ),
      cycle: 2.6,
      held,
      env,
      cam: 75,
    };
  }
  return { keys: keys(upP, downP), cycle: 2.6, held, env, cam: 75 };
}

function benchDips(): Anim {
  const top: Pose = { hip: [8, 56, 0], pitch: 0, armR: at([-12, 44, 14], [-1, 0, 0]), armL: at([-12, 44, -14], [-1, 0, 0]), legR: at([74, 5, 9]), legL: at([74, 5, -9]) };
  const bot: Pose = { ...top, hip: [6, 30, 0], pitch: 4 };
  return { keys: keys(top, bot), cycle: 2.4, env: [{ type: 'box', c: [-22, 20, 0], size: [36, 40, 50] }], cam: 70 };
}

function ohPress(held: Held[], o: { seated?: boolean; push?: boolean } = {}): Anim {
  const base = o.seated ? benchSeat({ hip: [-4, 50, 0] }) : stand();
  const low: Pose = { ...base, ...both(RACK) };
  const high: Pose = { ...base, ...both(dir(176, 14)) };
  const env = o.seated ? [SEAT, { type: 'box' as const, c: [-18, 70, 0] as V3, size: [8, 60, 30] as V3 }] : undefined;
  if (o.push) {
    const dip: Pose = { ...low, hip: [-6, H - 12, 0], pitch: 4 };
    const drive: Pose = { ...high, hip: [0, H + 4, 0], toeR: 20, toeL: 20 };
    return { keys: keys([low, 0.6], [dip, 0.5], [drive, 0.7], [high, 0.6]), cycle: 2.4, held };
  }
  return { keys: keys(low, high), cycle: 2.4, held, env };
}

function raise(kind: 'lateral' | 'front' | 'upright' | 'shrug' | 'curl' | 'curlBar' | 'preacher' | 'triceps' | 'pushdown' | 'crossover', held?: Held[]): Anim {
  const base = stand();
  switch (kind) {
    case 'lateral':
      return { keys: keys({ ...base, ...both(dir(0, 12, 0.95)) }, { ...base, ...both(dir(0, 86, 0.95)) }), cycle: 2.4, held: ['dumbbells'], cam: 22 };
    case 'front':
      return { keys: keys({ ...base, ...both(dir(8, 8)) }, { ...base, ...both(dir(92, 10)) }), cycle: 2.4, held: ['dumbbells'], cam: 70 };
    case 'upright': {
      const up: Pose = { ...base, ...both(dir(40, 14, 0.36, [0, 1, 1])) };
      return { keys: keys({ ...base, ...both(dir(4, 6)) }, up), cycle: 2.4, held: ['barbell'], cam: 45 };
    }
    case 'shrug': {
      const low: Pose = { ...base, ...both(dir(2, 10)) };
      return { keys: keys(low, { ...low, hip: [0, H + 1, 0], ...both(dir(2, 10, 0.93)) }), cycle: 1.8, held: ['barbell'], cam: 40 };
    }
    case 'curl':
    case 'curlBar': {
      const low: Pose = { ...base, ...both(dir(4, 8, 0.98, [-1, 0, 0])) };
      const high: Pose = { ...base, ...both(dir(120, 8, 0.38, [-1, -0.6, 0])) };
      return { keys: keys(low, high), cycle: 2.2, held: kind === 'curl' ? ['dumbbells'] : ['barbell'], cam: 72 };
    }
    case 'preacher': {
      const seat = benchSeat({ hip: [-6, 50, 0], pitch: 18 });
      const low: Pose = { ...seat, ...both(dir(62, 8, 0.97, [-1, -1, 0])) };
      const high: Pose = { ...seat, ...both(dir(120, 8, 0.4, [-0.2, -1, 0])) };
      return { keys: keys(low, high), cycle: 2.4, held: ['barbell'], env: [SEAT, { type: 'box', c: [26, 84, 0], size: [16, 26, 40] }], cam: 75 };
    }
    case 'triceps': {
      const low: Pose = { ...base, ...both(dir(178, 6, 0.3, [0, 1, 0.15])) };
      const high: Pose = { ...base, ...both(dir(176, 6)) };
      return { keys: keys(low, high), cycle: 2.4, held: ['dumbbellChest'], cam: 72 };
    }
    case 'pushdown': {
      const top: Pose = { ...base, pitch: 8, ...both(dir(40, 6, 0.4, [-1, -1, 0])) };
      const bottom: Pose = { ...base, pitch: 8, ...both(dir(8, 6, 0.98, [-1, 0, 0])) };
      return { keys: keys(top, bottom), cycle: 2.2, held: ['handle'], bands: [{ from: [26, 200, 0], to: 'both' }], env: [{ type: 'post', c: [26, 0, -30], h: 205 }], cam: 72 };
    }
    default: {
      const open: Pose = { ...base, pitch: 10, legR: at([12, 5, 9]), legL: at([-10, 5, -9]), ...both(dir(120, 70, 0.95)) };
      const closed: Pose = { ...open, ...both(dir(60, 8, 0.95)) };
      return {
        keys: keys(open, closed),
        cycle: 2.6,
        held,
        bands: [
          { from: [-10, 190, 70], to: 'R' },
          { from: [-10, 190, -70], to: 'L' },
        ],
        cam: 35,
      };
    }
  }
}

// ——— Тяги к себе ———

function pullUp(kind: 'pull' | 'chin' | 'hang' | 'knees'): Anim {
  const barY = 222;
  const hang: Pose = {
    hip: [0, barY - 104, 0],
    ...legs(dir(4, 2)),
    armR: at([2, barY, kind === 'chin' ? 12 : 26]),
    armL: at([2, barY, kind === 'chin' ? -12 : -26]),
    toeR: 25,
    toeL: 25,
  };
  const up: Pose = { ...hang, hip: [-2, barY - 68, 0], pitch: -4, ...legs(dir(10, 2, 0.9)) };
  const env: EnvItem[] = [{ type: 'bar', x: 2, y: barY }];
  if (kind === 'hang') return { keys: keys(hang), cycle: 3, hold: true, env, cam: 55 };
  if (kind === 'knees') {
    const kneesUp: Pose = { ...hang, pitch: -10, legR: dir(110, 3, 0.5, [1, 0.2, 0]), legL: dir(110, 3, 0.5, [1, 0.2, 0]) };
    return { keys: keys(hang, kneesUp), cycle: 2.4, env, cam: 70 };
  }
  return { keys: keys(hang, up), cycle: 2.6, env, cam: 55 };
}

function invertedRow(): Anim {
  const barY = 82;
  const pole: V3 = [-1, 0, 0.4];
  const low: Pose = { hip: [-19, 18, 0], pitch: -83, yaw: 180, armR: at([22, barY, -24], pole), armL: at([22, barY, 24], pole), legR: at([-100, 8, -9]), legL: at([-100, 8, 9]) };
  const high: Pose = { ...low, hip: [-28, 48, 0], pitch: -61 };
  return { keys: keys(low, high), cycle: 2.4, env: [{ type: 'bar', x: 22, y: barY }], cam: 70 };
}

function cablePull(kind: 'lat' | 'bandLat' | 'straightArm' | 'row' | 'rower'): Anim {
  if (kind === 'lat') {
    const seat = benchSeat({ hip: [-4, 50, 0], pitch: -8 });
    const up: Pose = { ...seat, ...both(dir(178, 26, 0.98)) };
    const down: Pose = { ...seat, ...both(dir(150, 60, 0.38, [0, -1, 0.5])) };
    return { keys: keys(up, down), cycle: 2.4, held: ['handle'], bands: [{ from: [0, 250, 0], to: 'both' }], env: [SEAT], cam: 35 };
  }
  if (kind === 'bandLat' || kind === 'straightArm') {
    const base = stand({ pitch: kind === 'straightArm' ? 14 : 0 });
    const up: Pose = { ...base, ...both(dir(165, kind === 'straightArm' ? 8 : 26, 0.98)) };
    const down: Pose =
      kind === 'straightArm' ? { ...base, ...both(dir(12, 8, 0.98)) } : { ...base, ...both(dir(150, 60, 0.38, [0, -1, 0.5])) };
    return { keys: keys(up, down), cycle: 2.4, bands: [{ from: [60, 230, 0], to: 'both' }], cam: kind === 'straightArm' ? 72 : 35 };
  }
  if (kind === 'rower') {
    const catchP: Pose = { hip: [-20, 16, 0], pitch: 28, ...both(dir(90, 10, 0.98)), legR: at([30, 12, 9], [0, 1, 0.1]), legL: at([30, 12, -9], [0, 1, 0.1]) };
    const finish: Pose = { ...catchP, hip: [-66, 16, 0], pitch: -20, ...both(dir(40, 14, 0.42, [-1, 0, 0.3])) };
    return { keys: keys([catchP, 0.8], [finish, 1.2]), cycle: 2.2, held: ['handle'], bands: [{ from: [48, 20, 0], to: 'both' }], env: [{ type: 'rail', x0: -90, x1: 50 }], cam: 72 };
  }
  const seatP = seated({ hip: [-10, 11, 0], pitch: 14, legR: at([62, 16, 10], [0, 1, 0.2]), legL: at([62, 16, -10], [0, 1, 0.2]) });
  const ext: Pose = { ...seatP, pitch: 28, ...both(dir(90, 8, 0.98)) };
  const pulled: Pose = { ...seatP, pitch: -4, ...both(dir(40, 14, 0.4, [-1, 0, 0.4])) };
  return { keys: keys(ext, pulled), cycle: 2.4, held: ['handle'], bands: [{ from: [96, 20, 0], to: 'both' }], cam: 72 };
}

function dbRow(): Anim {
  const base: Pose = {
    hip: [-18, 80, 0],
    pitch: 72,
    armL: at([34, 46, -12], [-1, 0, 0]),
    armR: dir(0, 8),
    legR: at([-14, 5, 20]),
    legL: at([20, 46, -8], [1, -1, 0]),
  };
  const pulled: Pose = { ...base, armR: dir(-35, 12, 0.45, [-1, 0.4, 0.3]) };
  return { keys: keys(base, pulled), cycle: 2.4, held: ['dumbbellR'], env: [{ type: 'box', c: [26, 21, -10], size: [60, 42, 26] }], cam: 75 };
}

function bandArms(kind: 'pullApart' | 'facePull' | 'extRot' | 'intRot' | 'pallof' | 'woodchop' | 'dislocate' | 'punch' | 'steering'): Anim {
  const base = stand();
  switch (kind) {
    case 'pullApart':
      return { keys: keys({ ...base, ...both(dir(90, 12)) }, { ...base, ...both(dir(90, 88)) }), cycle: 2.2, cam: 25, bands: [{ from: [0, 0, 0], to: 'hands' }] };
    case 'facePull': {
      const ext: Pose = { ...base, ...both(dir(100, 10)) };
      const pulled: Pose = { ...base, ...both(dir(120, 60, 0.4, [-0.5, 0.6, 1])) };
      return { keys: keys(ext, pulled), cycle: 2.2, held: ['handle'], bands: [{ from: [110, 150, 0], to: 'both' }], cam: 45 };
    }
    case 'extRot':
    case 'intRot': {
      const inner = dir(60, -30, 0.62, [-0.3, -1, 0.3]);
      const outer = dir(60, 60, 0.62, [-0.3, -1, 0.3]);
      const a: Pose = { ...base, armR: kind === 'extRot' ? inner : outer, armL: HANG };
      const b: Pose = { ...base, armR: kind === 'extRot' ? outer : inner, armL: HANG };
      return { keys: keys(a, b), cycle: 2.2, bands: [{ from: [30, 110, kind === 'extRot' ? -80 : 80], to: 'R' }], cam: 30 };
    }
    case 'pallof': {
      const inP: Pose = { ...base, legR: at([2, 5, 16]), legL: at([0, 5, -16]), ...both(dir(70, 4, 0.35, [0, -1, 0.5])) };
      const out: Pose = { ...inP, ...both(dir(90, 2, 0.98)) };
      return { keys: keys(inP, [out, 1.4]), cycle: 2.8, held: ['handle'], bands: [{ from: [20, 120, 90], to: 'both' }], cam: 35 };
    }
    case 'woodchop': {
      const hi: Pose = { ...base, legR: at([2, 5, 20]), legL: at([0, 5, -20]), yaw: 35, hipYaw: 10, ...both(dir(150, 30, 0.95)) };
      const lo: Pose = { ...hi, hip: [-6, H - 12, 0], yaw: -40, hipYaw: -10, pitch: 18, ...both(dir(20, -20, 0.95)) };
      return { keys: keys(hi, lo), cycle: 2.2, held: ['handle'], bands: [{ from: [-20, 200, 80], to: 'both' }], cam: 30 };
    }
    case 'dislocate': {
      const front: Pose = { ...base, ...both(dir(60, 50)) };
      const over: Pose = { ...base, ...both(dir(180, 50)) };
      const back: Pose = { ...base, ...both(dir(-40, 50)) };
      return { keys: keys(front, over, back, over), cycle: 3.2, bands: [{ from: [0, 0, 0], to: 'hands' }], cam: 40 };
    }
    case 'punch': {
      const guard: Pose = { ...base, legR: at([22, 5, 10]), legL: at([-16, 5, -12]), pitch: 6, ...both(dir(150, 14, 0.3, [0, -1, 0.3])) };
      const jab: Pose = { ...guard, yaw: -12, armL: dir(95, 4, 0.99) };
      const cross: Pose = { ...guard, yaw: 18, armR: dir(95, -4, 0.99) };
      return { keys: keys([guard, 0.5], [jab, 0.5], [guard, 0.5], [cross, 0.5]), cycle: 1.3, cam: 60 };
    }
    default: {
      const hold: Pose = { ...base, ...both(dir(90, 12, 0.6, [0, -1, 0.4])) };
      return { keys: keys({ ...hold, yaw: -6 }, { ...hold, yaw: 6 }), cycle: 2.4, held: ['wheel'], bands: [{ from: [40, 110, 90], to: 'R' }], cam: 40 };
    }
  }
}

function landmine(): Anim {
  const left: Pose = stand({ legR: at([2, 5, 18]), legL: at([0, 5, -18]), pitch: 16, yaw: -30, hipYaw: -12, ...both(dir(90, -40, 0.96)) });
  const right: Pose = { ...left, yaw: 30, hipYaw: 12, ...both(dir(90, 40, 0.96)) };
  const mid: Pose = { ...left, yaw: 0, hipYaw: 0, ...both(dir(140, 0, 0.9)) };
  return { keys: keys(left, mid, right, mid), cycle: 2.8, held: ['landmine'], cam: 30 };
}

function olympic(snatch: boolean): Anim {
  const hang = stand({ hip: [-10, 80, 0], pitch: 22, ...both(dir(0, snatch ? 30 : 12)) });
  const ext = stand({ hip: [2, H + 12, 0], pitch: -6, ...both(dir(4, snatch ? 30 : 12)), legR: at([2, 16, 9]), legL: at([0, 16, -9]), toeR: 50, toeL: 50 });
  const pull = { ...ext, ...both(snatch ? dir(120, 40, 0.55, [0, 1, 1]) : dir(60, 14, 0.4, [0, 1, 0.6])) };
  const catchP = snatch
    ? stand({ hip: [-14, 64, 0], pitch: 14, ...both(dir(178, 34)), legR: at([2, 5, 16]), legL: at([0, 5, -16]) })
    : stand({ hip: [-14, 64, 0], pitch: 18, ...both(RACK), legR: at([2, 5, 16]), legL: at([0, 5, -16]) });
  const stood = snatch ? stand({ ...both(dir(178, 34)) }) : stand({ ...both(RACK) });
  return { keys: keys([hang, 0.7], [ext, 0.4], [pull, 0.3], [catchP, 0.8], [stood, 1]), cycle: 3, held: ['barbell'], cam: 66 };
}

// ——— Хват, переноски, реквизит ———

function grip(kind: 'farmer' | 'pinch' | 'roller' | 'gripper' | 'wristCurl' | 'steerPlate'): Anim {
  if (kind === 'farmer') return walk(['dumbbells'], 1.1);
  if (kind === 'pinch') return { keys: keys(stand({ ...both(dir(2, 14)) })), cycle: 3, hold: true, held: ['plates'], cam: 50 };
  if (kind === 'roller') {
    const a = stand({ ...both(dir(90, 6, 0.99)) });
    return { keys: keys({ ...a, ...both(dir(92, 6, 0.99, [0, -1, 0.3])) }, { ...a, ...both(dir(86, 6, 0.99, [0, -1, 0.3])) }), cycle: 0.8, held: ['handle'], cam: 60 };
  }
  if (kind === 'gripper') {
    const a = stand({ ...both(dir(80, 10, 0.6, ELBOW_DOWN)) });
    return { keys: keys(a, { ...a, ...both(dir(84, 10, 0.57, ELBOW_DOWN)) }), cycle: 1.2, cam: 50 };
  }
  if (kind === 'wristCurl') {
    const seat = benchSeat({ hip: [-4, 50, 0], pitch: 22 });
    const down: Pose = { ...seat, ...both(dir(70, 8, 0.97, [0, -1, 0])) };
    const up: Pose = { ...seat, ...both(dir(76, 8, 0.9, [0, -1, 0])) };
    return { keys: keys(down, up), cycle: 1.4, held: ['dumbbells'], env: [SEAT], cam: 72 };
  }
  const hold = stand({ ...both(dir(90, 12, 0.62, [0, -1, 0.4])) });
  return { keys: keys({ ...hold, roll: -4, yaw: -8 }, { ...hold, roll: 4, yaw: 8 }), cycle: 2.2, held: ['wheel'], cam: 40 };
}

function halo(): Anim {
  const p = (pitch: number, spread: number) => stand({ ...both(dir(pitch, spread, 0.4, [0, -1, 0.6])) });
  return { keys: keys(p(170, 60), p(170, 10), p(130, -20), p(170, 10)).map((k) => ({ ...k, linear: true })), cycle: 2.4, held: ['kettlebellChest'], cam: 40 };
}

function getUp(): Anim {
  const lie: Pose = supine({ hip: [0, 11, 0], armR: dir(90, 4), armL: dir(10, 40), legR: at([40, 6, 12], [1, 0.2, 0.1]), legL: dir(0, 12) });
  const sit: Pose = seated({ hip: [0, 11, 0], pitch: -30, armR: dir(150, 4), armL: at([-36, 5, -26]), legR: at([40, 6, 12], [0, 1, 0]), legL: at([82, 8, -14]) });
  const bridge: Pose = { hip: [0, 40, 0], pitch: -20, armR: dir(160, 4), armL: at([-36, 5, -26]), legR: at([40, 6, 12]), legL: at([-10, 6, -30], [1, -1, 0]) };
  const kneel: Pose = { hip: [8, 48, 0], pitch: 0, armR: dir(180, 4), armL: dir(10, 20), legR: at([40, 6, 12]), legL: at([-30, 6, -10], [1, -1, 0]) };
  const up = stand({ armR: dir(180, 4), armL: HANG });
  return { keys: keys(lie, sit, bridge, kneel, [up, 1.4], kneel, bridge, sit), cycle: 9, held: ['kettlebell'], cam: 60 };
}

function throwBall(kind: 'slam' | 'rotational' | 'overhead' | 'wallBall'): Anim {
  if (kind === 'slam') {
    const up = stand({ hip: [0, H + 2, 0], ...both(dir(178, 8)), toeR: 15, toeL: 15, ball: [4, 205, 0] });
    const down = stand({ hip: [-18, 56, 0], pitch: 50, ...both(dir(70, 8)), ball: [44, 10, 0] });
    return { keys: keys([up, 1], [down, 0.6]), cycle: 1.6, ball: 'med', held: [], cam: 72 };
  }
  if (kind === 'overhead') {
    const back = stand({ pitch: -12, legR: at([22, 5, 10]), legL: at([-18, 5, -10]), ...both(dir(200, 10, 0.8)) });
    const fwd = stand({ pitch: 12, legR: at([22, 5, 10]), legL: at([-18, 5, -10]), ...both(dir(110, 10)) });
    return { keys: keys([back, 1], [fwd, 0.5]), cycle: 1.6, held: ['medball'], cam: 70 };
  }
  if (kind === 'wallBall') return { ...thruster(['medball']), cycle: 2 };
  const load = stand({ hip: [-4, H - 8, 0], legR: at([2, 5, 22]), legL: at([0, 5, -22]), yaw: -60, hipYaw: -20, ...both(dir(80, -30, 0.8)) });
  const release = { ...load, yaw: 50, hipYaw: 20, ...both(dir(90, 40, 0.95)) };
  return { keys: keys([load, 1], [release, 0.5]), cycle: 1.8, held: ['medball'], cam: 25 };
}

// ——— Кор и пол ———

function floorCore(kind: 'plankSide' | 'copenhagen' | 'hollow' | 'deadBug' | 'crunch' | 'bicycle' | 'legRaise' | 'flutter' | 'twist' | 'superman' | 'swimmer' | 'birdDog' | 'catCow' | 'kickback' | 'clamshell' | 'march' | 'childs' | 'thoracic' | 'ytw' | 'yRaise'): Anim {
  switch (kind) {
    case 'plankSide':
    case 'copenhagen': {
      const cph = kind === 'copenhagen';
      const p: Pose = {
        hip: [0, cph ? 38 : 30, 0],
        pitch: 0,
        roll: -74,
        armL: at([4, 5, -46], [0, 0, 1]),
        armR: dir(180, 4),
        legR: at([0, cph ? 44 : 8, 80]),
        legL: cph ? dir(0, 0, 0.6) : at([0, 6, 78]),
      };
      return { keys: keys(p), cycle: 3, hold: true, cam: 12, env: cph ? [{ type: 'box', c: [0, 22, 88], size: [30, 44, 26] }] : undefined };
    }
    case 'hollow':
      return { keys: keys(supine({ hip: [0, 12, 0], pitch: -72, ...both(dir(180, 6)), ...legs(dir(18, 2)) })), cycle: 3, hold: true, cam: 75 };
    case 'deadBug': {
      const base = supine({ ...both(dir(90, 10)), ...legs(dir(90, 4, 0.55, [0, 1, 0])) });
      const a: Pose = { ...base, armR: dir(175, 10), legL: dir(12, 4, 0.98) };
      const b: Pose = { ...base, armL: dir(175, 10), legR: dir(12, 4, 0.98) };
      return { keys: keys(base, a, base, b), cycle: 3.2, cam: 70 };
    }
    case 'crunch': {
      const base = supine({ ...both(dir(160, 60, 0.4, [0, 1, 1])), legR: at([48, 6, 12], [1, 0.2, 0.1]), legL: at([48, 6, -12], [1, 0.2, 0.1]) });
      return { keys: keys(base, { ...base, pitch: -58 }), cycle: 2, cam: 72 };
    }
    case 'bicycle': {
      const base = supine({ pitch: -62, ...both(dir(160, 60, 0.4, [0, 1, 1])), ...legs(dir(90, 3, 0.55, [0, 1, 0])) });
      const r: Pose = { ...base, yaw: 18, legR: dir(95, 3, 0.45, [0, 1, 0]), legL: dir(30, 3, 0.98) };
      const l: Pose = { ...base, yaw: -18, legL: dir(95, 3, 0.45, [0, 1, 0]), legR: dir(30, 3, 0.98) };
      return { keys: keys(r, l), cycle: 1.8, cam: 55 };
    }
    case 'legRaise': {
      const low = supine({ ...both(dir(10, 20)), ...legs(dir(8, 3)) });
      return { keys: keys(low, { ...low, ...legs(dir(88, 3)) }), cycle: 2.4, cam: 72 };
    }
    case 'flutter': {
      const base = supine({ pitch: -84, ...both(dir(10, 20)) });
      return { keys: keys({ ...base, legR: dir(25, 3), legL: dir(12, 3) }, { ...base, legR: dir(12, 3), legL: dir(25, 3) }), cycle: 0.6, cam: 70 };
    }
    case 'twist': {
      const base = seated({ pitch: -35, legR: at([44, 16, 10], [0.5, 1, 0]), legL: at([44, 16, -10], [0.5, 1, 0]), ...both(dir(55, 8, 0.55, ELBOW_DOWN)) });
      return { keys: keys({ ...base, yaw: 35 }, { ...base, yaw: -35 }), cycle: 1.8, held: ['medball'], cam: 60 };
    }
    case 'superman':
    case 'swimmer': {
      const low = prone({ ...both(dir(180, 12)) });
      const high = prone({ pitch: 80, head: [-30, 0], ...both(dir(kind === 'swimmer' ? 0 : 170, kind === 'swimmer' ? 60 : 12)), ...legs(dir(-12, 3)) });
      return { keys: keys(low, high), cycle: kind === 'swimmer' ? 2.6 : 2.2, cam: 60 };
    }
    case 'birdDog':
    case 'kickback': {
      const base = allFours();
      const ext: Pose =
        kind === 'birdDog'
          ? { ...base, armR: dir(180, 8), legL: dir(0, 3) }
          : { ...base, legR: dir(-40, 4, 0.55, [0, -1, 0]) };
      return { keys: keys(base, ext), cycle: 2.4, cam: 62 };
    }
    case 'catCow': {
      const base = allFours();
      return { keys: keys({ ...base, pitch: 76, head: [-25, 0] }, { ...base, pitch: 94, head: [25, 0] }), cycle: 3, cam: 80 };
    }
    case 'thoracic': {
      const base = allFours();
      const open: Pose = { ...base, roll: -35, armR: dir(180, 10) };
      return { keys: keys({ ...base, armR: at([14, 12, 2]) }, open), cycle: 3, cam: 50 };
    }
    case 'childs': {
      const p: Pose = { hip: [-56, 27, 0], pitch: 98, head: [10, 0], armR: at([46, 5, 14]), armL: at([46, 5, -14]), legR: at([-62, 6, 8], [0, 1, 0]), legL: at([-62, 6, -8], [0, 1, 0]), toeR: 0, toeL: 0 };
      return { keys: keys(p), cycle: 4, hold: true, cam: 75 };
    }
    case 'clamshell': {
      const base: Pose = { hip: [0, 21, 0], pitch: 0, roll: -90, yaw: -90, head: [0, 0], armL: dir(170, 0, 0.95), armR: dir(90, 0, 0.6), legR: dir(55, 0, 0.62, [0, 1, 0]), legL: dir(55, 0, 0.62, [0, 1, 0]) };
      const open: Pose = { ...base, legR: dir(55, 45, 0.62, [0, 1, 0]) };
      return { keys: keys(base, open), cycle: 2, bands: [{ from: [0, 0, 0], to: 'knees' }], cam: 70 };
    }
    case 'march': {
      const base = supine({ ...legs(dir(12, 3)) });
      return { keys: keys({ ...base, legR: dir(95, 3, 0.55, [0, 1, 0]) }, base, { ...base, legL: dir(95, 3, 0.55, [0, 1, 0]) }, base), cycle: 2.4, bands: [{ from: [0, 0, 0], to: 'feet' }], cam: 65 };
    }
    case 'yRaise': {
      const base: Pose = { hip: [-6, 48, 0], pitch: 50, ...both(dir(0, 10)), legR: at([-40, 5, 12]), legL: at([-40, 5, -12]), toeR: 40, toeL: 40 };
      return { keys: keys(base, { ...base, ...both(dir(150, 40)) }), cycle: 2.4, held: ['dumbbells'], env: [{ type: 'box', c: [12, 30, 0], size: [60, 20, 26], front: false }], cam: 45 };
    }
    default: {
      const base = prone({ ...both(dir(0, 20)) });
      return { keys: keys(base, { ...base, ...both(dir(150, 45)) }, { ...base, ...both(dir(60, 85)) }, { ...base, ...both(dir(10, 60, 0.6)) }), cycle: 3.2, cam: 45 };
    }
  }
}

// ——— Кардио и прыжки ———

function run(o: { knee?: number; heel?: number; lean?: number; cycle?: number; arm?: number; inPlace?: boolean } = {}): Anim {
  const knee = o.knee ?? 70;
  const heel = o.heel ?? 0.55;
  const lean = o.lean ?? 8;
  const armF = dir(o.arm ?? 70, 8, 0.58, [0, -1, 0]);
  const armB = dir(-40, 8, 0.7, [0, -1, 0]);
  const stance = (R: boolean): Pose => ({
    hip: [0, H - 5, 0],
    pitch: lean,
    armR: R ? armB : armF,
    armL: R ? armF : armB,
    legR: R ? dir(6, 3, 0.97) : dir(-25, 3, heel, [1, 0, 0]),
    legL: R ? dir(-25, 3, heel, [1, 0, 0]) : dir(6, 3, 0.97),
    toeR: R ? 5 : 45,
    toeL: R ? 45 : 5,
  });
  const flight = (R: boolean): Pose => ({
    hip: [0, H + 1, 0],
    pitch: lean,
    armR: R ? armB : armF,
    armL: R ? armF : armB,
    legR: R ? dir(-28, 3, 0.94) : dir(knee, 3, 0.62, [1, 0.3, 0]),
    legL: R ? dir(knee, 3, 0.62, [1, 0.3, 0]) : dir(-28, 3, 0.94),
    toeR: 30,
    toeL: 30,
  });
  return {
    keys: keys([stance(true), 1, true], [flight(true), 1, true], [stance(false), 1, true], [flight(false), 1, true]),
    cycle: o.cycle ?? 0.8,
    cam: 78,
  };
}

function walk(held?: Held[], cycle = 1.2): Anim {
  const arm = (p: number) => dir(p, 10, 0.98);
  const step = (R: boolean): Pose => ({
    hip: [0, H - 2, 0],
    armR: held ? dir(2, 12) : arm(R ? -18 : 18),
    armL: held ? dir(2, 12) : arm(R ? 18 : -18),
    legR: R ? dir(18, 3, 0.99) : dir(-16, 3, 0.97),
    legL: R ? dir(-16, 3, 0.97) : dir(18, 3, 0.99),
    toeR: R ? -8 : 30,
    toeL: R ? 30 : -8,
  });
  const pass = (R: boolean): Pose => ({
    hip: [0, H, 0],
    armR: held ? dir(2, 12) : arm(0),
    armL: held ? dir(2, 12) : arm(0),
    legR: R ? dir(0, 3, 0.99) : dir(10, 3, 0.8, [1, 0, 0]),
    legL: R ? dir(10, 3, 0.8, [1, 0, 0]) : dir(0, 3, 0.99),
  });
  return { keys: keys([step(true), 1, true], [pass(false), 1, true], [step(false), 1, true], [pass(true), 1, true]), cycle, held, cam: 72 };
}

function jumpingJacks(): Anim {
  const closed = stand({ ...both(dir(0, 12)) });
  const open: Pose = { hip: [0, H + 4, 0], ...both(dir(0, 165)), legR: at([2, 7, 34]), legL: at([0, 7, -34]), toeR: 20, toeL: 20 };
  return { keys: keys(closed, open), cycle: 1.1, cam: 20 };
}

function jumpRope(): Anim {
  const hands = both(dir(30, 30, 0.6, [0, -1, 0.3]));
  const low = stand({ ...hands, hip: [0, H - 4, 0], k: 0 });
  const high = stand({ ...hands, hip: [0, H + 8, 0], legR: at([2, 17, 9]), legL: at([0, 17, -9]), toeR: 40, toeL: 40, k: 0.5 });
  return { keys: keys([low, 1, true], [high, 1, true], [{ ...low, k: 1 }, 0]), cycle: 0.7, held: ['rope'], cam: 55 };
}

function shuffle(kind: 'lateral' | 'carioca' | 'bandWalk' | 'hops' | 'quickFeet'): Anim {
  if (kind === 'quickFeet') {
    const base = stand({ hip: [-8, H - 12, 0], pitch: 14, ...both(dir(40, 10, 0.7, ELBOW_DOWN)) });
    const r = { ...base, legR: at([6, 12, 12]), toeR: 30 };
    const l = { ...base, legL: at([4, 12, -12]), toeL: 30 };
    return { keys: keys([r, 1, true], [l, 1, true]), cycle: 0.35, cam: 55 };
  }
  if (kind === 'hops') {
    const base = stand({ hip: [-6, H - 10, 0], pitch: 12, ...both(dir(30, 14, 0.8)) });
    const side = (z: number, y: number): Pose => ({ ...base, hip: [-6, H - 10 + y, z], legR: at([2, 5 + y, 9 + z]), legL: at([0, 5 + y, -9 + z]) });
    return { keys: keys(side(-14, 0), side(0, 14), side(14, 0), side(0, 14)), cycle: 0.9, cam: 20 };
  }
  const low = kind === 'bandWalk' ? 22 : 18;
  const base = stand({ hip: [-10, H - low, 0], pitch: 18, ...both(kind === 'lateral' ? dir(60, 30, 0.8) : dir(20, 14, 0.9)) });
  const wideP: Pose = { ...base, legR: at([2, 5, 28]), legL: at([0, 5, -28]) };
  const narrowP: Pose = { ...base, hip: [-10, H - low, 14], legR: at([2, 5, 22]), legL: at([0, 5, 6]) };
  if (kind === 'carioca') {
    const cross: Pose = { ...base, hip: [-4, H - 6, 8], pitch: 4, yaw: 25, hipYaw: 35, legR: at([2, 5, 16]), legL: at([10, 5, 22]) };
    const behind: Pose = { ...base, hip: [-4, H - 6, 8], pitch: 4, yaw: -15, hipYaw: -25, legR: at([2, 5, 16]), legL: at([-12, 5, 26]) };
    return { keys: keys(wideP, cross, wideP, behind), cycle: 1.2, cam: 25 };
  }
  return { keys: keys(wideP, narrowP), cycle: kind === 'bandWalk' ? 1.4 : 0.7, bands: kind === 'bandWalk' ? [{ from: [0, 0, 0], to: 'knees' }] : undefined, cam: 22 };
}

function jump(kind: 'box' | 'broad' | 'pogo' | 'depth' | 'singleLeg' | 'skater' | 'splitStep'): Anim {
  const crouch = stand({ hip: [-20, 60, 0], pitch: 38, ...both(dir(-40, 10)) });
  if (kind === 'box' || kind === 'depth') {
    const onBox = stand({ hip: [44, H + 36 - 14, 0], pitch: 16, ...both(dir(50, 10)), legR: at([46, 41, 9]), legL: at([44, 41, -9]) });
    const air = stand({ hip: [24, H + 52, 0], ...both(dir(150, 10)), legR: dir(60, 3, 0.55, [1, 0.3, 0]), legL: dir(60, 3, 0.55, [1, 0.3, 0]) });
    if (kind === 'depth') {
      const standBox = stand({ hip: [44, H + 36, 0], legR: at([46, 41, 9]), legL: at([44, 41, -9]) });
      const land = stand({ hip: [74, 64, 0], pitch: 30, ...both(dir(-30, 10)), legR: at([96, 5, 9]), legL: at([94, 5, -9]) });
      const up = stand({ hip: [96, H + 30, 0], ...both(dir(170, 10)), legR: at([98, 30, 9]), legL: at([96, 30, -9]), toeR: 40, toeL: 40 });
      return { keys: keys([standBox, 1], [land, 0.4], [up, 0.7]), cycle: 2.2, env: [BOX], cam: 70 };
    }
    return { keys: keys([crouch, 1], [air, 0.6], [onBox, 1]), cycle: 2.2, env: [BOX], cam: 70 };
  }
  if (kind === 'broad') {
    const air = stand({ hip: [40, H + 18, 0], pitch: 20, ...both(dir(140, 10)), legR: dir(-10, 3, 0.9), legL: dir(-10, 3, 0.9), toeR: 40, toeL: 40 });
    const land = stand({ hip: [62, 62, 0], pitch: 36, ...both(dir(70, 10)), legR: at([86, 5, 9]), legL: at([84, 5, -9]) });
    return { keys: keys([crouch, 1], [air, 0.5], [land, 1]), cycle: 2, cam: 78 };
  }
  if (kind === 'pogo') {
    const low = stand({ ...both(dir(30, 16, 0.8)), hip: [0, H - 3, 0] });
    const high = { ...low, hip: [0, H + 14, 0] as V3, legR: at([2, 22, 9]), legL: at([0, 22, -9]), toeR: 45, toeL: 45 };
    return { keys: keys([low, 1, true], [high, 1, true]), cycle: 0.55, cam: 70 };
  }
  if (kind === 'splitStep') {
    const ready = stand({ hip: [-8, H - 14, 0], pitch: 14, legR: at([2, 5, 20]), legL: at([0, 5, -20]), ...both(dir(60, 14, 0.7, ELBOW_DOWN)) });
    const hop = { ...ready, hip: [-8, H - 4, 0] as V3, legR: at([2, 12, 20]), legL: at([0, 12, -20]), toeR: 35, toeL: 35 };
    const burst = { ...ready, hip: [-6, H - 16, 22] as V3, yaw: -30, legR: at([10, 5, 40]), legL: at([-6, 5, -12]) };
    return { keys: keys(ready, [hop, 0.4], [ready, 0.4], burst), cycle: 1.8, cam: 30 };
  }
  if (kind === 'skater') {
    const left: Pose = stand({ hip: [-10, 62, -30], pitch: 30, legL: at([0, 5, -34]), legR: at([-30, 12, -60], [1, 0, 0]), yaw: 10, ...both(dir(40, 30)) });
    const right: Pose = { ...left, hip: [-10, 62, 30], legR: at([2, 5, 34]), legL: at([-30, 12, 60], [1, 0, 0]), yaw: -10 };
    const mid: Pose = stand({ hip: [-6, H + 6, 0], pitch: 20, ...both(dir(20, 30)), legR: dir(5, 20, 0.9), legL: dir(5, 20, 0.9) });
    return { keys: keys(left, [mid, 0.6], right, [mid, 0.6]), cycle: 1.8, cam: 20 };
  }
  const base = stand({ hip: [-10, 70, 0], pitch: 28, legL: dir(-30, 3, 0.6, [1, 0, 0]), ...both(dir(-20, 10)) });
  const air = { ...base, hip: [26, H + 10, 0] as V3, legR: dir(-15, 3, 0.95), ...both(dir(110, 10)), toeR: 40 };
  const land = { ...base, hip: [44, 68, 0], legR: at([56, 5, 9]) } as Pose;
  return { keys: keys([base, 1], [air, 0.5], [land, 1.2]), cycle: 2, cam: 75 };
}

function burpee(sprawl = false): Anim {
  const standP = stand({ ...both(dir(10, 10)) });
  const squatP = stand({ hip: [-10, 44, 0], pitch: 60, armR: at([36, 5, 16]), armL: at([36, 5, -16]) });
  const plank: Pose = { ...bodyLine(-82, sprawl ? 36 : 62), armR: at([36, 5, 18], [-0.3, -0.7, 0.5]), armL: at([36, 5, -18], [-0.3, -0.7, 0.5]), toeR: 0, toeL: 0 };
  const jumpP = stand({ hip: [0, H + 20, 0], ...both(dir(175, 10)), legR: at([2, 24, 9]), legL: at([0, 24, -9]), toeR: 40, toeL: 40 });
  return {
    keys: sprawl ? keys([standP, 1], [squatP, 0.4], [plank, 0.8], [squatP, 0.4]) : keys([standP, 0.8], [squatP, 0.5], [plank, 0.8], [squatP, 0.5], [jumpP, 0.5]),
    cycle: sprawl ? 1.8 : 2.8,
    cam: 70,
  };
}

function bike(fast = false): Anim {
  const seat: V3 = [-14, 80, 0];
  const pose = (a: number): Pose => {
    const pR: V3 = [Math.cos(a) * 12, 26 + Math.sin(a) * 12 + 4, 9];
    const pL: V3 = [Math.cos(a + Math.PI) * 12, 26 + Math.sin(a + Math.PI) * 12 + 4, -9];
    return {
      hip: seat,
      pitch: fast ? 55 : 42,
      head: [-15, 0],
      armR: at([34, 83, 12], [0, -1, 0.5]),
      armL: at([34, 83, -12], [0, -1, 0.5]),
      legR: at(pR, [1, 0.3, 0.1]),
      legL: at(pL, [1, 0.3, 0.1]),
      toeR: 10,
      toeL: 10,
      k: a,
    };
  };
  const ks: Key[] = [];
  for (let i = 0; i <= 8; i++) ks.push({ pose: pose((-i / 8) * Math.PI * 2), d: i === 8 ? 0 : 1, linear: true });
  return { keys: ks, cycle: fast ? 0.55 : 0.9, env: [{ type: 'bike' }], cam: 80 };
}

// ——— Реакция и техника ———

function ready(kind: 'stance' | 'start' | 'catch' | 'phone'): Anim {
  const r = stand({ hip: [-8, H - 14, 0], pitch: 16, legR: at([4, 5, 18]), legL: at([0, 5, -18]), ...both(dir(50, 12, 0.72, ELBOW_DOWN)) });
  if (kind === 'phone') {
    const p = stand({ ...both(dir(70, 4, 0.5, ELBOW_DOWN)), head: [25, 0] });
    return { keys: keys(p, { ...p, armR: dir(76, 2, 0.52, ELBOW_DOWN) }), cycle: 1, cam: 50 };
  }
  if (kind === 'catch') {
    const hold = stand({ ...both(dir(90, 6, 0.95)), armL: HANG, ball: [44, 136, 10] });
    const caught = { ...hold, hip: [2, H - 10, 0] as V3, pitch: 14, armR: dir(40, 4, 0.98), armL: HANG, ball: [40, 70, 10] as V3 };
    return { keys: keys([hold, 1], [caught, 0.35]), cycle: 1.6, ball: 'small', cam: 60 };
  }
  if (kind === 'start') {
    const go = stand({ hip: [22, H - 10, 0], pitch: 40, armR: dir(80, 8, 0.6, [0, -1, 0]), armL: dir(-40, 8, 0.7, [0, -1, 0]), legR: dir(70, 3, 0.62, [1, 0.3, 0]), legL: at([-24, 8, -9]), toeL: 45 });
    return { keys: keys([r, 1.2], [go, 0.5]), cycle: 1.8, cam: 72 };
  }
  return { keys: keys(r, { ...r, hip: [-8, H - 18, 0] }), cycle: 0.8, cam: 50 };
}

function skill(kind: 'juggle' | 'footDribble' | 'basket' | 'stick'): Anim {
  if (kind === 'juggle') {
    const base = stand({ ...both(dir(20, 30)) });
    const kick = { ...base, legR: dir(60, 3, 0.75, [1, 0.3, 0]), toeR: 15, ball: [30, 40, 9] as V3 };
    const up = { ...base, ball: [30, 110, 9] as V3 };
    return { keys: keys([kick, 1], [up, 1]), cycle: 1.1, ball: 'football', cam: 62 };
  }
  if (kind === 'footDribble') {
    const base = stand({ hip: [-4, H - 8, 0], pitch: 12, ...both(dir(20, 25)) });
    const touch = { ...base, legR: at([28, 8, 6], [1, 0, 0]), ball: [38, 10, 6] as V3 };
    const plant = { ...base, legL: at([22, 5, -8]), ball: [52, 10, 4] as V3 };
    return { keys: keys([touch, 1, true], [plant, 1, true]), cycle: 0.8, ball: 'football', cam: 60 };
  }
  if (kind === 'basket') {
    const base = stand({ hip: [-8, H - 16, 0], pitch: 20, legR: at([4, 5, 18]), legL: at([0, 5, -18]), armL: dir(60, 20, 0.7, ELBOW_DOWN) });
    const high = { ...base, armR: dir(50, 20, 0.7, [0, -1, 0.3]), ball: [30, 56, 22] as V3 };
    const low = { ...base, armR: dir(30, 20, 0.95, [0, -1, 0.3]), ball: [30, 10, 22] as V3 };
    return { keys: keys([high, 1], [low, 0.7]), cycle: 0.7, ball: 'basket', cam: 45 };
  }
  const base = stand({ hip: [-10, H - 16, 0], pitch: 30, legR: at([4, 5, 18]), legL: at([0, 5, -18]) });
  const l: Pose = { ...base, armL: dir(60, -10, 0.7, ELBOW_DOWN), armR: dir(40, 20, 0.95), ball: [66, 5, 18] as V3 };
  const r: Pose = { ...base, armL: dir(60, -30, 0.7, ELBOW_DOWN), armR: dir(40, -10, 0.95), ball: [66, 5, -14] as V3 };
  return { keys: keys(l, r), cycle: 0.9, held: ['stick'], ball: 'small', cam: 45 };
}

// ——— Мобильность и растяжка ———

function mobility(kind: 'legSwing' | 'armCircles' | 'hipCircles' | 'neck' | 'worlds' | 'inchworm' | 'ankle' | 'streamline' | 'aSkip'): Anim {
  switch (kind) {
    case 'legSwing': {
      const base = stand({ armL: dir(90, 70, 0.9) });
      return { keys: keys({ ...base, legR: dir(75, 3) }, { ...base, legR: dir(-35, 3) }), cycle: 1.4, cam: 80 };
    }
    case 'armCircles': {
      const p = (a: number): Pose => stand({ ...both(dir(a, 80)) });
      return { keys: keys(p(0), p(90), p(180), p(270)).map((k) => ({ ...k, linear: true })), cycle: 1.6, cam: 60 };
    }
    case 'hipCircles': {
      const base = stand({ legR: at([2, 5, 16]), legL: at([0, 5, -16]), ...both(dir(40, 40, 0.5, [0, -1, 1])) });
      const p = (x: number, z: number): Pose => ({ ...base, hip: [x, H - 4, z], pitch: -x * 0.4, roll: z * 0.4 });
      return { keys: keys(p(8, 0), p(0, 8), p(-8, 0), p(0, -8)), cycle: 2.4, cam: 40 };
    }
    case 'neck': {
      const base = stand();
      return { keys: keys({ ...base, head: [30, 0] }, { ...base, head: [0, 30] }, { ...base, head: [-25, 0] }, { ...base, head: [0, -30] }), cycle: 3.2, cam: 45 };
    }
    case 'worlds': {
      const lungeP: Pose = { hip: [-6, 44, 0], pitch: 55, armL: at([34, 5, -10]), armR: at([30, 6, 4]), legR: at([34, 5, 12]), legL: at([-46, 7, -9]), toeL: 50 };
      const open: Pose = { ...lungeP, yaw: 30, armR: dir(180, 0) };
      return { keys: keys(lungeP, open), cycle: 3.2, cam: 45 };
    }
    case 'inchworm': {
      const fold = stand({ hip: [-6, H, 0], pitch: 120, armR: at([22, 5, 14]), armL: at([22, 5, -14]) });
      const plank: Pose = { ...bodyLine(0, 62), armR: at([118, 5, 18]), armL: at([118, 5, -18]), toeR: 0, toeL: 0 };
      return { keys: keys(stand({ ...both(dir(0, 10)) }), fold, [plank, 1.4], fold), cycle: 4.4, cam: 75 };
    }
    case 'ankle': {
      const base: Pose = { hip: [-4, 48, 0], pitch: 4, ...both(dir(90, 8, 0.7)), legR: at([30, 5, 10]), legL: at([-40, 6, -9], [1, -1, 0]), toeL: 0 };
      return { keys: keys(base, { ...base, hip: [8, 48, 0] }), cycle: 2, env: [{ type: 'wall', x: 58 }], cam: 72 };
    }
    case 'aSkip':
      return run({ knee: 100, heel: 0.6, lean: 2, cycle: 1.1, arm: 100 });
    default: {
      const p = stand({ ...both(dir(180, 6)) });
      return { keys: keys(p), cycle: 3, hold: true, env: [{ type: 'wall', x: -16 }], cam: 60 };
    }
  }
}

function stretch(kind: 'hipFlexor' | 'hamstring' | 'quad' | 'pigeon' | 'chest' | 'calf' | 'neck' | 'breathing' | 'foamRoll' | 'roller' | 'lateralNeck' | 'isoNeck'): Anim {
  switch (kind) {
    case 'hipFlexor':
      return { keys: keys({ hip: [-8, 44, 0], pitch: -6, ...both(dir(10, 14)), legR: at([34, 5, 12]), legL: at([-46, 6, -9], [1, -1, 0]), toeL: 0 }), cycle: 4, hold: true, cam: 75 };
    case 'hamstring':
      return { keys: keys(seated({ pitch: 55, ...both(dir(90, 6)), toeR: -20, toeL: -20 })), cycle: 4, hold: true, cam: 70 };
    case 'quad':
      return { keys: keys(stand({ legL: dir(-20, 0, 0.3, [1, 0, 0]), armL: dir(-20, 5, 0.78, [-1, 0, 0.2]), armR: dir(90, 60) })), cycle: 4, hold: true, cam: 80 };
    case 'pigeon':
      return { keys: keys({ hip: [0, 26, 0], pitch: 22, armR: at([38, 5, 16]), armL: at([38, 5, -16]), legR: at([22, 6, -16], [1, -0.4, 1.2]), legL: at([-80, 6, -8]), toeL: 0 }), cycle: 4, hold: true, cam: 55 };
    case 'chest':
      return { keys: keys(stand({ yaw: -20, armR: dir(90, 88, 0.95), legR: at([20, 5, 9]) })), cycle: 4, hold: true, env: [{ type: 'post', c: [-6, 0, 58], h: 200 }], cam: 30 };
    case 'calf':
      return { keys: keys({ hip: [0, H - 6, 0], pitch: 20, ...both(at([44, 128, 0])), legR: at([22, 5, 9]), legL: at([-40, 5, -9]) }), cycle: 4, hold: true, env: [{ type: 'wall', x: 50 }], cam: 75 };
    case 'neck':
      return { keys: keys(stand({ roll: -4, head: [0, 0], armR: dir(150, -40, 0.4) }), stand({ roll: -8, head: [10, 0], armR: dir(150, -40, 0.4) })), cycle: 4, cam: 20 };
    case 'isoNeck': {
      const p = stand({ armR: dir(160, 0, 0.5, [0, -1, 1]) });
      return { keys: keys(p), cycle: 3, hold: true, cam: 60 };
    }
    case 'lateralNeck': {
      const base: Pose = { hip: [0, 21, 0], pitch: 0, roll: -90, yaw: -90, armL: dir(170, 0, 0.95), armR: dir(0, 0), ...legs(dir(0, 0)) };
      return { keys: keys({ ...base, head: [0, 0] }, { ...base, roll: -78 }), cycle: 3, cam: 70 };
    }
    case 'foamRoll': {
      const base: Pose = { hip: [0, 32, 0], pitch: -92, armR: at([-60, 5, 20]), armL: at([-60, 5, -20]), ...legs(dir(0, 3)) };
      return { keys: keys(base, { ...base, hip: [-30, 32, 0] }), cycle: 2.4, env: [{ type: 'roller', c: [22, 10, 0] }], cam: 70 };
    }
    case 'roller': {
      const base: Pose = { hip: [30, 11, 0], pitch: -80, ...both(dir(170, 50, 0.4, [0, -1, 1])), legR: at([70, 5, 12], [1, 0.2, 0.1]), legL: at([70, 5, -12], [1, 0.2, 0.1]) };
      return { keys: keys(base, { ...base, pitch: -96 }), cycle: 2.8, env: [{ type: 'roller', c: [-6, 10, 0] }], cam: 70 };
    }
    default:
      return { keys: keys(supine({ ...both(dir(40, 30, 0.6, [0, 1, 1])), legR: at([48, 6, 12], [1, 0.2, 0.1]), legL: at([48, 6, -12], [1, 0.2, 0.1]) })), cycle: 4, hold: true, cam: 70 };
  }
}

function groinSqueeze(): Anim {
  const base = supine({ ...both(dir(10, 22)), legR: at([48, 6, 12], [1, 0.2, 0.35]), legL: at([48, 6, -12], [1, 0.2, 0.35]) });
  const squeeze = { ...base, legR: at([48, 6, 9], [1, 0.2, 0]), legL: at([48, 6, -9], [1, 0.2, 0]) };
  return { keys: keys([base, 1], [squeeze, 1.6]), cycle: 3, cam: 45 };
}

export const PATTERNS = {
  // Приседания и ноги
  squat: squat('forward'),
  gobletSquat: squat('goblet', ['dumbbellChest']),
  kbGobletSquat: squat('goblet', ['kettlebellChest']),
  backSquat: squat('back', ['barbellBack']),
  pauseSquat: squat('back', ['barbellBack'], { slow: 2 }),
  frontSquat: squat('front', ['barbellFront']),
  hackSquat: squat('rack'),
  sumoSquat: squat('hang', ['dumbbellChest'], { wide: true }),
  wallSit: wallSit(),
  squatJump: jumpSquat(),
  tuckJump: jumpSquat(true),
  thruster: thruster(['dumbbells']),
  wallBall: throwBall('wallBall'),
  lunge: lunge('forward'),
  reverseLunge: lunge('reverse'),
  bulgarian: lunge('bulgarian'),
  jumpingLunge: lunge('jump'),
  lateralLunge: lateralLunge(),
  cossack: lateralLunge(true),
  stepUp: stepUp(),
  stepDown: stepUp(true),
  deadlift: hinge('deadlift'),
  sumoDeadlift: hinge('sumo'),
  rdl: hinge('rdl', ['dumbbells']),
  goodMorning: hinge('goodMorning'),
  singleLegRdl: singleLegRdl(),
  kbSwing: kbSwing(),
  hyperextension: hyperextension(),
  gluteBridge: gluteBridge(),
  hipThrust: gluteBridge(true),
  calfRaise: calfRaise('both'),
  singleCalfRaise: calfRaise('single'),
  machineCalfRaise: calfRaise('machine'),
  tibialisRaise: calfRaise('tibialis'),
  legPress: legPress(),
  singleLegPress: legPress(true),
  legExtension: legMachine('extension'),
  legCurl: legMachine('curl'),
  nordicCurl: nordic(),
  // Жимы
  pushUp: pushUp('normal'),
  closePushUp: pushUp('close'),
  pikePushUp: pushUp('pike'),
  shoulderTaps: pushUp('taps'),
  plank: pushUp('plank'),
  mountainClimber: pushUp('mountain'),
  bearCrawl: pushUp('bear'),
  benchPress: benchPress('barbell'),
  dbBenchPress: benchPress('dumbbells'),
  inclinePress: benchPress('incline'),
  dbFly: benchPress('fly'),
  skullCrusher: benchPress('skull'),
  pullover: benchPress('pullover'),
  benchDips: benchDips(),
  ohPress: ohPress(['barbell']),
  dbOhPress: ohPress(['dumbbells']),
  seatedDbPress: ohPress(['dumbbells'], { seated: true }),
  pushPress: ohPress(['barbell'], { push: true }),
  lateralRaise: raise('lateral'),
  frontRaise: raise('front'),
  uprightRow: raise('upright'),
  shrug: raise('shrug'),
  curl: raise('curl'),
  barbellCurl: raise('curlBar'),
  preacherCurl: raise('preacher'),
  tricepsExtension: raise('triceps'),
  tricepsPushdown: raise('pushdown'),
  cableCrossover: raise('crossover', ['handle']),
  // Тяги
  pullUp: pullUp('pull'),
  chinUp: pullUp('chin'),
  deadHang: pullUp('hang'),
  hangingKneeRaise: pullUp('knees'),
  invertedRow: invertedRow(),
  latPulldown: cablePull('lat'),
  bandPulldown: cablePull('bandLat'),
  straightArmPulldown: cablePull('straightArm'),
  cableRow: cablePull('row'),
  rower: cablePull('rower'),
  barbellRow: hinge('row'),
  tBarRow: hinge('tbar', ['landmine']),
  dbRow: dbRow(),
  rearDeltFly: hinge('rearFly'),
  bandPullApart: bandArms('pullApart'),
  facePull: bandArms('facePull'),
  externalRotation: bandArms('extRot'),
  internalRotation: bandArms('intRot'),
  pallofPress: bandArms('pallof'),
  woodchop: bandArms('woodchop'),
  shoulderDislocates: bandArms('dislocate'),
  punches: bandArms('punch'),
  bandSteering: bandArms('steering'),
  landmineRotation: landmine(),
  powerClean: olympic(false),
  hangSnatch: olympic(true),
  // Хват и реквизит
  farmersWalk: grip('farmer'),
  platePinch: grip('pinch'),
  wristRoller: grip('roller'),
  gripper: grip('gripper'),
  wristCurl: grip('wristCurl'),
  plateSteering: grip('steerPlate'),
  kbHalo: halo(),
  turkishGetUp: getUp(),
  medballSlam: throwBall('slam'),
  medballRotation: throwBall('rotational'),
  medballOverhead: throwBall('overhead'),
  // Кор
  sidePlank: floorCore('plankSide'),
  copenhagen: floorCore('copenhagen'),
  hollowHold: floorCore('hollow'),
  deadBug: floorCore('deadBug'),
  crunch: floorCore('crunch'),
  bicycleCrunch: floorCore('bicycle'),
  legRaise: floorCore('legRaise'),
  flutterKicks: floorCore('flutter'),
  russianTwist: floorCore('twist'),
  superman: floorCore('superman'),
  proneSwimmer: floorCore('swimmer'),
  birdDog: floorCore('birdDog'),
  gluteKickback: floorCore('kickback'),
  catCow: floorCore('catCow'),
  thoracicRotation: floorCore('thoracic'),
  childsPose: floorCore('childs'),
  clamshell: floorCore('clamshell'),
  hipMarch: floorCore('march'),
  yRaise: floorCore('yRaise'),
  ytw: floorCore('ytw'),
  // Кардио и прыжки
  run: run(),
  easyRun: run({ knee: 55, heel: 0.7, lean: 5, cycle: 0.85, arm: 60 }),
  sprint: run({ knee: 85, heel: 0.45, lean: 18, cycle: 0.6, arm: 85 }),
  highKnees: run({ knee: 105, heel: 0.6, lean: 0, cycle: 0.55, arm: 95 }),
  buttKicks: run({ knee: 10, heel: 0.3, lean: 2, cycle: 0.55, arm: 60 }),
  aSkip: mobility('aSkip'),
  walk: walk(),
  jumpingJacks: jumpingJacks(),
  jumpRope: jumpRope(),
  lateralShuffle: shuffle('lateral'),
  carioca: shuffle('carioca'),
  bandWalk: shuffle('bandWalk'),
  lateralHops: shuffle('hops'),
  quickFeet: shuffle('quickFeet'),
  boxJump: jump('box'),
  depthJump: jump('depth'),
  broadJump: jump('broad'),
  pogo: jump('pogo'),
  singleLegHop: jump('singleLeg'),
  skater: jump('skater'),
  splitStep: jump('splitStep'),
  burpee: burpee(),
  sprawl: burpee(true),
  bike: bike(),
  bikeSprint: bike(true),
  // Реакция и техника
  readyStance: ready('stance'),
  reactionStart: ready('start'),
  ballCatch: ready('catch'),
  phoneReaction: ready('phone'),
  juggling: skill('juggle'),
  footDribble: skill('footDribble'),
  basketDribble: skill('basket'),
  stickhandling: skill('stick'),
  // Мобильность и растяжка
  legSwings: mobility('legSwing'),
  armCircles: mobility('armCircles'),
  hipCircles: mobility('hipCircles'),
  neckMobility: mobility('neck'),
  worldsGreatest: mobility('worlds'),
  inchworm: mobility('inchworm'),
  ankleMobility: mobility('ankle'),
  streamline: mobility('streamline'),
  hipFlexorStretch: stretch('hipFlexor'),
  hamstringStretch: stretch('hamstring'),
  quadStretch: stretch('quad'),
  pigeon: stretch('pigeon'),
  chestStretch: stretch('chest'),
  calfStretch: stretch('calf'),
  neckStretch: stretch('neck'),
  neckIso: stretch('isoNeck'),
  lateralNeck: stretch('lateralNeck'),
  breathing: stretch('breathing'),
  groinSqueeze: groinSqueeze(),
  foamRoll: stretch('foamRoll'),
  thoracicRoller: stretch('roller'),
  stand: { keys: keys(stand()), cycle: 3, hold: true } as Anim,
} satisfies Record<string, Anim>;

export type PatternId = keyof typeof PATTERNS;
