/* villager.js - V10.2 村民行為邏輯 */
class Villager {
    constructor(cvs, gen, gender, isBaby, x, y, fName, mName, fId, mId, startAge = 0) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.gen = gen; this.gender = gender;
        this.serial = this.getSerial(gen, gender);
        this.name = `${this.gen}-${this.serial}`;
        this.x = x || cvs.width/2 + (Math.random()-0.5)*200;
        this.y = y || cvs.height/2 + (Math.random()-0.5)*200;
        this.father = fName; this.mother = mName; this.fatherId = fId; this.motherId = mId;
        
        // 修正 NaN 歲問題：確保 startAge 參與運算前是數字
        const validAge = Number(startAge) || 0;
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
        this.hp = this.maxHp; this.hunger = 80; this.energy = 80;
        this.action = "漫步"; this.angle = Math.random()*Math.PI*2;
        this.mateCooldown = isBaby ? 0 : 2100; // 始祖冷卻
        this.rels = {}; this.isElder = false; this.plagueTimer = 0;
    }

    getSerial(gen, gender) {
        if (!genCounters[gen]) genCounters[gen] = { m: 1, f: 2 };
        let s = (gender === "男") ? genCounters[gen].m : genCounters[gen].f;
        if (gender === "男") genCounters[gen].m += 2; else genCounters[gen].f += 2;
        return s.toString().padStart(2, '0');
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

    update() {
        if(this.hp <= 0) return;
        this.age = (totalMinutes - this.birthTime) / CONFIG.MINS_IN_YEAR;
        if (!this.isAdultAwarded && this.age >= 13) { this.isAdultAwarded = true; updateGrace(20, `${this.name} 成年`); }
        if (this.mateCooldown > 0) this.mateCooldown--;
        if (this.plagueTimer > 0) this.plagueTimer--;
        this.socialCycle();
        this.x += Math.cos(this.angle)*0.5; this.y += Math.sin(this.angle)*0.5;
        if(this.x < 15 || this.x > window.cvsGlobal.width-15) this.angle = Math.PI - this.angle;
        if(this.y < 50 || this.y > window.cvsGlobal.height - CONFIG.FOOTER_HEIGHT - 15) this.angle = -this.angle;
        if(this.age > 85) { this.hp = 0; deathCount++; addNotice(`${this.name} 老死`, "notice-death"); syncBottomBar(); }
    }

    socialCycle() {
        villagers.forEach(o => {
            if(o === this || o.hp <= 0) return;
            if(Math.hypot(this.x-o.x, this.y-o.y) < CONFIG.SOCIAL_RANGE) {
                if(!this.rels[o.id]) this.rels[o.id] = { score: 0, type: '朋友', name: o.name };
                this.rels[o.id].score += 0.5;
                if(this.age >= 18 && o.age >= 18 && this.rels[o.id].type === '朋友' && Math.random() < 0.001) {
                    this.rels[o.id].type = '戀人'; o.rels[this.id].type = '戀人';
                }
                if(this.rels[o.id].type === '戀人' && this.gender !== o.gender && this.mateCooldown <= 0) this.reproduce(o);
            }
        });
    }

    reproduce(o) {
        this.mateCooldown = 5000; o.mateCooldown = 5000;
        // 核心修正：傳入年齡 0 並正確標註社交類別
        let baby = new Villager(window.cvsGlobal, Math.max(this.gen, o.gen)+1, (Math.random()>0.5?"男":"女"), true, this.x, this.y, this.name, o.name, this.id, o.id, 0);
        this.rels[baby.id] = { score: 100, type: '子女', name: baby.name };
        o.rels[baby.id] = { score: 100, type: '子女', name: baby.name };
        baby.rels[this.id] = { score: 100, type: '家族', name: this.name };
        baby.rels[o.id] = { score: 100, type: '家族', name: o.name };
        villagers.push(baby); 
        addNotice(`👶 誕生：G${baby.gen}代 ${baby.name}`, "notice-birth");
        updateGrace(baby.isHero ? 150 : 10);
        syncBottomBar();
    }

    evolveRandomStat(isDivine = false) {
        const stats = ['str', 'con', 'siz', 'dex'];
        let s = stats[Math.floor(Math.random() * stats.length)];
        this[s] = Math.min(18, this[s] + 1);
        this.updatePersonality(); this.checkHero();
    }

    draw(ctx) {
        if(this.hp <= 0) return;
        let r = (this.age < 18) ? 6 : (10 + this.siz/2.5);
        if(this.isHero) {
            let pulse = Math.sin(Date.now() / 300) * 4;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y, r + 10 + pulse, 0, Math.PI * 2); ctx.stroke();
        }
        if(this.isElder) { ctx.strokeStyle = "#daa520"; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.arc(this.x, this.y, r + 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        if(selectedId === this.id) { ctx.strokeStyle="#0f0"; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(this.x,this.y,r+6,0,Math.PI*2); ctx.stroke(); }
        ctx.fillStyle = (this.plagueTimer > 0) ? "#4a148c" : (this.gender === "男" ? "#3498db" : "#e84393");
        ctx.beginPath(); ctx.arc(this.x,this.y,r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "white"; ctx.font = "10px Arial"; ctx.fillText(this.name, this.x-10, this.y-r-5);
    }
}
