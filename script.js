/* script.js - V8.7 系統大融合與神聖均衡版 */
// ==========================================
// 1. 全域變數與參數配置
// ==========================================
let villagers = [], environment = [], selectedId = null, matchId = null, totalMinutes = 0, genCounters = {};
let deathCount = 0, currentTab = 'All', plagueZone = null, gracePoints = 500; 

const TILE_SIZE = 45;
const SOCIAL_RANGE = 130;      // 廣域社交
const MINS_IN_YEAR = 60 * 24 * 30 * 12;
const GAME_SPEED = 250;        // 超頻 250 倍速

// ==========================================
// 2. 系統核心函數 (鑑定、公告、神恩)
// ==========================================
function getCoC6Label(val) {
    if (val <= 5) return { txt: "嚴重缺陷", cls: "rank-poor" };
    if (val <= 7) return { txt: "非常不良", cls: "rank-poor" };
    if (val <= 9) return { txt: "稍弱", cls: "" };
    if (val <= 11) return { txt: "正常人", cls: "" };
    if (val <= 13) return { txt: "比一般人優秀", cls: "rank-good" };
    if (val <= 15) return { txt: "非常超群", cls: "rank-good" };
    return { txt: "稀有", cls: "rank-rare" };
}

function updateGrace(amount, reason = "") {
    gracePoints += amount;
    const graceDisplay = document.getElementById('grace-points');
    if(graceDisplay) graceDisplay.innerText = Math.floor(gracePoints);
    if (amount > 0 && reason) addNotice(`✨ 獲得神恩：${reason} (+${amount})`, "notice-elder");
}

function addNotice(msg, typeClass = "") {
    const noticeBoard = document.getElementById('notice-board');
    if (!noticeBoard) return;
    let yrs = Math.floor(totalMinutes/MINS_IN_YEAR)+1, mths = Math.floor((totalMinutes/(60*24*30))%12)+1;
    let div = document.createElement('div');
    div.innerHTML = `<span class="notice-time">${yrs}年${mths}月</span> <span class="${typeClass}">${msg}</span>`;
    noticeBoard.prepend(div);
    if (noticeBoard.childNodes.length > 60) noticeBoard.removeChild(noticeBoard.lastChild);
}

function isDirectLineage(v1, v2, depth = 1) { // 僅用於師生避親
    if (depth > 3 || !v1 || !v2) return false;
    if (v1.fatherId === v2.id || v1.motherId === v2.id) return true;
    if (v2.fatherId === v1.id || v2.motherId === v1.id) return true;
    let v1F = villagers.find(v => v.id === v1.fatherId), v1M = villagers.find(v => v.id === v1.motherId);
    if (v1F && isDirectLineage(v1F, v2, depth + 1)) return true;
    if (v1M && isDirectLineage(v1M, v2, depth + 1)) return true;
    return false;
}

// ==========================================
// 3. 村民類別 (靈魂核心)
// ==========================================
class Villager {
    constructor(cvs, gen, gender, isBaby = false, x = null, y = null, fName = "無", mName = "無", fId = null, mId = null, startAge = 0) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.gen = gen; this.gender = gender; this.serial = this.getSerial(gen, gender);
        this.name = `${this.gen}-${this.serial}`;
        this.x = x || cvs.width/2 + (Math.random()-0.5)*200;
        this.y = y || cvs.height/2 + (Math.random()-0.5)*200;
        this.father = fName; this.mother = mName; this.fatherId = fId; this.motherId = mId;
        this.birthTime = totalMinutes - (startAge * MINS_IN_YEAR);
        this.age = startAge;
        this.lastGrowthAge = Math.floor(startAge / 10) * 10;
        this.isAdultAwarded = (startAge >= 13);

