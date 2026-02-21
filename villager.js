// villager.js
import { CONFIG } from './config.js';

export default class Villager {
    // gameCtx 是一個包含全域變數與方法的物件（如 villagers陣列、addNotice方法、addPoints方法）
    constructor(gameCtx, gen, gender, isBaby = false, x = null, y = null, fName = "無", mName = "無", fId = null, mId = null, startAge = 0) {
        this.game = gameCtx;
        this.id = Math.random().toString(36).substr(2, 9);
        this.gen = gen; 
        this.gender = gender; 
        this.serial = this.game.getSerial(gen, gender);
        this.name = `${this.gen}-${this.serial}`;
        
        this.x = x || this.game.canvas.width / 2 + (Math.random() - 0.5) * 200;
        this.y = y || this.game.canvas.height / 2 + (Math.random() - 0.5) * 200;
        this.father = fName; this.mother = mName;
        this.fatherId = fId; this.motherId = mId;
        
        this.birthTime = this.game.totalMinutes - (startAge * CONFIG.MINS_IN_YEAR);
        this.age = startAge;
        this.lastGrowthAge = Math.floor(startAge / 10) * 10;
        
        const p1 = this.game.villagers.find(v => v.id === fId);
        const p2 = this.game.villagers.find(v => v.id === mId);
        
        const rollStat = (p1Stat, p2Stat) => {
            if (!p1Stat || !p2Stat) return 3 + Math.floor(Math.random() * 16);
            let base = (p1Stat + p2Stat) / 2;
            let mutation = Math.floor(Math.random() * 5) - 2;
            return Math.max(3, Math.min(18, Math.floor(base + mutation)));
        };
        
        this.str = rollStat(p1?.str, p2?.str);
        this.con = rollStat(p1?.con, p2?.con);
        this.siz = rollStat(p1?.siz, p2?.siz);
        this.dex = rollStat(p1?.dex, p2?.dex);
        
        this.isHero = (this.str >= 16 || this.con >= 16 || this.siz >= 16 || this.dex >= 16);
        this.personality = (this.str + this.dex > 25) ? "積極" : (this.con < 10 ? "懶惰" : "普通");
        
        this.maxHp = Math.ceil((this.con + this.siz) / 2);
        this.hp = this.maxHp; 
        this.hunger = 80; 
        this.energy = 80;
        
        this.action = "漫步"; 
        this.angle = Math.random() * Math.PI * 2;
        this.mateCooldown = 0; 
        this.rels = {}; 
        this.lastPlague = 0; 
        this.isElder = false;
        this.plagueTimer = 0;
        
        if (fId) this.rels[fId] = { score: 100, type: '父親', name: fName };
        if (mId) this.rels[mId] = { score: 100, type: '母親', name: mName };
    }
    
