/* script.js - V9.6 神聖鏈接版 */

window.onload = function() {
    const canvas = document.getElementById('worldCanvas');
    window.cvsGlobal = canvas;
    const ctx = canvas.getContext('2d');
    const timeDisplay = document.getElementById('world-time');
    
    function init() {
        villagers = []; environment = []; genCounters = {}; selectedId = null; matchId = null; totalMinutes = 0; deathCount = 0; gracePoints = CONFIG.INITIAL_GRACE;
        canvas.width = window.innerWidth - 280; canvas.height = window.innerHeight;
        const cols = Math.ceil(canvas.width / TILE_SIZE), rows = Math.ceil(canvas.height / TILE_SIZE);
        for(let x=0; x<cols; x++) for(let y=0; y<rows; y++) {
            let r = Math.random(); environment.push({x: x*TILE_SIZE, y: y*TILE_SIZE, type: (r < 0.08 ? 'water' : (r < 0.22 ? 'forest' : 'grass'))});
        }
        for(let i=0; i<4; i++) {
            let v = new Villager(canvas, 1, (i < 2 ? "男" : "女"), false, null, null, "無", "無", null, null, 20);
            v.isElder = true; villagers.push(v);
        }
        syncBottomBar();
    }

    // --- 神權按鈕邏輯 (確保不報錯) ---
    window.castMiracle = (t) => {
        if (t === 'food') {
            if (gracePoints < CONFIG.COST_FOOD) { alert(`神恩不足 (${CONFIG.COST_FOOD}pt)`); return; }
            updateGrace(-CONFIG.COST_FOOD); villagers.forEach(v => { if(v.hp > 0) v.hunger = 100; });
            addNotice("✨ 神蹟：全體飽足。");
        } else {
            if (!selectedId) { alert("請先選中小人！"); return; }
            if (gracePoints < CONFIG.COST_ENERGY) { alert(`神恩不足 (${CONFIG.COST_ENERGY}pt)`); return; }
            let v = villagers.find(v => v.id === selectedId && v.hp > 0);
            if (v) { updateGrace(-CONFIG.COST_ENERGY); v.hp = v.maxHp; v.plagueTimer = 0; v.evolveRandomStat(true); syncBottomBar(); }
        }
    };

    window.castLoveMiracle = () => {
        if (!selectedId) { alert("請點擊目標！"); return; }
        if (gracePoints < CONFIG.COST_LOVE) { alert(`神恩不足 (${CONFIG.COST_LOVE}pt)`); return; }
        if (!matchId) { matchId = selectedId; addNotice(`🔮 預言：選中命定之人。`); }
        else {
            if (matchId === selectedId) { matchId = null; return; }
            let v1 = villagers.find(v => v.id === matchId && v.hp > 0), v2 = villagers.find(v => v.id === selectedId && v.hp > 0);
            if (v1 && v2) { updateGrace(-CONFIG.COST_LOVE); v1.rels[v2.id] = { score: 100, type: '戀人', name: v2.name }; v2.rels[v1.id] = { score: 100, type: '戀人', name: v1.name }; v1.reproduce(v2); addNotice(`❤️ 神蹟：強行結合。`); }
            matchId = null;
        }
    };

    window.castPlague = () => { if(plagueZone) return; plagueZone = { x: Math.random()*canvas.width, y: Math.random()*canvas.height, r: 100 }; addNotice("⚠️ 天罰爆發！", "notice-death"); setTimeout(()=>plagueZone=null, 5000); };
    window.resetWorld = () => { if(confirm("重啟？")) init(); };

    // --- 主循環 ---
    function loop() {
        ctx.fillStyle = "#1e301e"; ctx.fillRect(0,0,canvas.width, canvas.height);
        environment.forEach(t => { ctx.fillStyle = (t.type === 'water' ? "#2a5a7a" : (t.type === 'forest' ? "#145a32" : "#2d4a2d")); ctx.fillRect(t.x, t.y, TILE_SIZE-1, TILE_SIZE-1); });
        
        let oldY = Math.floor(totalMinutes/CONFIG.MINS_IN_YEAR);
        totalMinutes += CONFIG.GAME_SPEED; 
        if (Math.floor(totalMinutes/CONFIG.MINS_IN_YEAR) > oldY) updateGrace(CONFIG.YEARLY_GRACE);

        // 時間計算修正 (年月日顯示)
        let yrs = Math.floor(totalMinutes / CONFIG.MINS_IN_YEAR) + 1;
        let remM = totalMinutes % CONFIG.MINS_IN_YEAR;
        let mths = Math.floor(remM / CONFIG.MINS_IN_MONTH) + 1;
        let remD = remM % CONFIG.MINS_IN_MONTH;
        let days = Math.floor(remD / CONFIG.MINS_IN_DAY) + 1;
        let hrs = Math.floor((remD % CONFIG.MINS_IN_DAY) / 60);
        let mins = Math.floor(remD % 60);
        timeDisplay.innerText = `世界曆 第 ${yrs}年 ${mths}月 ${days}日 | ${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}`;

        let aliveV = villagers.filter(v => v.hp > 0);
        document.getElementById('pop-stats').innerText = `人口：${aliveV.length} (男: ${aliveV.filter(v=>v.gender=="男").length} | 女: ${aliveV.filter(v=>v.gender=="女").length})`;
        document.getElementById('death-stats').innerText = `累積死亡：${deathCount}`;
        
        villagers.forEach(v => { v.update(); v.draw(ctx); });
        
        if(selectedId) {
            let v = villagers.find(v => v.id === selectedId);
            if(v && v.hp > 0) {
                // UI 更新復甦
                document.getElementById('v-name').innerText = (v.isHero?"✨ ":"") + v.name;
                document.getElementById('v-age').innerText = Math.floor(v.age)+"歲";
                document.getElementById('v-personality').innerText = "性格："+v.personality;
                document.getElementById('v-father').innerText = v.father; 
                document.getElementById('v-mother').innerText = v.mother;
                
                // 屬性鑑定修正 (移除原本的 this.str 錯誤)
                let s = getCoC6Label(v.str), c = getCoC6Label(v.con), z = getCoC6Label(v.siz), d = getCoC6Label(v.dex);
                document.getElementById('attr-str').innerHTML = `力量 (STR): ${v.str} <span class="attr-label ${s.cls}">(${s.txt})</span>`;
                document.getElementById('attr-con').innerHTML = `體質 (CON): ${v.con} <span class="attr-label ${c.cls}">(${c.txt})</span>`;
                document.getElementById('attr-siz').innerHTML = `體型 (SIZ): ${v.siz} <span class="attr-label ${z.cls}">(${z.txt})</span>`;
                document.getElementById('attr-dex').innerHTML = `敏捷 (DEX): ${v.dex} <span class="attr-label ${d.cls}">(${d.txt})</span>`;
                
                let hpP = Math.floor(v.hp/v.maxHp*100), fdP = Math.floor(v.hunger);
                document.getElementById('v-health').style.width = hpP+'%'; 
                document.getElementById('v-hunger').style.width = fdP+'%';
                document.getElementById('hp-txt').innerText = hpP + '%'; 
                document.getElementById('fd-txt').innerText = fdP+'%';
                
                // 社交列表重塑
                let g = { '❤️ 戀人': [], '👪 家族': [], '🤝 朋友': [] }, h = '';
                Object.values(v.rels).forEach(r => { if(g[r.type]) g[r.type].push(r.name); });
                for (let [t, ns] of Object.entries(g)) { 
                    if(ns.length > 0) { h += `<div class="rel-header">${t}</div><div class="rel-tags">${ns.map(n=>`<span class="rel-tag">${n}</span>`).join('')}</div>`; }
                }
                document.getElementById('v-social-box').innerHTML = h || '暫無社交';
            } else { selectedId = null; document.getElementById('status-window').style.display = 'none'; syncBottomBar(); }
        }
        requestAnimationFrame(loop);
    }

    // --- 修正：更精確的畫布點擊判定 ---
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        let found = villagers.find(v => Math.hypot(v.x - clickX, v.y - clickY) < 25 && v.hp > 0);
        if(found) { 
            selectedId = found.id; 
            document.getElementById('status-window').style.display = 'block'; 
            syncBottomBar(); 
        } else { 
            selectedId = null; 
            document.getElementById('status-window').style.display = 'none'; 
            syncBottomBar(); 
        }
    });

    init(); loop();
};