        // 遺傳系統
        const p1 = villagers.find(v => v.id === fId), p2 = villagers.find(v => v.id === mId);
        const rollStat = (p1Stat, p2Stat) => {
            if (!p1Stat || !p2Stat) return 3 + Math.floor(Math.random() * 16);
            let base = (p1Stat + p2Stat) / 2;
            let mutation = Math.floor(Math.random() * 5) - 2;
            return Math.max(3, Math.min(18, Math.floor(base + mutation)));
        };
        this.str = rollStat(p1?.str, p2?.str); this.con = rollStat(p1?.con, p2?.con);
        this.siz = rollStat(p1?.siz, p2?.siz); this.dex = rollStat(p1?.dex, p2?.dex);
        this.isHero = (this.str >= 16 || this.con >= 16 || this.siz >= 16 || this.dex >= 16);

        this.personality = (this.str + this.dex > 25) ? "積極" : (this.con < 10 ? "懶惰" : "普通");
        this.maxHp = Math.ceil((this.con + this.siz) / 2);
        this.hp = this.maxHp; this.hunger = 80; this.energy = 80;
        this.action = "漫步"; this.angle = Math.random()*Math.PI*2;
        this.mateCooldown = 0; this.rels = {}; this.lastPlague = 0; this.isElder = false; this.plagueTimer = 0;
        if(fId) this.rels[fId] = { score: 100, type: '父親', name: fName };
        if(mId) this.rels[mId] = { score: 100, type: '母親', name: mName };
    }

    getSerial(gen, gender) {
        if (!genCounters[gen]) genCounters[gen] = { m: 1, f: 2 };
        let s = (gender === "男") ? genCounters[gen].m : genCounters[gen].f;
        if (gender === "男") genCounters[gen].m += 2; else genCounters[gen].f += 2;
        return s.toString().padStart(2, '0');
    }

    update() {
        if(this.hp <= 0) return;
        this.age = (totalMinutes - this.birthTime) / MINS_IN_YEAR;
        
        if (!this.isAdultAwarded && this.age >= 13) { this.isAdultAwarded = true; updateGrace(20, `${this.name} 成年`); }
        let currentDecade = Math.floor(this.age / 10) * 10;
        if (currentDecade > this.lastGrowthAge && this.age < 80) {
            this.lastGrowthAge = currentDecade;
            if (Math.random() < 0.3) this.evolveRandomStat(false);
        }

        this.hunger -= 0.008; this.energy -= 0.008;
        if(this.mateCooldown > 0) this.mateCooldown--;
        if(this.plagueTimer > 0) this.plagueTimer--;
        if(this.hp < this.maxHp && this.hunger > 50 && this.plagueTimer <= 0) this.hp = Math.min(this.maxHp, this.hp + (this.con / 5000));
        
        if(plagueZone && Math.hypot(this.x-plagueZone.x, this.y-plagueZone.y) < 100) {
            let now = Date.now(); if(now - this.lastPlague > 1000) { this.hp -= this.maxHp * 0.15; this.lastPlague = now; this.plagueTimer = 600; }
        }

        this.socialCycle();

        if(this.energy < 15) { this.action = "睡眠"; this.energy += 0.08; }
        else if(this.hunger < 70 || (this.action === "進食" && this.hunger < 95)) { this.action = "進食"; this.move(0.75); this.findRes(); }
        else {
            if(this.age < 13) {
                let p = villagers.find(v => v.id === this.motherId && v.hp > 0) || villagers.find(v => v.id === this.fatherId && v.hp > 0);
                if(p) {
                    this.action = "跟隨"; this.angle = Math.atan2(p.y - this.y, p.x - this.x); this.move(0.45);
                    if(Math.hypot(this.x - p.x, this.y - p.y) < 20) { this.hunger = Math.min(100, this.hunger + 0.015); } // 母愛補貼
                } else { this.move(0.3); }
            } else { this.action = "探索"; this.move(this.personality === "積極" ? 0.6 : 0.4); }
        }
        if(this.hunger <= 0) this.hp -= 0.04;
        if(this.age > 85) this.hp = 0;
        if(this.hp <= 0) {
            this.hp = 0; deathCount++;
            if (this.age >= 80) updateGrace(100, `${this.name} 自然老死`);
            addNotice(`☠️ ${this.isElder?"長老 ":"村民 "}${this.name} 離世。`, "notice-death");
            if(this.isElder) this.passElderTitle(); syncBottomBar();
        }
    }

    evolveRandomStat(isDivine = false) {
        const stats = ['str', 'con', 'siz', 'dex'];
        let s = stats[Math.floor(Math.random() * stats.length)];
        if (this[s] < 18) {
            this[s] += 1;
            if (s === 'con' || s === 'siz') this.maxHp = Math.ceil((this.con + this.siz) / 2);
            if (this[s] >= 16 && !this.isHero) { this.isHero = true; updateGrace(30, `${this.name} 覺醒天賦`); }
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

    socialCycle() {
        villagers.forEach(o => {
            if(o === this || o.hp <= 0) return;
            if(Math.hypot(this.x-o.x, this.y-o.y) < SOCIAL_RANGE) {
                if(!this.rels[o.id]) this.rels[o.id] = { score: 0, type: '陌生人', name: o.name };
                if(!o.rels[this.id]) o.rels[this.id] = { score: 0, type: '陌生人', name: this.name };
                let r = this.rels[o.id];
                r.score += 0.8; o.rels[this.id].score += 0.8;

                if(this.age >= 18 && o.age >= 18) {
                    if(r.type === '陌生人' || r.type === '朋友' || r.type === '師生') {
                        let upgradeRoll = Math.random();
                        let chance = (r.type === '朋友') ? 0.01 : 0.85; 
                        if (upgradeRoll < chance && r.score > 10) {
                            if(this.gender !== o.gender) { r.type = '戀人'; o.rels[this.id].type = '戀人'; }
                            else if(Math.random() < 0.2) { r.type = '戀人'; o.rels[this.id].type = '戀人'; }
                        }
                    }
                } else if(r.score > 10 && r.type === '陌生人') { r.type = '朋友'; o.rels[this.id].type = '朋友'; }

                if(this.age > 40 && o.age < 18 && !isDirectLineage(this, o)) { r.type = '師生'; o.rels[this.id].type = '師生'; }
                if(r.type === '戀人' && this.gender !== o.gender && this.mateCooldown <= 0 && o.mateCooldown <= 0 && this.hunger > 45) this.reproduce(o);
            }
        });
    }

    reproduce(o) {
        this.mateCooldown = 5000; o.mateCooldown = 5000;
        let baby = new Villager(window.cvsGlobal, Math.max(this.gen, o.gen)+1, (Math.random()>0.5?"男":"女"), true, this.x, this.y, (this.gender==="男"?this.name:o.name), (this.gender==="女"?this.name:o.name), (this.gender==="男"?this.id:o.id), (this.gender==="女"?this.id:o.id));
        this.rels[baby.id] = { score: 100, type: '子女', name: baby.name }; o.rels[baby.id] = { score: 100, type: '子女', name: baby.name };
        villagers.push(baby); 
        if (baby.isHero) { addNotice(`🌟 神蹟：神選之子 ${baby.name} 降臨！`, "notice-hero"); updateGrace(50, "天選誕生"); }
        else { addNotice(`👶 誕生：G${baby.gen}代 ${baby.name} 加入部落。`, "notice-birth"); updateGrace(10, "新命降臨"); }
        syncBottomBar();
    }

    findRes() {
        let t = environment.find(e => e.type !== 'grass' && Math.abs(e.x-this.x)<30 && Math.abs(e.y-this.y)<30);
        if(t) this.hunger = Math.min(100, this.hunger + (this.str/60));
    }
    move(spd) {
        this.x += Math.cos(this.angle)*spd; this.y += Math.sin(this.angle)*spd;
        if(Math.random()<0.02) this.angle += (Math.random()-0.5);
        if(this.x < 15 || this.x > window.cvsGlobal.width-15) this.angle = Math.PI - this.angle;
        if(this.y < 50 || this.y > window.cvsGlobal.height - 115 - 15) this.angle = -this.angle;
    }
    draw(ctx) {
        if(this.hp <= 0) { ctx.fillStyle="#333"; ctx.fillRect(this.x-5,this.y-5,10,10); return; }
        let r = (this.age < 18) ? 6 : (10 + this.siz/2.5);
        if(this.isHero) {
            let p = Math.sin(Date.now() / 300) * 4;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(this.x, this.y, r + 8 + p, 0, Math.PI * 2); ctx.stroke();
        }
        if(this.isElder) { ctx.strokeStyle = "#daa520"; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.arc(this.x, this.y, r + 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        if(selectedId === this.id) { ctx.strokeStyle="#0f0"; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(this.x,this.y,r+6,0,Math.PI*2); ctx.stroke(); }
        if(matchId === this.id) { ctx.strokeStyle="#ff69b4"; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(this.x,this.y,r+10,0,Math.PI*2); ctx.stroke(); }
        ctx.fillStyle = (this.plagueTimer > 0) ? "#4a148c" : ((this.action === "睡眠") ? "#666" : (this.gender === "男" ? "#3498db" : "#e84393"));
        ctx.beginPath(); ctx.arc(this.x,this.y,r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "white"; ctx.font = "10px Arial"; ctx.fillText((this.isHero?"✨":"")+(this.isElder?"👑":"")+this.name, this.x-10, this.y-r-5);
    }
}

// ==========================================
// 4. 世界控制與神權
// ==========================================
window.onload = function() {
    const canvas = document.getElementById('worldCanvas');
    window.cvsGlobal = canvas;
    const ctx = canvas.getContext('2d');
    const timeDisplay = document.getElementById('world-time');
    const bottomBar = document.getElementById('bottom-bar');
    const genTabs = document.getElementById('gen-tabs');
    const statusWindow = document.getElementById('status-window');
    const socialBox = document.getElementById('v-social-box');

    function init() {
        villagers = []; environment = []; genCounters = {}; selectedId = null; matchId = null; totalMinutes = 0; deathCount = 0; gracePoints = 500;
        canvas.width = window.innerWidth - 280; canvas.height = window.innerHeight;
        const cols = Math.ceil(canvas.width / TILE_SIZE), rows = Math.ceil(canvas.height / TILE_SIZE);
        for(let x=0; x<cols; x++) for(let y=0; y<rows; y++) {
            let r = Math.random(); environment.push({x: x*TILE_SIZE, y: y*TILE_SIZE, type: (r < 0.08 ? 'water' : (r < 0.22 ? 'forest' : 'grass'))});
        }
        for(let i=0; i<4; i++) {
            let v = new Villager(canvas, 1, (i < 2 ? "男" : "女"), false, null, null, "無", "無", null, null, 20);
            v.isElder = true; villagers.push(v);
        }
        addNotice("文明重建：始祖長老降臨。", "notice-elder");
        syncBottomBar();
    }

    window.castMiracle = (t) => {
        if (t === 'food') {
            if (gracePoints < 100) { alert("神恩不足！"); return; }
            updateGrace(-100); villagers.forEach(v => { if(v.hp > 0) v.hunger = 100; });
            addNotice("✨ 神蹟：投放聖餐。", "notice-elder");
        } else {
            if (!selectedId) { alert("請點擊目標！"); return; }
            if (gracePoints < 50) { alert("神恩不足！"); return; }
            let v = villagers.find(v => v.id === selectedId && v.hp > 0);
            if (v) { updateGrace(-50); v.hp = v.maxHp; v.plagueTimer = 0; v.evolveRandomStat(true); syncBottomBar(); }
        }
    };

    window.castLoveMiracle = () => {
        if (!selectedId) { alert("請點擊目標！"); return; }
        if (gracePoints < 200) { alert("神恩不足！"); return; }
        if (!matchId) { matchId = selectedId; addNotice(`🔮 命定之人：${villagers.find(v=>v.id===matchId).name}`); }
        else {
            if (matchId === selectedId) { matchId = null; return; }
            let v1 = villagers.find(v => v.id === matchId && v.hp > 0), v2 = villagers.find(v => v.id === selectedId && v.hp > 0);
            if (v1 && v2) { updateGrace(-200); v1.rels[v2.id] = { score: 100, type: '戀人', name: v2.name }; v2.rels[v1.id] = { score: 100, type: '戀人', name: v1.name }; v1.reproduce(v2); addNotice(`❤️ 神蹟：強行結合。`, "notice-hero"); }
            matchId = null;
        }
    };

    window.castPlague = () => { if(plagueZone) return; plagueZone = { x: Math.random()*canvas.width, y: Math.random()*canvas.height, r: 100 }; addNotice("⚠️ 天罰爆發！", "notice-death"); setTimeout(()=>plagueZone=null, 5000); };
    window.resetWorld = () => { if(confirm("重啟？")) init(); };

    function loop() {
        ctx.fillStyle = "#1e301e"; ctx.fillRect(0,0,canvas.width, canvas.height);
        environment.forEach(t => { ctx.fillStyle = (t.type === 'water' ? "#2a5a7a" : (t.type === 'forest' ? "#145a32" : "#2d4a2d")); ctx.fillRect(t.x, t.y, TILE_SIZE-1, TILE_SIZE-1); });
        if (plagueZone) {
            let p = Math.sin(Date.now() / 200) * 10;
            ctx.fillStyle = "rgba(0, 255, 0, 0.25)"; ctx.beginPath(); ctx.arc(plagueZone.x, plagueZone.y, 100 + p, 0, Math.PI*2); ctx.fill();
        }
        
        totalMinutes += GAME_SPEED; 
        if (Math.floor(totalMinutes % MINS_IN_YEAR) < GAME_SPEED) updateGrace(5); // 每年自然獲得 5 點

        let yrs = Math.floor(totalMinutes/MINS_IN_YEAR)+1, mths = Math.floor((totalMinutes/(60*24*30))%12)+1;
        timeDisplay.innerText = `世界曆 第 ${yrs} 年 ${mths} 月 | ${Math.floor(totalMinutes/60%24).toString().padStart(2,'0')}:${Math.floor(totalMinutes%60).toString().padStart(2,'0')}`;
        
        let aliveV = villagers.filter(v => v.hp > 0);
        document.getElementById('pop-stats').innerText = `人口：${aliveV.length} (男: ${aliveV.filter(v=>v.gender=="男").length} | 女: ${aliveV.filter(v=>v.gender=="女").length})`;
        document.getElementById('death-stats').innerText = `累積死亡：${deathCount}`;
        
        villagers.forEach(v => { v.update(); v.draw(ctx); });
        
        if(selectedId) {
            let v = villagers.find(v => v.id === selectedId);
            if(v && v.hp > 0) {
                document.getElementById('v-name').innerText = (v.isHero?"✨ ":"") + v.name;
                document.getElementById('v-age').innerText = Math.floor(v.age)+"歲";
                document.getElementById('v-elder-tag').innerText = v.isHero ? "✨ 神選之才 ✨" : "✨ 部落長老 ✨";
                document.getElementById('v-elder-tag').style.display = (v.isElder || v.isHero) ? 'block' : 'none';
                document.getElementById('v-father').innerText = v.father; document.getElementById('v-mother').innerText = v.mother;
                let s = getCoC6Label(v.str), c = getCoC6Label(v.con), z = getCoC6Label(v.siz), d = getCoC6Label(v.dex);
                document.getElementById('attr-str').innerHTML = `力量 (STR): ${v.str} <span class="attr-label ${s.cls}">(${s.txt})</span>`;
                document.getElementById('attr-con').innerHTML = `體質 (CON): ${v.con} <span class="attr-label ${c.cls}">(${c.txt})</span>`;
                document.getElementById('attr-siz').innerHTML = `體型 (SIZ): ${v.siz} <span class="attr-label ${z.cls}">(${z.txt})</span>`;
                document.getElementById('attr-dex').innerHTML = `敏捷 (DEX): ${v.dex} <span class="attr-label ${d.cls}">(${d.txt})</span>`;
                let hpP = Math.floor(v.hp/v.maxHp*100), fdP = Math.floor(v.hunger);
                document.getElementById('v-health').style.width = hpP+'%'; document.getElementById('v-hunger').style.width = fdP+'%';
                document.getElementById('hp-txt').innerText = hpP + '%'; document.getElementById('fd-txt').innerText = fdP+'%';
                let g = { '❤️ 戀人': [], '👪 家族': [], '🤝 朋友': [], '🎓 師生': [] };
                Object.values(v.rels).forEach(r => {
                    if(r.type==='戀人') g['❤️ 戀人'].push(r.name);
                    else if(['父親','母親','子女'].includes(r.type)) g['👪 家族'].push(`${r.type}:${r.name}`);
                    else if(r.type==='朋友') g['🤝 朋友'].push(r.name);
                    else if(r.type==='師生') g['🎓 師生'].push(r.name);
                });
                let h = '';
                for (let [t, ns] of Object.entries(g)) { if(ns.length > 0) {
                    let cl = t.includes('戀人') ? 'type-lover' : (t.includes('家族') ? 'type-family' : (t.includes('朋友') ? 'type-friend' : 'type-mentor'));
                    h += `<div class="rel-group"><div class="rel-header ${cl}">${t}</div><div class="rel-tags">`;
                    ns.forEach(n => h += `<span class="rel-tag">${n}</span>`);
                    h += `</div></div>`;
                }}
                socialBox.innerHTML = h || '<div style="color:#666; font-size:0.75em; padding:10px;">暫無關係</div>';
            } else { selectedId = null; statusWindow.style.display = 'none'; syncBottomBar(); }
        }
        requestAnimationFrame(loop);
    }
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect(); let found = villagers.find(v => Math.hypot(v.x-(e.clientX-rect.left), v.y-(e.clientY-rect.top)) < 30 && v.hp > 0);
        if(found) { selectedId = found.id; statusWindow.style.display = 'block'; syncBottomBar(); } else { selectedId = null; statusWindow.style.display = 'none'; syncBottomBar(); }
    });
    init(); loop();
};

function syncBottomBar() {
    let aliveV = villagers.filter(v=>v.hp>0);
    let gens = ['All', ...new Set(aliveV.map(v=>v.gen))].sort((a,b)=>a-b);
    const genTabs = document.getElementById('gen-tabs'), bottomBar = document.getElementById('bottom-bar');
    genTabs.innerHTML = '';
    gens.forEach(g => {
        let btn = document.createElement('div'); btn.className = `tab-btn ${currentTab == g ? 'active' : ''}`;
        btn.innerText = g == 'All' ? '全部' : `G${g}`; btn.onclick = () => { currentTab = g; syncBottomBar(); }; genTabs.appendChild(btn);
    });
    bottomBar.innerHTML = '';
    aliveV.filter(v => currentTab == 'All' || v.gen == currentTab).forEach(v => {
        let btn = document.createElement('div'); btn.className = `v-btn ${v.gender==="男"?"male":"female"} ${selectedId===v.id?"selected":""}`;
        btn.innerText = (v.isHero?"✨":"")+(v.isElder?"👑":"")+v.name; btn.onclick = () => { selectedId = v.id; document.getElementById('status-window').style.display = 'block'; syncBottomBar(); };
        bottomBar.appendChild(btn);
    });
}