    update() {
        if (this.hp <= 0) return;
        this.age = (this.game.totalMinutes - this.birthTime) / CONFIG.MINS_IN_YEAR;
        
        let currentDecade = Math.floor(this.age / 10) * 10;
        if (currentDecade > this.lastGrowthAge && this.age < 80) {
            this.lastGrowthAge = currentDecade;
            if (Math.random() < 0.3) this.evolveRandomStat(false);
        }
        
        this.hunger -= 0.008; this.energy -= 0.008;
        if (this.mateCooldown > 0) this.mateCooldown--;
        if (this.plagueTimer > 0) this.plagueTimer--;
        
        if (this.hp < this.maxHp && this.hunger > 50 && this.plagueTimer <= 0) {
            this.hp = Math.min(this.maxHp, this.hp + (this.con / 5000));
        }
        
        if (this.game.plagueZone && Math.hypot(this.x - this.game.plagueZone.x, this.y - this.game.plagueZone.y) < 100) {
            let now = Date.now();
            if (now - this.lastPlague > 1000) {
                this.hp -= this.maxHp * 0.15;
                this.lastPlague = now;
                this.plagueTimer = 600;
            }
        }
        
        this.socialCycle();
        
        if (this.energy < 15) {
            this.action = "睡眠"; this.energy += 0.08;
        } else if (this.hunger < 70 || (this.action === "進食" && this.hunger < 95)) {
            this.action = "進食"; this.move(0.75); this.findRes();
        } else {

            
    // 如果小人未滿 13 歲（幼年期）
if (this.age < 13) {
    
    // 【尋親邏輯】：優先找媽媽，媽媽如果不在（死亡），才找爸爸
    let p = this.game.villagers.find(v => v.id === this.motherId && v.hp > 0) || 
            this.game.villagers.find(v => v.id === this.fatherId && v.hp > 0);
    
    // 如果有找到父母其中一方
    if (p) {
        this.action = "跟隨"; 
        
        // 計算父母所在的角度，並朝著父母移動
        this.angle = Math.atan2(p.y - this.y, p.x - this.x); 
        this.move(0.45); // 移動速度較慢 (0.45)
        
        // 【餵哺機制】：如果距離父母夠近（小於 20 像素），飽食度會自動慢慢回升
        if (Math.hypot(this.x - p.x, this.y - p.y) < 20) {
            this.hunger = Math.min(100, this.hunger + 0.015);
        }
    } else {
        // 如果父母雙亡，變回孤兒漫無目的移動
        this.move(0.3);
    }
} else {
    // 滿 13 歲以上（成年/青少年），開始獨立探索
    this.action = "探索"; 
    this.move(this.personality === "積極" ? 0.6 : 0.4);
}
        }
        
        if (this.hunger <= 0) this.hp -= 0.04;
        if (this.age > 85) this.hp = 0;
        
        if (this.hp <= 0) {
            this.hp = 0; this.game.deathCount++;
            this.game.addNotice(`${this.isElder ? "長老" : "村民"} ${this.name} 離世。`, "notice-death");
            if (this.isElder) this.passElderTitle();
            this.game.syncUI();
        }
    }
    
    evolveRandomStat(isDivine = false) {
        const stats = ['str', 'con', 'siz', 'dex'];
        let s = stats[Math.floor(Math.random() * stats.length)];
        if (this[s] < 18) {
            this[s] += 1;
            if (s === 'con' || s === 'siz') this.maxHp = Math.ceil((this.con + this.siz) / 2);
            if (this[s] >= 16) this.isHero = true;
            const trans = { str: '力量', con: '體質', siz: '體型', dex: '敏捷' };
            if (isDivine) this.game.addNotice(`神蹟: ${this.name} 的 ${trans[s]} 提升!`, "notice-elder");
            else this.game.addNotice(`成長: ${this.name} 提升了 ${trans[s]}。`, "");
        }
    }
    
    passElderTitle() {
        this.isElder = false;
        let p = this.game.villagers.filter(v => v.hp > 0 && v.age >= 18 && !v.isElder);
        if (p.length > 0) {
            p.sort((a, b) => ((b.con * 2) + Object.keys(b.rels).length * 5) - ((a.con * 2) + Object.keys(a.rels).length * 5));
            p[0].isElder = true;
            this.game.addNotice(`繼承! ${p[0].name} 成為新長老。`, "notice-elder");
        }
    }
    
    socialCycle() {
        this.game.villagers.forEach(o => {
            if (o === this || o.hp <= 0) return;
            if (Math.hypot(this.x - o.x, this.y - o.y) < CONFIG.SOCIAL_RANGE) {
                if (!this.rels[o.id]) this.rels[o.id] = { score: 0, type: '陌生人', name: o.name };
                if (!o.rels[this.id]) o.rels[this.id] = { score: 0, type: '陌生人', name: this.name };
                let r = this.rels[o.id];
                r.score += 0.8; o.rels[this.id].score += 0.8;

                // 設定雙方的年齡都必須在 18 到 39 歲之間
                if (this.age >= 18 && this.age <= 39 && o.age >= 18 && o.age <= 39) {
                    if (r.type === '陌生人' || r.type === '朋友' || r.type === '師生') {
                        let chance = (r.type === '朋友') ? 0.2 : 0.85;
                        if (Math.random() < chance && r.score > 10) {
                            if (this.gender !== o.gender || Math.random() < 0.2) {
                                r.type = '戀人'; o.rels[this.id].type = '戀人';
                            }
                        }
                    }
                } else if (r.score > 10 && r.type === '陌生人') {
                    r.type = '朋友'; o.rels[this.id].type = '朋友';
                }
                
                if (this.age > 40 && o.age < 18 && !this.game.isDirectLineage(this, o)) {
                    r.type = '師生'; o.rels[this.id].type = '師生';
                }
                
                // 自然繁衍條件
                if (r.type === '戀人' && this.gender !== o.gender && this.mateCooldown <= 0 && o.mateCooldown <= 0 && this.hunger > 45) {
                    this.reproduce(o);
                }
            }
        });
    }
    
