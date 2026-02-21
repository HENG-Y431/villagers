// script.js
import { CONFIG, getCoC6Label } from './config.js';
import Villager from './villager.js';

// ---- 全域狀態與 Game Context 建立 ----
const GameState = {
    canvas: document.getElementById('worldCanvas'),
    ctx: document.getElementById('worldCanvas').getContext('2d'),
    villagers: [],
    environment: [],
    totalMinutes: 0,
    deathCount: 0,
    divinePoints: 100, // 初始給予 100 點
    plagueZone: null,
    genCounters: {},
    currentYearTracker: 0,
    
    // 供 Villager 呼叫的方法
    getSerial: function(gen, gender) {
        if (!this.genCounters[gen]) this.genCounters[gen] = { m: 1, f: 2, x: 3 };
        let s = (gender === "男") ? this.genCounters[gen].m : ((gender === "女") ? this.genCounters[gen].f : this.genCounters[gen].x);
        
        if (gender === "男") this.genCounters[gen].m += 3; 
        else if (gender === "女") this.genCounters[gen].f += 3;
        else this.genCounters[gen].x += 3;
        return s.toString().padStart(2, '0');
    },
    
    addNotice: function(msg, typeClass = "") {
        const board = document.getElementById('notice-board');
        let yrs = Math.floor(this.totalMinutes / CONFIG.MINS_IN_YEAR) + 1;
        let mths = Math.floor((this.totalMinutes / (60 * 24 * 30)) % 12) + 1;
        let div = document.createElement('div');
        div.innerHTML = `<span class="notice-time">${yrs}年${mths}月</span> <span class="${typeClass}">${msg}</span>`;
        board.prepend(div);
        if (board.childNodes.length > 60) board.removeChild(board.lastChild);
    },
    addPoints: function(pts) {
        this.divinePoints += pts;
        document.getElementById('divine-points').innerText = this.divinePoints;
    },
    usePoints: function(cost) {
        if (this.divinePoints >= cost) {
            this.divinePoints -= cost;
            document.getElementById('divine-points').innerText = this.divinePoints;
            return true;
        }
        alert(`神權點數不足！需要 ${cost} 點，目前僅有 ${this.divinePoints} 點。`);
        return false;
    },
    isDirectLineage: function(v1, v2, depth = 1) {
        if (depth > 3 || !v1 || !v2) return false;
        if (v1.fatherId === v2.id || v1.motherId === v2.id) return true;
        if (v2.fatherId === v1.id || v2.motherId === v1.id) return true;
        let v1F = this.villagers.find(v => v.id === v1.fatherId), v1M = this.villagers.find(v => v.id === v1.motherId);
        if (v1F && this.isDirectLineage(v1F, v2, depth + 1)) return true;
        if (v1M && this.isDirectLineage(v1M, v2, depth + 1)) return true;
        return false;
    },
    syncUI: () => syncBottomBar()
};

// UI 狀態
let selectedId = null;
let currentTab = 'All';
let matchmakingTarget = null; // 神聖紅線的預選對象
let isMatchmakingMode = false;

// ---- 初始化世界 ----
function initWorld() {
    GameState.canvas.width = window.innerWidth - 280; 
    GameState.canvas.height = window.innerHeight;
    document.getElementById('divine-points').innerText = GameState.divinePoints;
    
    const cols = Math.ceil(GameState.canvas.width / CONFIG.TILE_SIZE);
    const rows = Math.ceil(GameState.canvas.height / CONFIG.TILE_SIZE);
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            let r = Math.random();
            GameState.environment.push({ x: x * CONFIG.TILE_SIZE, y: y * CONFIG.TILE_SIZE, type: (r < 0.08 ? 'water' : (r < 0.22 ? 'forest' : 'grass')) });
        }
    }
    
    // 創造 4 位始祖
    for (let i = 0; i < 4; i++) {
        let v = new Villager(GameState, 1, (i < 2 ? "男" : "女"), false, null, null, "無", "無", null, null, 20);
        v.isElder = true; 

    // 強制給予約一年的繁衍冷卻期 (約 2000 幀)
        v.mateCooldown = 2000;
        
        GameState.villagers.push(v);
    }
    GameState.addNotice("文明起源:始祖長老 降臨。", "notice-elder");
    syncBottomBar();
}

