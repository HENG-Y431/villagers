/* villager.js - V9.8 修正生命常數與遺傳 */
class Villager {
    constructor(cvs, gen, gender, isBaby, x, y, fName, mName, fId, mId, startAge) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.gen = gen; this.gender = gender;
        this.serial = this.getSerial(gen, gender);
        this.name = `${this.gen}-${this.serial}`;
        this.x = x || cvs.width/2 + (Math.random()-0.5)*200;
        this.y = y || cvs.height/2 + (Math.random()-0.5)*200;
        this.father = fName; this.mother = mName; this.fatherId = fId; this.motherId = mId;
        
        // 核心修復：確保 birthTime 永遠是數字
        const validAge = (startAge !== undefined) ? startAge : 0;
        this.birthTime = totalMinutes - (validAge * CONFIG.MINS_IN_YEAR);
        
        this.age = validAge;
        this.lastGrowthAge = Math.floor(validAge / 10) * 10;
        this.isAdultAwarded = (validAge >= 13);

        const p1 = villagers.find(v => v.id === fId), p2 = villagers.find(v => v.id === mId);
        const roll = (s1, s2) => {
            if (!s1 || !s2) return 3 + Math.floor(Math.random() * 16);
            return Math.max(3, Math.min(18, Math.floor((s1+s2)/2 + (Math.random()*5-2))));
        };
        this.str = roll(p1?.str, p2?.str); this.con = roll(p1?.con, p2?.con);
        this.siz = roll(p1?.siz, p2?.siz); this.dex = roll(p1?.dex, p2?.dex);

        this.isHero = false; this.checkHero();
        this.updatePersonality();

