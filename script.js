import {
  CFG, REL, clamp, dist, formatTime, socialRange, friendUpgradeChanceFloor, cocLabel
} from "./config.js";

import {
  RNG, Villager, Chronicle, isForbiddenPair, resetIds
} from "./villager.js";

// ---------- World ----------
class World {
  constructor(seed = 12345) {
    this.rng = new RNG(seed);
    this.chronicle = new Chronicle();
    this.villagers = [];
    this.selectedId = null;

    this.totalMin = 0;
    this.speedSteps = 0;
    this.gracePoints = 200;

    for (let i = 0; i < 12; i++) this.spawn();
    this.chronicle.add("World initialized.");
  }

  get minutesPerTick() {
    const t = CFG.SPEED_TABLE_MIN_PER_TICK;
    return t[Math.max(0, Math.min(t.length - 1, this.speedSteps))];
  }

  get socialRange() { return socialRange(this.minutesPerTick); }
  get upgradeFloor() { return friendUpgradeChanceFloor(this.minutesPerTick); }

  spawn(opts = {}) {
    const v = new Villager(this.rng, opts);
    this.villagers.push(v);
    this.chronicle.add(`Spawned ${v.name} (${v.sex}) age ${v.age}.`);
    return v;
  }

  getSelected() {
    return this.villagers.find(x => x.id === this.selectedId && x.alive) ?? null;
  }

  massMeal() {
    if (this.gracePoints < 20) return this.chronicle.add("Not enough grace points for Mass Meal.");
    this.gracePoints -= 20;
    for (const v of this.villagers) if (v.alive) v.hunger = Math.min(1, v.hunger + 0.25);
    this.chronicle.add("Mass Meal applied.");
  }

  singleHeal() {
    const v = this.getSelected();
    if (!v) return this.chronicle.add("No villager selected.");
    if (this.gracePoints < 10) return this.chronicle.add("Not enough grace points for Single Heal.");
    this.gracePoints -= 10;
    v.hp = Math.min(1, v.hp + 0.35);
    this.chronicle.add(`Single Heal on ${v.name}.`);
  }

  tick() {
    const dtMin = this.minutesPerTick;
    this.totalMin += dtMin;

    // 1) 生存
    for (const v of this.villagers) {
      if (!v.alive) continue;

      v.hunger = Math.max(0, v.hunger - CFG.hungerDrainPerMin * dtMin);
      if (v.hunger < 0.10) v.hp = Math.max(0, v.hp - 0.0009 * dtMin);

      if (v.hp <= 0) {
        v.alive = false;
        this.chronicle.add(`${v.name} died.`);
        for (const u of this.villagers) u.relations.delete(v.id);
      }
    }

    // 2) 行為切換 + 移動 + 吃
    for (const v of this.villagers) {
      if (!v.alive) continue;

      if (v.hunger <= CFG.hungerSeekAt) {
        v.mode = "seekFood";
        v.targetFood = this.findNearestFood(v.x, v.y);
      } else if (v.hunger >= CFG.hungerStopAt && v.mode === "seekFood") {
        v.mode = "wander";
        v.targetFood = null;
      }

      this.updateMovement(v, dtMin);

      if (v.mode === "seekFood" && v.targetFood) {
        if (dist(v.x, v.y, v.targetFood.x, v.targetFood.y) < 22) {
          v.hunger = Math.min(1, v.hunger + CFG.eatGain);
        }
      }
    }

    // 3) 社交
    this.updateSocial(dtMin);

    // 4) 懷孕/出生
    this.updatePregnancyAndBirth(dtMin);

    // 5) 年齡
    const yearsPerMin = 1 / (CFG.DAYS_PER_YEAR * CFG.MIN_PER_DAY);
    for (const v of this.villagers) if (v.alive) v.age += dtMin * yearsPerMin;
  }