// ---- UI 更新邏輯 ----
function syncBottomBar() {
    let aliveV = GameState.villagers.filter(v => v.hp > 0);
    let gens = ['All', ...new Set(aliveV.map(v => v.gen))].sort((a, b) => a - b);
    const genTabs = document.getElementById('gen-tabs');
    const bottomBar = document.getElementById('bottom-bar');
    
    genTabs.innerHTML = "";
    gens.forEach(g => {
        let btn = document.createElement('div');
        btn.className = `tab-btn ${currentTab == g ? 'active' : ''}`;
        btn.innerText = g == 'All' ? '全部' : `G${g}`;
        btn.onclick = () => { currentTab = g; syncBottomBar(); };
        genTabs.appendChild(btn);
    });
    
    bottomBar.innerHTML = "";
    aliveV.filter(v => currentTab == 'All' || v.gen == currentTab).forEach(v => {
        let btn = document.createElement('div');
        let classes = `v-btn`;
        if (v.gender === "男") classes += " male";
        else if (v.gender === "女") classes += " female";
        else classes += " intersex";
        
        if (selectedId === v.id) classes += " selected";
        if (matchmakingTarget && matchmakingTarget.id === v.id) classes += " match-target";
        btn.className = classes;
        
        btn.innerText = (v.isHero ? "⭐" : "") + (v.isElder ? "👑" : "") + v.name;
        btn.onclick = () => { 
            selectedId = v.id; 
            document.getElementById('status-window').style.display = 'block'; 
            syncBottomBar(); 
        };
        bottomBar.appendChild(btn);
    });
}

// ---- 神權控制按鈕綁定 (替代舊版 onclick) ----
document.getElementById('btn-food').addEventListener('click', () => {
    if (!GameState.usePoints(CONFIG.COSTS.FOOD)) return;
    GameState.villagers.forEach(v => { if (v.hp > 0) v.hunger = 100; });
    GameState.addNotice("神蹟: 全體獲得聖餐，飢餓清空。", "notice-elder");
});

document.getElementById('btn-heal').addEventListener('click', () => {
    if (!selectedId) return alert("請先點擊選擇一名小人！");
    if (!GameState.usePoints(CONFIG.COSTS.HEAL)) return;
    let v = GameState.villagers.find(v => v.id === selectedId && v.hp > 0);
    if (v) {
        v.hp = v.maxHp; v.plagueTimer = 0; v.evolveRandomStat(true); syncBottomBar();
    }
});

document.getElementById('btn-plague').addEventListener('click', () => {
    if (GameState.plagueZone) return;
    if (!GameState.usePoints(CONFIG.COSTS.PLAGUE)) return;
    GameState.plagueZone = { x: Math.random() * GameState.canvas.width, y: Math.random() * GameState.canvas.height, r: 100 };
    GameState.addNotice("天罰! 瘟疫在隨機處爆發。", "notice-death");
    setTimeout(() => GameState.plagueZone = null, 5000);
});

