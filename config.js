export const REL = Object.freeze({
  STRANGER: "Stranger",
  FRIEND: "Friend",
  LOVER: "Lover",
  MENTOR: "Mentor",
  STUDENT: "Student",
});

export const CFG = Object.freeze({
  W: 1200, H: 800,

  MIN_PER_DAY: 24 * 60,
  DAYS_PER_YEAR: 360,

  // 倍速檔位（每 tick 增加多少「世界分鐘」）
  SPEED_TABLE_MIN_PER_TICK: [2, 5, 10, 20, 40, 80, 120, 200],

  hungerDrainPerMin: 0.00055,
  eatGain: 0.20,
  hungerSeekAt: 0.70,
  hungerStopAt: 0.95,

  baseSocialRange: 110,
  meetCooldownMin: 60,

  friendScoreThreshold: 20,
  loverScoreThreshold: 35,

  // Friend->Lover 互動觸發的最低保護機率
  minUpgradeChance: 0.008,

  fertileAgeMin: 18,
  fertileAgeMax: 45,
  pregnancyMinDays: 90,
  pregnancyMaxDays: 140,
  birthHungerMin: 0.45,

  foodNodes: [
    { x: 200, y: 180, type: "Forest" },
    { x: 980, y: 240, type: "Lake" },
    { x: 660, y: 640, type: "Wild" },
  ],
});

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function dist(x1, y1, x2, y2) { return Math.hypot(x1 - x2, y1 - y2); }

export function formatTime(totalMin) {
  const day = Math.floor(totalMin / CFG.MIN_PER_DAY);
  const year = Math.floor(day / CFG.DAYS_PER_YEAR);
  const dayInYear = day % CFG.DAYS_PER_YEAR;
  return { year, dayInYear };
}

// 倍速越高：社交距離底線拉高（避免擦身而過）
export function socialRange(minutesPerTick) {
  const mult = Math.max(1, minutesPerTick / 2);
  return Math.max(CFG.baseSocialRange, CFG.baseSocialRange + 18 * Math.log2(mult));
}

// 倍速越高：Friend->Lover 升格底線拉高（避免世代鎖死）
export function friendUpgradeChanceFloor(minutesPerTick) {
  const mult = Math.max(1, minutesPerTick / 2);
  return Math.min(0.06, CFG.minUpgradeChance * Math.sqrt(mult));
}

export function cocLabel(v) {
  if (v <= 5) return "極低";
  if (v <= 8) return "低";
  if (v <= 12) return "一般";
  if (v <= 15) return "高";
  return "極高";
}