  findNearestFood(x, y) {
    let best = null, bestD = Infinity;
    for (const n of CFG.foodNodes) {
      const d = dist(x, y, n.x, n.y);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  updateMovement(v, dtMin) {
    let tx = v.x, ty = v.y;

    if (v.mode === "seekFood" && v.targetFood) {
      tx = v.targetFood.x; ty = v.targetFood.y;
    } else {
      if (this.rng.chance(0.02)) {
        v.vx = this.rng.int(-80, 80) / 80;
        v.vy = this.rng.int(-80, 80) / 80;
      }
      tx = v.x + v.vx * 100;
      ty = v.y + v.vy * 100;
    }

    const dex = v.stats.DEX;
    const speed = clamp(16 + (dex - 10) * 1.1, 10, 28);
    const step = speed * (dtMin / 2);

    const dx = tx - v.x, dy = ty - v.y;
    const d = Math.hypot(dx, dy) || 1;
    v.x = clamp(v.x + (dx / d) * step, 20, CFG.W - 20);
    v.y = clamp(v.y + (dy / d) * step, 20, CFG.H - 20);
  }

  updateSocial(dtMin) {
    const alive = this.villagers.filter(v => v.alive);
    const range = this.socialRange;
    const nowMin = this.totalMin;

    for (let i = 0; i < alive.length; i++) {
      const a = alive[i];
      for (let j = i + 1; j < alive.length; j++) {
        const b = alive[j];
        if (isForbiddenPair(a, b)) continue;

        const d = dist(a.x, a.y, b.x, b.y);
        if (d > range) continue;

        const ra = a.getRelation(b.id);
        if (nowMin - ra.lastMeetMin < CFG.meetCooldownMin) continue;

        ra.lastMeetMin = nowMin;
        const rb = b.getRelation(a.id);
        rb.lastMeetMin = nowMin;

        const proximity = clamp(1 - d / range, 0, 1);
        const delta = 4 + proximity * 6;
        ra.score += delta;
        rb.score += delta;

        this.applyRelationshipFSM(a, b);
      }
    }
  }

  applyRelationshipFSM(a, b) {
    const ra = a.getRelation(b.id);
    const rb = b.getRelation(a.id);

    const setBoth = (state) => {
      a.setRelation(b.id, { state });
      b.setRelation(a.id, { state });
    };

    // mentor/student（不會鎖死）
    const ageGap = Math.abs(a.age - b.age);
    if ((ra.state === REL.STRANGER || ra.state === REL.FRIEND) && ageGap >= 12 && this.rng.chance(0.12)) {
      if (a.age > b.age) {
        a.setRelation(b.id, { state: REL.MENTOR });
        b.setRelation(a.id, { state: REL.STUDENT });
      } else {
        a.setRelation(b.id, { state: REL.STUDENT });
        b.setRelation(a.id, { state: REL.MENTOR });
      }
      this.chronicle.add(`${a.name} & ${b.name} became mentor/student.`);
      return;
    }

    if ((ra.state === REL.MENTOR && rb.state === REL.STUDENT) || (ra.state === REL.STUDENT && rb.state === REL.MENTOR)) {
      if (a.isAdult() && b.isAdult() && ra.score >= CFG.friendScoreThreshold) {
        setBoth(REL.FRIEND);
        this.chronicle.add(`${a.name} & ${b.name} shifted to friends (post mentorship).`);
      }
      return;
    }

    // stranger -> friend/lover
    if (ra.state === REL.STRANGER) {
      if (ra.score >= CFG.friendScoreThreshold) {
        if (a.isAdult() && b.isAdult() && ra.score >= CFG.loverScoreThreshold) {
          const p = this.baseLoverChance(a, b);
          if (this.rng.chance(p)) {
            setBoth(REL.LOVER);
            this.chronicle.add(`${a.name} & ${b.name} became lovers.`);
            return;
          }
        }
        setBoth(REL.FRIEND);
        return;
      }
    }

    // friend -> lover（重點：永遠保留升格，且有倍速底線）
    if (ra.state === REL.FRIEND && a.isAdult() && b.isAdult() && ra.score >= CFG.loverScoreThreshold) {
      const p = Math.max(this.upgradeFloor, this.baseUpgradeChance(a, b));
      if (this.rng.chance(p)) {
        setBoth(REL.LOVER);
        this.chronicle.add(`${a.name} & ${b.name} upgraded to lovers.`);
      }
    }
  }

  baseLoverChance(a, b) {
    const sameSex = a.sex === b.sex;
    let p = sameSex ? 0.20 : 0.70;

    const charmA = (a.stats.DEX + a.stats.CON) / 36;
    const charmB = (b.stats.DEX + b.stats.CON) / 36;
    p *= clamp(0.75 + 0.5 * ((charmA + charmB) / 2), 0.7, 1.15);

    return clamp(p, 0.05, 0.85);
  }

  baseUpgradeChance(a, b) {
    const score = a.getRelation(b.id).score;
    const s = clamp((score - CFG.loverScoreThreshold) / 60, 0, 1);
    return 0.004 + s * 0.026; // 0.4% ~ 3%
  }

  updatePregnancyAndBirth(dtMin) {
    const alive = this.villagers.filter(v => v.alive);

    // 1) 生產
    for (const f of alive) {
      if (f.sex !== "F" || !f.pregnant) continue;

      f.pregnancyDays += dtMin / CFG.MIN_PER_DAY;

      if (f.pregnancyDays >= f.pregnancyTermDays) {
        if (f.hunger >= CFG.birthHungerMin && f.hp > 0.2) {
          const dad = alive.find(v => v.id === f.partnerId) ?? null;
          const baby = this.makeBaby(f, dad);
          this.villagers.push(baby);
          this.chronicle.add(`${f.name} gave birth to ${baby.name} (${baby.sex}).`);
        } else {
          this.chronicle.add(`${f.name} could not safely deliver (insufficient resources).`);
        }
        f.pregnant = false;
        f.pregnancyDays = 0;
        f.pregnancyTermDays = 0;
        f.partnerId = null;
      }
    }

    // 2) 觸發懷孕（只要是 Lover 即可；不依賴「陌生→戀人」）
    for (const f of alive) {
      if (f.sex !== "F" || f.pregnant) continue;
      if (f.age < CFG.fertileAgeMin || f.age > CFG.fertileAgeMax) continue;
      if (f.hunger < CFG.birthHungerMin) continue;

      const lovers = [];
      for (const [oid, rel] of f.relations.entries()) {
        if (rel.state !== REL.LOVER) continue;
        const m = alive.find(v => v.id === oid);
        if (!m) continue;
        if (m.age < CFG.fertileAgeMin || m.age > CFG.fertileAgeMax) continue;
        if (m.hunger < CFG.birthHungerMin) continue;
        if (isForbiddenPair(f, m)) continue;
        lovers.push(m);
      }
      if (!lovers.length) continue;

      const pPerDay = 0.015;
      const p = 1 - Math.pow(1 - pPerDay, dtMin / CFG.MIN_PER_DAY);
      if (this.rng.chance(p)) {
        const partner = this.rng.pick(lovers);
        f.pregnant = true;
        f.pregnancyDays = 0;
        f.pregnancyTermDays = this.rng.int(CFG.pregnancyMinDays, CFG.pregnancyMaxDays);
        f.partnerId = partner.id;
        this.chronicle.add(`${f.name} is pregnant (partner ${partner.name}).`);
      }
    }
  }

  makeBaby(mom, dad) {
    const r = this.rng;
    const baby = new Villager(r, {
      age: 0,
      hunger: 0.95,
      x: mom.x + r.int(-10, 10),
      y: mom.y + r.int(-10, 10),
      motherId: mom.id,
      fatherId: dad?.id ?? null,
    });
    baby.name = `B${baby.id}`;

    const mutate = () => r.int(-2, 2);
    const inherit = (k) => {
      const ma = mom.stats[k];
      const da = dad ? dad.stats[k] : r.int(3, 18);
      return clamp(Math.round((ma + da) / 2) + mutate(), 3, 18);
    };
    baby.stats.STR = inherit("STR");
    baby.stats.CON = inherit("CON");
    baby.stats.SIZ = inherit("SIZ");
    baby.stats.DEX = inherit("DEX");

    // 親子關係：師生（同時 forbidden 會擋掉戀愛/繁衍）
    mom.setRelation(baby.id, { state: REL.MENTOR, score: 999, lastMeetMin: this.totalMin });
    baby.setRelation(mom.id, { state: REL.STUDENT, score: 999, lastMeetMin: this.totalMin });

    return baby;
  }
}

// ---------- UI / Render ----------
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const timePill = document.getElementById("timePill");
const popPill = document.getElementById("popPill");
const speedText = document.getElementById("speedText");
const villagerList = document.getElementById("villagerList");
const selectedCard = document.getElementById("selectedCard");
const logEl = document.getElementById("log");
const logCount = document.getElementById("logCount");

let world = new World(12345);

function renderUI() {
  const alive = world.villagers.filter(v => v.alive);
  const t = formatTime(world.totalMin);

  timePill.textContent = `Year ${t.year} • Day ${t.dayInYear}`;
  popPill.textContent = `Pop ${alive.length}`;
  speedText.textContent = `${world.minutesPerTick}m/tick`;

  villagerList.innerHTML = "";
  for (const v of alive.slice(0, 48)) {
    const chip = document.createElement("div");
    chip.className = "chip" + (v.id === world.selectedId ? " active" : "");
    chip.textContent = v.name;
    chip.onclick = () => world.selectedId = v.id;
    villagerList.appendChild(chip);
  }

  const sel = world.getSelected();
  if (!sel) {
    selectedCard.style.display = "none";
  } else {
    selectedCard.style.display = "block";
    const rels = [...sel.relations.entries()]
      .map(([oid, r]) => ({ oid, ...r }))
      .sort((a,b) => b.score - a.score)
      .slice(0, 8)
      .map(r => {
        const other = world.villagers.find(x => x.id === r.oid);
        const n = other?.name ?? `#${r.oid}`;
        return `${n}: ${r.state} (${r.score.toFixed(0)})`;
      });

    selectedCard.innerHTML = `
      <div class="row" style="align-items:flex-start;">
        <div>
          <div style="font-weight:800; font-size:16px;">${sel.name} <span class="muted">(${sel.sex})</span></div>
          <div class="muted">Age ${sel.age.toFixed(1)} • Hunger ${(sel.hunger*100).toFixed(0)}% • HP ${(sel.hp*100).toFixed(0)}%</div>
        </div>
        <div class="muted">Grace ${world.gracePoints}</div>
      </div>
      <div style="margin-top:8px;">
        <div class="muted">Stats</div>
        <div class="row"><div>STR ${sel.stats.STR} <span class="muted">(${cocLabel(sel.stats.STR)})</span></div><div>DEX ${sel.stats.DEX} <span class="muted">(${cocLabel(sel.stats.DEX)})</span></div></div>
        <div class="row"><div>CON ${sel.stats.CON} <span class="muted">(${cocLabel(sel.stats.CON)})</span></div><div>SIZ ${sel.stats.SIZ} <span class="muted">(${cocLabel(sel.stats.SIZ)})</span></div></div>
      </div>
      <div style="margin-top:10px;">
        <div class="muted">Top Relations</div>
        <div style="font-size:12px; line-height:1.6;">${rels.length ? rels.join("<br/>") : "<span class='muted'>None</span>"}</div>
      </div>
    `;
  }

  logEl.innerHTML = world.chronicle.items.map(x => `<div>${x.text}</div>`).join("");
  logCount.textContent = `${world.chronicle.items.length}`;
}

function renderWorld() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  for (const n of CFG.foodNodes) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, 14, 0, Math.PI*2);
    ctx.fillStyle = "#1f8a5b";
    ctx.fill();
    ctx.fillStyle = "#c7f9cc";
    ctx.font = "12px system-ui";
    ctx.fillText(n.type, n.x + 18, n.y + 4);
  }

  for (const v of world.villagers) {
    if (!v.alive) continue;
    const r = 7;

    ctx.beginPath();
    ctx.arc(v.x, v.y, r, 0, Math.PI*2);
    ctx.fillStyle = (v.id === world.selectedId) ? "#ffd166" : (v.sex === "F" ? "#9b5de5" : "#00bbf9");
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(v.x - 10, v.y - 16, 20, 3);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(v.x - 10, v.y - 16, 20 * clamp(v.hunger, 0, 1), 3);
  }
}

function loop() {
  world.tick();
  renderWorld();
  renderUI();
  requestAnimationFrame(loop);
}

// 點擊選取（擴大判定）
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);

  let best = null, bestD = Infinity;
  for (const v of world.villagers) {
    if (!v.alive) continue;
    const d = dist(mx, my, v.x, v.y);
    if (d < bestD && d <= 18) { best = v; bestD = d; }
  }
  if (best) world.selectedId = best.id;
});

// buttons
document.getElementById("spawnBtn").onclick = () => world.spawn();
document.getElementById("mealBtn").onclick = () => world.massMeal();
document.getElementById("healBtn").onclick = () => world.singleHeal();
document.getElementById("slowerBtn").onclick = () => { world.speedSteps = Math.max(0, world.speedSteps - 1); };
document.getElementById("fasterBtn").onclick = () => { world.speedSteps = Math.min(CFG.SPEED_TABLE_MIN_PER_TICK.length - 1, world.speedSteps + 1); };

document.getElementById("resetBtn").onclick = () => {
  const seed = parseInt(document.getElementById("seedInput").value || "12345", 10);
  resetIds();
  world = new World(Number.isFinite(seed) ? seed : 12345);
};

loop();