// ⭐ 神聖紅線 (Divine Matchmaking) 核心邏輯
document.getElementById('btn-matchmake').addEventListener('click', () => {
    const statusText = document.getElementById('match-status');
    
    // 如果還沒選人
    if (!selectedId) return alert("【神聖紅線】請先點選一名「成年」村民作為起始對象！");
    let currentV = GameState.villagers.find(v => v.id === selectedId);
    if (currentV.age < 18) return alert("【神聖紅線】該村民尚未成年，無法牽線！");

    if (!isMatchmakingMode) {
        // 第一階段：鎖定目標 A
        isMatchmakingMode = true;
        matchmakingTarget = currentV;
        statusText.innerText = `已鎖定: ${currentV.name}`;
        statusText.style.color = "#ff69b4";
        syncBottomBar();
    } else {
        // 第二階段：執行牽線
        if (currentV.id === matchmakingTarget.id) return alert("不能跟自己牽紅線！請選擇另一位異性。");
        if (currentV.age < 18) return alert("目標對象尚未成年！");
        if (currentV.gender === matchmakingTarget.gender) return alert("神聖紅線目前僅支援異性繁衍！");
        
        
        // 扣除點數
        if (!GameState.usePoints(CONFIG.COSTS.MATCHMAKE)) {
            isMatchmakingMode = false; matchmakingTarget = null; statusText.innerText = "點擊啟動"; syncBottomBar(); return;
        }

        // 強制建立滿分戀人關係
        currentV.rels[matchmakingTarget.id] = { score: 100, type: '戀人', name: matchmakingTarget.name };
        matchmakingTarget.rels[currentV.id] = { score: 100, type: '戀人', name: currentV.name };
        
        GameState.addNotice(`💖 神聖紅線：${currentV.name} 與 ${matchmakingTarget.name} 被命運強制綁定！`, "notice-hero");
        
        // 強制繁衍
        currentV.reproduce(matchmakingTarget);

        // 解除牽線模式
        isMatchmakingMode = false;
        matchmakingTarget = null;
        statusText.innerText = "點擊啟動";
        statusText.style.color = "#888";
        syncBottomBar();
    }
});