    reproduce(partner) {
        this.mateCooldown = 5000; partner.mateCooldown = 5000;
        let baby = new Villager(
            this.game, 
            Math.max(this.gen, partner.gen) + 1, 
            (Math.random() > 0.5 ? "男" : "女"), 
            true, this.x, this.y, 
            (this.gender === "男" ? this.name : partner.name), 
            (this.gender === "女" ? this.name : partner.name), 
            (this.gender === "男" ? this.id : partner.id), 
            (this.gender === "女" ? this.id : partner.id)
        );
        
        this.rels[baby.id] = { score: 100, type: '子女', name: baby.name };
        partner.rels[baby.id] = { score: 100, type: '子女', name: baby.name };
        this.game.villagers.push(baby);
        
        if (baby.isHero) {
            this.game.addNotice(`神蹟:神選之才 G${baby.gen}代 ${baby.name} 降臨部落!`, "notice-hero");
            this.game.addPoints(CONFIG.POINTS.BIRTH_HERO); // 英雄嬰兒 +20
        } else {
            this.game.addNotice(`誕生:G${baby.gen}代 ${baby.name} 加入部落。`, "notice-birth");
            this.game.addPoints(CONFIG.POINTS.BIRTH_NORMAL); // 普通嬰兒 +10
        }
        this.game.syncUI();
    }
    
    findRes() {
        let t = this.game.environment.find(e => e.type !== 'grass' && Math.abs(e.x - this.x) < 30 && Math.abs(e.y - this.y) < 30);
        if (t) this.hunger = Math.min(100, this.hunger + (this.str / 60));
    }
    
    move(spd) {
        if (Math.random() < 0.02) this.angle += (Math.random() - 0.5);
        this.x += Math.cos(this.angle) * spd;
        this.y += Math.sin(this.angle) * spd;
        if (this.x < 15 || this.x > this.game.canvas.width - 15) this.angle = Math.PI - this.angle;
        if (this.y < 50 || this.y > this.game.canvas.height - 115 - 15) this.angle = -this.angle;
    }
    
    draw(ctx, isSelected, isMatchTarget) {
        if (this.hp <= 0) return;
        
        let r = (this.age < 18) ? 6 : (10 + this.siz / 2.5);
        
        if (this.isHero) {
            let pulse = Math.sin(Date.now() / 200) * 2;
            ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
            ctx.beginPath(); ctx.arc(this.x, this.y, r + 8 + pulse, 0, Math.PI * 2); ctx.fill();
        }
        
        if (this.isElder) {
            ctx.strokeStyle = "#daa520"; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
            ctx.beginPath(); ctx.arc(this.x, this.y, r + 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
        
        // 畫出選取光環
        if (isSelected) {
            ctx.strokeStyle = "#0f0"; ctx.lineWidth = 3; 
            ctx.beginPath(); ctx.arc(this.x, this.y, r + 6, 0, Math.PI * 2); ctx.stroke();
        }
        
        // 畫出紅線預選光環
        if (isMatchTarget) {
            ctx.strokeStyle = "#ff69b4"; ctx.lineWidth = 3; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.arc(this.x, this.y, r + 9, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
        
        ctx.fillStyle = (this.plagueTimer > 0) ? "#4a148c" : ((this.action === "睡眠") ? "#666" : (this.gender === "男" ? "#3498db" : "#e84393"));
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "white"; ctx.font = "10px Arial";
        ctx.fillText((this.isElder ? "👑 " : "") + this.name, this.x - 10, this.y - r - 5);
    }
}