        this.maxHp = Math.ceil((this.con + this.siz) / 2);
        this.hp = this.maxHp; this.hunger = 80; this.rels = {}; 
        this.isElder = false; this.plagueTimer = 0;
        this.angle = Math.random()*Math.PI*2;
        this.mateCooldown = isBaby ? 0 : 2100; 
    }

    checkHero() {
        let total = this.str + this.con + this.siz + this.dex;
        let peaks = [this.str, this.con, this.siz, this.dex].filter(s => s >= CONFIG.HERO_PEAK_MIN).length;
        if (total >= CONFIG.HERO_TOTAL_MIN || peaks >= CONFIG.HERO_PEAK_COUNT) { this.isHero = true; return true; }
        return false;
    }

    updatePersonality() {
        if (this.str + this.dex > 25) this.personality = "積極";
        else if (this.con < 10) this.personality = "懶惰";
        else this.personality = "普通";
    }

    getSerial(gen, gender) {
        if (!genCounters[gen]) genCounters[gen] = { m: 1, f: 2 };
        let s = (gender === "男") ? genCounters[gen].m : genCounters[gen].f;
        if (gender === "男") genCounters[gen].m += 2; else genCounters[gen].f += 2;
        return s.toString().padStart(2, '0');
    }

    update() {
        if(this.hp <= 0) return;
        this.age = (totalMinutes - this.birthTime) / CONFIG.MINS_IN_YEAR;
        if (!this.isAdultAwarded && this.age >= 13) { this.isAdultAwarded = true; updateGrace(20, `${this.name} 成年`); }
        
        let currentDecade = Math.floor(this.age / 10) * 10;
        if (currentDecade > this.lastGrowthAge && this.age < 80) {
            this.lastGrowthAge = currentDecade;
            if (Math.random() < 0.3) this.evolveRandomStat(false);
        }

        this.hunger -= 0.008; 
        if(this.mateCooldown > 0) this.mateCooldown--;
        if(this.plagueTimer > 0) this.plagueTimer--;
        if(this.hp < this.maxHp && this.hunger > 50 && this.plagueTimer <= 0) this.hp = Math.min(this.maxHp, this.hp + (this.con / 5000));
        this.socialCycle();

        if(this.hunger < 70) { this.move(0.75); this.findRes(); }
        else {
            if(this.age < 13) {
                let p = villagers.find(v => v.id === this.motherId && v.hp > 0) || villagers.find(v => v.id === this.fatherId && v.hp > 0);
                if(p) {
                    this.angle = Math.atan2(p.y - this.y, p.x - this.x); this.move(0.45);
                    if(Math.hypot(this.x - p.x, this.y - p.y) < 20) this.hunger = Math.min(100, this.hunger + 0.015);
                } else this.move(0.3);
            } else { this.move(this.personality === "積極" ? 0.6 : 0.4); }
        }
        if(this.hunger <= 0) this.hp -= 0.04;
        if(this.age > 85 || this.hp <= 0) {
            this.hp = 0; deathCount++;
            if (this.age >= 80) updateGrace(100, "壽終正寢");
            addNotice(`☠️ ${this.isElder?"長老 ":"村民 "}${this.name} 離世。`, "notice-death");
            if(this.isElder) this.passElderTitle(); syncBottomBar();
        }
    }

    socialCycle() {
        villagers.forEach(o => {
            if(o === this || o.hp <= 0) return;
            if(Math.hypot(this.x-o.x, this.y-o.y) < CONFIG.SOCIAL_RANGE) {
                if(!this.rels[o.id]) this.rels[o.id] = { score: 0, type: '陌生人', name: o.name };
                if(!o.rels[this.id]) o.rels[this.id] = { score: 0, type: '陌生人', name: this.name };
                let r = this.rels[o.id]; r.score += 0.8; 
                if(this.age >= 18 && o.age >= 18) {
                    if(r.type === '陌生人' || r.type === '朋友' || r.type === '師生') {
                        let chance = (r.type === '朋友') ? 0.01 : 0.85; 
                        if (Math.random() < chance && r.score > 10) {
                            if(this.gender !== o.gender) { r.type = '戀人'; o.rels[this.id].type = '戀人'; }
                            else if(Math.random() < 0.2) { r.type = '戀人'; o.rels[this.id].type = '戀人'; }
                        }
                    }
                } else if(r.score > 10 && r.type === '陌生人') { r.type = '朋友'; o.rels[this.id].type = '朋友'; }
                if(this.age > 40 && o.age < 18 && !isDirectLineage(this, o)) { r.type = '師生'; o.rels[this.id].type = '師生'; }
                if(r.type === '戀人' && this.gender !== o.gender && this.mateCooldown <= 0 && this.hunger > 45) this.reproduce(o);
            }
        });
    }

    // --- 核心修正：加入參數 0，徹底解決 NaN 歲問題 ---
    reproduce(o) {
        this.mateCooldown = 5000; o.mateCooldown = 5000;
        let baby = new Villager(window.cvsGlobal, Math.max(this.gen, o.gen)+1, (Math.random()>0.5?"男":"女"), true, this.x, this.y, (this.gender==="男"?this.name:o.name), (this.gender==="女"?this.name:o.name), (this.gender==="男"?this.id:o.id), (this.gender==="女"?this.id:o.id), 0);
        this.rels[baby.id] = { score: 100, type: '子女', name: baby.name }; o.rels[baby.id] = { score: 100, type: '子女', name: baby.name };
        villagers.push(baby); 
        if (baby.isHero) { addNotice(`🌟 神蹟：傳奇人物 ${baby.name} 誕生！`, "notice-hero"); updateGrace(150, "天選誕生"); }
        else { addNotice(`👶 誕生：G${baby.gen}代 ${baby.name} 出生。`, "notice-birth"); updateGrace(10, "新命降臨"); }
        syncBottomBar();
    }

    evolveRandomStat(isDivine = false) {
        const stats = ['str', 'con', 'siz', 'dex'];
        let s = stats[Math.floor(Math.random() * stats.length)];
        if (this[s] < 18) {
            this[s] += 1;
            if (s === 'con' || s === 'siz') this.maxHp = Math.ceil((this.con + this.siz) / 2);
            this.updatePersonality();
            if (this.checkHero()) { updateGrace(50, "覺醒神選"); addNotice(`🌟 覺醒：${this.name} 突破極限成就神選！`, "notice-hero"); }
            const trans = { str:'力量', con:'體質', siz:'體型', dex:'敏捷' };
            if (isDivine) addNotice(`✨ 神蹟：${this.name} 的 ${trans[s]} 提升！`, "notice-elder");
            else addNotice(`📈 成長：${this.name} 提升了 ${trans[s]}。`, "");
        }
    }

    passElderTitle() {
        this.isElder = false;
        let p = villagers.filter(v => v.hp > 0 && v.age >= 18 && !v.isElder);
        if(p.length > 0) {
            p.sort((a,b) => ((b.con*2)+Object.keys(b.rels).length*5) - ((a.con*2)+Object.keys(a.rels).length*5));
            p[0].isElder = true; addNotice(`👑 繼承！${p[0].name} 成為新長老。`, "notice-elder");
        }
    }

    findRes() {
        let t = environment.find(e => e.type !== 'grass' && Math.abs(e.x-this.x)<30 && Math.abs(e.y-this.y)<30);
        if(t) this.hunger = Math.min(100, this.hunger + (this.str/60));
    }

    move(spd) {
        this.x += Math.cos(this.angle)*spd; this.y += Math.sin(this.angle)*spd;
        if(Math.random()<0.02) this.angle += (Math.random()-0.5);
        if(this.x < 15 || this.x > window.cvsGlobal.width-15) this.angle = Math.PI - this.angle;
        if(this.y < 50 || this.y > window.cvsGlobal.height - CONFIG.FOOTER_HEIGHT - 15) this.angle = -this.angle;
    }

    draw(ctx) {
        if(this.hp <= 0) return;
        let r = (this.age < 18) ? 6 : (10 + this.siz/2.5);
        if(this.isHero) {
            let p = Math.sin(Date.now() / 300) * 4;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y, r + 10 + p, 0, Math.PI * 2); ctx.stroke();
        }
        if(this.isElder) { ctx.strokeStyle = "#daa520"; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.arc(this.x, this.y, r + 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        if(selectedId === this.id) { ctx.strokeStyle="#0f0"; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(this.x,this.y,r+6,0,Math.PI*2); ctx.stroke(); }
        ctx.fillStyle = (this.plagueTimer > 0) ? "#4a148c" : (this.gender === "男" ? "#3498db" : "#e84393");
        ctx.beginPath(); ctx.arc(this.x,this.y,r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "white"; ctx.font = "10px Arial"; ctx.fillText((this.isHero?"✨":"")+(this.isElder?"👑":"")+this.name, this.x-10, this.y-r-5);
    }
}