const TILE_SIZE = 45;
function updateGrace(amount, reason = "") {
    gracePoints += amount;
    const graceDisplay = document.getElementById('grace-points');
    if(graceDisplay) graceDisplay.innerText = Math.floor(gracePoints);
    if (amount > 0 && reason) addNotice(`✨ 神恩：${reason} (+${amount})`, "notice-elder");
}
function addNotice(msg, typeClass = "") {
    const noticeBoard = document.getElementById('notice-board');
    if (!noticeBoard) return;
    let div = document.createElement('div');
    div.innerHTML = `<span class="notice-time">${Math.floor(totalMinutes/CONFIG.MINS_IN_MONTH)+1}月</span> <span class="${typeClass}">${msg}</span>`;
    noticeBoard.prepend(div);
    if (noticeBoard.childNodes.length > 50) noticeBoard.removeChild(noticeBoard.lastChild);
}
function isDirectLineage(v1, v2, depth = 1) {
    if (depth > 3 || !v1 || !v2) return false;
    if (v1.fatherId === v2.id || v1.motherId === v2.id) return true;
    if (v2.fatherId === v1.id || v2.motherId === v1.id) return true;
    let v1F = villagers.find(v => v.id === v1.fatherId), v1M = villagers.find(v => v.id === v1.motherId);
    if (v1F && isDirectLineage(v1F, v2, depth + 1)) return true;
    if (v1M && isDirectLineage(v1M, v2, depth + 1)) return true;
    return false;
}

// --- 修復點擊按鈕暫停的問題 ---
function syncBottomBar() {
    let aliveV = villagers.filter(v=>v.hp>0);
    let gens = ['All', ...new Set(aliveV.map(v=>v.gen))].sort((a,b)=>a-b);
    const genTabs = document.getElementById('gen-tabs'), bottomBar = document.getElementById('bottom-bar');
    if(!genTabs) return;
    genTabs.innerHTML = '';
    gens.forEach(g => {
        let btn = document.createElement('div'); 
        btn.className = `tab-btn ${currentTab == g ? 'active' : ''}`;
        btn.innerText = g == 'All' ? '全部' : `G${g}`; 
        btn.onclick = (e) => { 
            e.stopPropagation(); // 防止觸發畫布事件
            currentTab = g; 
            syncBottomBar(); 
        }; 
        genTabs.appendChild(btn);
    });
    bottomBar.innerHTML = '';
    aliveV.filter(v => currentTab == 'All' || v.gen == currentTab).forEach(v => {
        let btn = document.createElement('div'); 
        btn.className = `v-btn ${v.gender==="男"?"male":"female"} ${selectedId===v.id?"selected":""}`;
        btn.innerText = (v.isHero?"✨":"")+(v.isElder?"👑":"")+v.name; 
        btn.onclick = (e) => { 
            e.stopPropagation();
            selectedId = v.id; 
            document.getElementById('status-window').style.display = 'block'; 
            syncBottomBar(); 
        };
        bottomBar.appendChild(btn);
    });
}
