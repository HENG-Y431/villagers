/* villager.js - 村民靈魂：負責遺傳、社交、生命力與死亡判定 */
class Villager {
    constructor(cvs, gen, gender, isBaby, x, y, fName, mName, fId, mId, startAge = 0) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.gen = gen; this.gender = gender;
        this.serial = this.getSerial(gen, gender);
        this.name = `${this.gen}-${this.serial}`;
        this.x = x || cvs.width/2 + (Math.random()-0.5)*200;
        this.y = y || cvs.height/2 + (Math.random()-0.5)*200;
        this.father = fName || "無"; this.mother = mName || "無";
        this.fatherId = fId; this.motherId = mId;
        
        // 修正：強制轉為數字，解決 NaN 問題
        const validAge = Number(startAge);
        this.birthTime = totalMinutes - (validAge * CONFIG.MINS_IN_YEAR);
        this.age = validAge;
        this.lastGrowthAge = Math.floor(this.age / 10) * 10;
        this.isAdultAwarded = (this.age >= 13);

        const p1 = villagers.find(v => v.id === fId), p2 = villagers.find(v => v.id === mId);
        const roll = (s1, s2) => {
            if (!s1 || !s2) return 3 + Math.floor(Math.random() * 16);
            return Math.max(3, Math.min(18, Math.floor((s1+s2)/2 + (Math.random()*5-2))));
        };
        this.str = roll(p1?.str, p2?.str); this.con = roll(p1?.con, p2?.con);
        this.siz = roll(p1?.siz, p2?.siz); this.dex = roll(p1?.dex, p2?.dex);
        this.isHero = (this.str+this.con+this.siz+this.dex >= 58 || [this.str,this.con,this.siz,this.dex].filter(s=>s>=17).length >= 2);

        this.updatePersonality(); 
        this.maxHp = Math.ceil((this.con + this.siz) / 2);
        this.hp = this.maxHp; this.hunger = 80; this.rels = {}; 
        this.mateCooldown = isBaby ? 0 : 2100; 
        this.isElder = (gen === 1); // 始祖預設為長老
        this.plagueTimer = 0; this.angle = Math.random()*Math.PI*2;
    }

    getSerial(gen, gender) {
        if (!genCounters[gen]) genCounters[gen] = { m: 1, f: 2 };
        let s = (gender === "男") ? genCounters[gen].m : genCounters[gen].f;
        if (gender === "男") genCounters[gen].m += 2; else genCounters[gen].f += 2;
        return s.toString().padStart(2, '0');
    }

    updatePersonality() {
        if (this.str + this.dex > 25) this.personality = "積極";
        else if (this.con < 10) this.personality = "懶惰";
        else this.personality = "普通";
    }

    update() {
        if(this.hp <= 0) return;
        this.age = (totalMinutes - this.birthTime) / CONFIG.MINS_IN_YEAR;
        if (!this.isAdultAwarded && this.age >= 13) { this.isAdultAwarded = true; updateGrace(20); }
        
        // 修正：飽食度與瘟疫
        this.hunger -= 0.012; 
        if(this.plagueTimer > 0) this.plagueTimer--;
        
        // --- 修正：補回瘟疫區判定 ---
        if(plagueZone && Math.hypot(this.x-plagueZone.x, this.y-plagueZone.y) < 120) {
            this.hp -= 0.12; this.plagueTimer = 400;
        }

        if(this.hunger < 70) { this.move(0.8); this.findRes(); } else { this.move(0.5); }
        if(this.mateCooldown > 0) this.mateCooldown--;
        this.socialCycle();
        
        if(this.hunger <= 0) this.hp -= 0.05;
        if(this.age > 85 || this.hp <= 0) { 
            this.hp = 0; deathCount++; addNotice(`☠️ ${this.name} 離世`, "notice-death"); syncBottomBar(); 
        }
    }

    socialCycle() {
        villagers.forEach(o => {
            if(o === this || o.hp <= 0) return;
            if(Math.hypot(this.x-o.x, this.y-o.y) < CONFIG.SOCIAL_RANGE) {
                if(!this.rels[o.id]) this.rels[o.id] = { score: 0, type: '朋友', name: o.name };
                if(this.age >= 18 && o.age >= 18 && Math.random() < 0.001) { this.rels[o.id].type = '戀人'; o.rels[this.id].type = '戀人'; }
                if(this.rels[o.id].type === '戀人' && this.gender !== o.gender && this.mateCooldown <= 0) this.reproduce(o);
            }
        });
    }

    reproduce(o) {
        this.mateCooldown = 5000; o.mateCooldown = 5000;
        // 修正：補回參數 0，徹底解決 NaN 歲
        let baby = new Villager(window.cvsGlobal, Math.max(this.gen, o.gen)+1, (Math.random()>0.5?"男":"女"), true, this.x, this.y, this.name, o.name, this.id, o.id, 0);
        this.rels[baby.id] = { score: 100, type: '家族', name: baby.name };
        o.rels[baby.id] = { score: 100, type: '家族', name: baby.name };
        baby.rels[this.id] = { score: 100, type: '家族', name: this.name };
        baby.rels[o.id] = { score: 100, type: '家族', name: o.name };
        villagers.push(baby); 
        addNotice(`👶 誕生：G${baby.gen}代 ${baby.name}`, "notice-birth");
        updateGrace(baby.isHero ? 150 : 10);
        syncBottomBar();
    }

    findRes() {
        let t = environment.find(e => e.type !== 'grass' && Math.abs(e.x-this.x)<40 && Math.abs(e.y-this.y)<40);
        if(t) this.hunger = Math.min(100, this.hunger + (this.str/35));
    }

    move(spd) {
        this.x += Math.cos(this.angle)*spd; this.y += Math.sin(this.angle)*spd;
        if(this.x < 15 || this.x > window.cvsGlobal.width-15) this.angle = Math.PI - this.angle;
        if(this.y < 50 || this.y > window.cvsGlobal.height - CONFIG.FOOTER_HEIGHT - 15) this.angle = -this.angle;
    }

    draw(ctx) {
        if(this.hp <= 0) return;
        let r = (this.age < 18) ? 6 : (10 + this.siz/2.5);
        if(this.isHero) { ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y, r + 10, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = (this.plagueTimer > 0) ? "#4a148c" : (this.gender === "男" ? "#3498db" : "#e84393");
        ctx.beginPath(); ctx.arc(this.x,this.y,r,0,Math.PI*2); ctx.fill();
        if(selectedId === this.id) { ctx.strokeStyle="#0f0"; ctx.lineWidth=3; ctx.stroke(); }
        ctx.fillStyle = "white"; ctx.font = "10px Arial"; ctx.fillText(this.name, this.x-10, this.y-r-5);
    }
}