// ---- 主迴圈 ----
function loop() {
    const ctx = GameState.ctx;
    const canvas = GameState.canvas;
    
    ctx.fillStyle = "#1e301e"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    GameState.environment.forEach(t => {
        ctx.fillStyle = (t.type === 'water' ? "#2a5a7a" : (t.type === 'forest' ? "#145a32" : "#2d4a2d"));
        ctx.fillRect(t.x, t.y, CONFIG.TILE_SIZE - 1, CONFIG.TILE_SIZE - 1);
    });
    
    if (GameState.plagueZone) {
        let p = Math.sin(Date.now() / 200) * 10;
        ctx.fillStyle = "rgba(0, 255, 0, 0.25)"; ctx.beginPath();
        ctx.arc(GameState.plagueZone.x, GameState.plagueZone.y, 100 + p, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(0, 255, 0, 0.6)"; ctx.lineWidth = 2; ctx.beginPath();
        ctx.arc(GameState.plagueZone.x, GameState.plagueZone.y, 105 + p, 0, Math.PI * 2); ctx.stroke();
    }
    
    GameState.totalMinutes += CONFIG.SPEED_MULTIPLIER;
    
    // 計算時間與點數發放邏輯
    let calculatedYear = Math.floor(GameState.totalMinutes / CONFIG.MINS_IN_YEAR);
    if (calculatedYear > GameState.currentYearTracker) {
        GameState.currentYearTracker = calculatedYear;
        GameState.addPoints(CONFIG.POINTS.YEAR_PASSED); // 每年 +5 點
        GameState.addNotice(`文明邁入第 ${calculatedYear + 1} 年，神權點數 +5！`, "notice-elder");
    }

    let yrs = calculatedYear + 1;
    let mths = Math.floor((GameState.totalMinutes / (60 * 24 * 30)) % 12) + 1;
    let hrs = Math.floor((GameState.totalMinutes / 60) % 24), mins = Math.floor(GameState.totalMinutes % 60);
    document.getElementById('world-time').innerText = `第${yrs}年${mths}月 | ${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    
    let aliveV = GameState.villagers.filter(v => v.hp > 0);
    document.getElementById('pop-stats').innerText = `人口:${aliveV.length} (男:${aliveV.filter(v => v.gender == "男").length} | 女:${aliveV.filter(v => v.gender == "女").length} | 雙性:${aliveV.filter(v => v.gender == "雙性").length})`;
    document.getElementById('death-stats').innerText = `累積死亡:${GameState.deathCount}`;
    
    // 繪製村民 (傳入 selectedId 與 matchmakingTargetId 以繪製不同光環)
    GameState.villagers.forEach(v => { 
        v.update(); 
        v.draw(ctx, (selectedId === v.id), (matchmakingTarget && matchmakingTarget.id === v.id)); 
    });
    
    // 村民小人狀態 左下角面板
    if (selectedId) {
        let v = GameState.villagers.find(v => v.id === selectedId);
        if (v && v.hp > 0) {
            document.getElementById('v-name').innerHTML = (v.isHero ? "<span style='color: #fff; text-shadow: 0 0 5px #daa520;'>[神選]</span> " : "") + v.name;
            document.getElementById('v-age').innerText = Math.floor(v.age) + "歲";
            document.getElementById('v-elder-tag').style.display = v.isElder ? 'block' : 'none';
            document.getElementById('v-personality').innerText = "性格:" + v.personality;
            document.getElementById('v-father').innerText = v.father;
            document.getElementById('v-mother').innerText = v.mother;
            
            let s = getCoC6Label(v.str), c = getCoC6Label(v.con), z = getCoC6Label(v.siz), d = getCoC6Label(v.dex);
            document.getElementById('attr-str').innerHTML = `STR: ${v.str} <span class="attr-label ${s.cls}">(${s.txt})</span>`;
            document.getElementById('attr-con').innerHTML = `CON: ${v.con} <span class="attr-label ${c.cls}">(${c.txt})</span>`;
            document.getElementById('attr-siz').innerHTML = `SIZ: ${v.siz} <span class="attr-label ${z.cls}">(${z.txt})</span>`;
            document.getElementById('attr-dex').innerHTML = `DEX: ${v.dex} <span class="attr-label ${d.cls}">(${d.txt})</span>`;
            
            let hpP = Math.floor(v.hp / v.maxHp * 100), fdP = Math.floor(v.hunger);
            document.getElementById('v-health').parentElement.style.background = v.plagueTimer > 0 ? "#4a148c" : "#222";
            document.getElementById('v-health').style.width = hpP + '%';
            document.getElementById('v-hunger').style.width = fdP + '%';
            document.getElementById('hp-txt').innerText = (v.plagueTimer > 0 ? "受感染 " : "") + hpP + '%';
            document.getElementById('fd-txt').innerText = fdP + '%';
            
            // 社交關係
            let g = { '摯友': [], '戀人': [], '家族': [], '朋友': [], '師生': [] };
            Object.values(v.rels).forEach(r => {
                if (r.type === '摯友') g['摯友'].push(r.name);
                else if (r.type === '戀人') g['戀人'].push(r.name);
                else if (['父親', '母親', '子女'].includes(r.type)) g['家族'].push(`${r.type}:${r.name}`);
                else if (r.type === '朋友') g['朋友'].push(r.name);
                else if (r.type === '師生') g['師生'].push(r.name);
            });
            
            let h = "";
            for (let [t, ns] of Object.entries(g)) {
                if (ns.length > 0) {
                    // 顏色標籤對應
                    let cl = t.includes('摯友') ? 'type-partner' : 
                             (t.includes('戀人') ? 'type-lover' : 
                             (t.includes('家族') ? 'type-family' : 
                             (t.includes('朋友') ? 'type-friend' : 'type-mentor')));
                             
                    h += `<div class="rel-group"><div class="rel-header ${cl}">${t}</div><div class="rel-tags">`;
                    ns.forEach(n => h += `<span class="rel-tag">${n}</span>`);
                    h += '</div></div>';
                }
            }
            document.getElementById('v-social-box').innerHTML = h || '<div style="color:#666; font-size:0.75em; padding: 10px;">暫無關係</div>';
        } else {
            selectedId = null; 
            document.getElementById('status-window').style.display = 'none'; 
            syncBottomBar();
        }
    }
    
    requestAnimationFrame(loop);
}

// 綁定畫布點擊
GameState.canvas.addEventListener('mousedown', (e) => {
    const rect = GameState.canvas.getBoundingClientRect();
    let found = GameState.villagers.find(v => Math.hypot(v.x - (e.clientX - rect.left), v.y - (e.clientY - rect.top)) < 30 && v.hp > 0);
    if (found) {
        selectedId = found.id;
        document.getElementById('status-window').style.display = 'block';
    } else {
        selectedId = null;
        document.getElementById('status-window').style.display = 'none';
    }
    syncBottomBar();
});

// 啟動遊戲
initWorld();
loop();
