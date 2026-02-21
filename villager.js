import { CFG, REL, clamp } from "./config.js";

export class RNG {
  constructor(seed = 12345) { this.seed = seed >>> 0; }
  next() {
    let x = this.seed;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    this.seed = x;
    return (x >>> 0) / 4294967296;
  }
  int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
  chance(p) { return this.next() < p; }
}

export function isForbiddenPair(a, b) {
  if (!a || !b) return true;
  if (a.id === b.id) return true;
  if (a.motherId && a.motherId === b.id) return true;
  if (a.fatherId && a.fatherId === b.id) return true;
  if (b.motherId && b.motherId === a.id) return true;
  if (b.fatherId && b.fatherId === a.id) return true;
  if (a.motherId && b.motherId && a.motherId === b.motherId) return true;
  if (a.fatherId && b.fatherId && a.fatherId === b.fatherId) return true;
  return false;
}

let NEXT_ID = 1;
export function resetIds() { NEXT_ID = 1; }

export class Villager {
  constructor(rng, opts = {}) {
    this.id = NEXT_ID++;
    this.name = opts.name ?? `V${this.id}`;
    this.sex = opts.sex ?? (rng.chance(0.5) ? "F" : "M");

    this.x = opts.x ?? rng.int(80, CFG.W - 80);
    this.y = opts.y ?? rng.int(80, CFG.H - 80);
    this.vx = 0; this.vy = 0;

    this.alive = true;
    this.hunger = opts.hunger ?? (rng.next() * 0.4 + 0.6);
    this.hp = 1.0;
    this.age = opts.age ?? rng.int(16, 30);

    this.stats = {
      STR: opts.STR ?? rng.int(3, 18),
      CON: opts.CON ?? rng.int(3, 18),
      SIZ: opts.SIZ ?? rng.int(3, 18),
      DEX: opts.DEX ?? rng.int(3, 18),
    };

    this.motherId = opts.motherId ?? null;
    this.fatherId = opts.fatherId ?? null;

    this.relations = new Map(); // otherId -> { state, score, lastMeetMin }

    this.mode = "wander";
    this.targetFood = null;

    this.pregnant = false;
    this.pregnancyDays = 0;
    this.pregnancyTermDays = 0;
    this.partnerId = null;
  }

  isAdult() { return this.age >= CFG.fertileAgeMin; }

  getRelation(otherId) {
    if (!this.relations.has(otherId)) {
      this.relations.set(otherId, { state: REL.STRANGER, score: 0, lastMeetMin: -1e9 });
    }
    return this.relations.get(otherId);
  }

  setRelation(otherId, patch) {
    const r = this.getRelation(otherId);
    Object.assign(r, patch);
  }
}

export class Chronicle {
  constructor(limit = 300) { this.limit = limit; this.items = []; }
  add(text) {
    this.items.unshift({ t: Date.now(), text });
    if (this.items.length > this.limit) this.items.pop();
  }
}
