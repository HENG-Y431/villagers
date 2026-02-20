/* script.js - V10.2 引擎校正：修復分頁與社交 */

window.onload = function() {
    const canvas = document.getElementById('worldCanvas');
    window.cvsGlobal = canvas;
    const ctx = canvas.getContext('2d');
    
    function init() {
        villagers = []; environment = []; totalMinutes = 0; deathCount = 0; gracePoints = CONFIG.INITIAL_GRACE;
        canvas.width = window.innerWidth - 280; canvas.height = window.innerHeight;
        for(let x=0; x<Math.ceil(canvas.width/45); x++) for(let y=0; y<Math.ceil(canvas.height/45); y++) {
            environment.push({x: x*45, y: y*45, type: (Math.random() < 0.08 ? 'water' : 'grass')});
        }
        for(let i=0; i<4; i++) {
            let v = new Villager(canvas, 1, (i < 2 ? "男" : "女"), false, null, null, "無", "無", null, null, 20);
            v.isElder = true; villagers.push(v);
        }
        addNotice("文明起源：始祖降臨 👑", "notice-elder");
        syncBottomBar();
    }

    // --- 神權函數 ---
    window.castMiracle = (t) => {
        if (t === 'food') {
            if (gracePoints < CONFIG.COST_FOOD) { alert(`點數不足`); return; }
            updateGrace(-CONFIG.COST_FOOD); villagers.forEach(v => { if(v.hp > 0) v.hunger = 100; });
        } else {
            if (!selectedId) return;
            if (gracePoints < CONFIG.COST_ENERGY) { alert(`點數不足`); return; }
            let v = villagers.find(v => v.id === selectedId && v.hp > 0);
            if (v) { updateGrace(-CONFIG.COST_ENERGY); v.hp = v.maxHp; v.evolveRandomStat(true); syncBottomBar(); }
        }
    };
    window.castLoveMiracle = () => {
        if (!selectedId) return;
        if (gracePoints < CONFIG.COST_LOVE) { alert(`點數不足`); return; }
        if (!matchId) { matchId = selectedId; addNotice(`🔮 選中命定之人。`); }
        else {
            if (matchId === selectedId) { matchId = null; return; }
            let v1 = villagers.find(v => v.id === matchId && v.hp > 0), v2 = villagers.find(v => v.id === selectedId && v.hp > 0);
            if (v1 && v2) { updateGrace(-CONFIG.COST_LOVE); v1.rels[v2.id] = { score: 100, type: '戀人', name: v2.name }; v2.rels[v1.id] = { score: 100, type: '戀人', name: v1.name }; v1.reproduce(v2); }
            matchId = null;
        }
    };
    window.castPlague = () => { plagueZone = { x: Math.random()*canvas.width, y: Math.random()*canvas.height, r: 100 }; addNotice("⚠️ 天罰爆發！", "notice-death"); setTimeout(()=>plagueZone=null, 5000); };
    window.resetWorld = () => { if(confirm("重啟文明？")) init(); };

    function loop() {
        ctx.fillStyle = "#1e301e"; ctx.fillRect(0,0,canvas.width, canvas.height);
        environment.forEach(t => { ctx.fillStyle = (t.type === 'water' ? "#2a5a7a" : "#2d4a2d"); ctx.fillRect(t.x, t.y, 44, 44); });
        
        totalMinutes += CONFIG.GAME_SPEED; 
        
        // 修正時間顯示
        let yrs = Math.floor(totalMinutes / CONFIG.MINS_IN_YEAR) + 1;
        let mths = Math.floor((totalMinutes % CONFIG.MINS_IN_YEAR) / CONFIG.MINS_IN_MONTH) + 1;
        let days = Math.floor((totalMinutes % CONFIG.MINS_IN_MONTH) / CONFIG.MINS_IN_DAY) + 1;
        document.getElementById('world-time').innerText = `世界曆 第 ${yrs}年 ${mths}月 ${days}日`;
        document.getElementById('pop-stats').innerText = `人口：${villagers.filter(v=>v.hp>0).length}`;
        document.getElementById('grace-points').innerText = Math.floor(gracePoints);

        villagers.forEach(v => { v.update(); v.draw(ctx); });
        
        if(selectedId) {
            let v = villagers.find(v => v.id === selectedId);
            if(v && v.hp > 0) {
                document.getElementById('v-name').innerText = (v.isHero?"✨ ":"") + v.name;
                document.getElementById('v-age').innerText = Math.floor(v.age)+"歲";
                document.getElementById('v-personality').innerText = "性格："+v.personality;
                document.getElementById('v-father').innerText = v.father; document.getElementById('v-mother').innerText = v.mother;
                
                let s = getCoC6Label(v.str), c = getCoC6Label(v.con), z = getCoC6Label(v.siz), d = getCoC6Label(v.dex);
                document.getElementById('attr-str').innerHTML = `力量 (STR): ${v.str} <span class="attr-label ${s.cls}">(${s.txt})</span>`;
                document.getElementById('attr-con').innerHTML = `體質 (CON): ${v.con} <span class="attr-label ${c.cls}">(${c.txt})</span>`;
                document.getElementById('attr-siz').innerHTML = `體型 (SIZ): ${v.siz} <span class="attr-label ${z.cls}">(${z.txt})</span>`;
                document.getElementById('attr-dex').innerHTML = `敏捷 (DEX): ${v.dex} <span class="attr-label ${d.cls}">(${d.txt})</span>`;
                
                document.getElementById('v-health').style.width = (v.hp/v.maxHp*100)+'%';
                document.getElementById('v-hunger').style.width = v.hunger+'%';
                
                // 社交復甦：修正分類
                let family = [], lovers = [];
                Object.values(v.rels).forEach(r => {
                    if(r.type === '家族' || r.type === '子女') family.push(r.name);
                    else if(r.type === '戀人') lovers.push(r.name);
                });
                let h = family.length ? `<div class="rel-header">👪 家族</div><div class="rel-tags">${family.map(n=>`<span class="rel-tag">${n}</span>`).join('')}</div>` : '';
                h += lovers.length ? `<div class="rel-header">❤️ 戀人</div><div class="rel-tags">${lovers.map(n=>`<span class="rel-tag">${n}</span>`).join('')}</div>` : '';
                document.getElementById('v-social-box').innerHTML = h || '暫無社交';
            } else { selectedId = null; document.getElementById('status-window').style.display='none'; }
        }
        requestAnimationFrame(loop);
    }

    // 修正點擊座標判定
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        let found = villagers.find(v => Math.hypot(v.x-mx, v.y-my) < 25 && v.hp > 0);
        selectedId = found ? found.id : null;
        if(found) document.getElementById('status-window').style.display = 'block';
        syncBottomBar();
    });
    init(); loop();
};

function addNotice(msg, cls = "") {
    const board = document.getElementById('notice-board');
    if(!board) return;
    let div = document.createElement('div');
    div.innerHTML = `<span class="${cls}">${msg}</span>`;
    board.prepend(div);
}
function updateGrace(amount) { gracePoints += amount; }
function getCoC6Label(v) { 
    if(v>=17) return {txt:"稀有",cls:"rank-rare"}; 
    if(v>=14) return {txt:"超群",cls:"rank-good"}; 
    return {txt:"正常",cls:""}; 
}

// --- 核心修正：重新補回世代分頁邏輯 ---
function syncBottomBar() {
    let aliveV = villagers.filter(v=>v.hp>0);
    const genTabs = document.getElementById('gen-tabs'), bottomBar = document.getElementById('bottom-bar');
    if(!genTabs || !bottomBar) return;

    // 1. 生成分頁
    let gens = ['All', ...new Set(aliveV.map(v=>v.gen))].sort((a,b)=>a-b);
    genTabs.innerHTML = '';
    gens.forEach(g => {
        let btn = document.createElement('div'); btn.className = `tab-btn ${currentTab == g ? 'active' : ''}`;
        btn.innerText = g == 'All' ? '全部' : `G${g}`; 
        btn.onclick = (e) => { e.stopPropagation(); currentTab = g; syncBottomBar(); }; 
        genTabs.appendChild(btn);
    });

    // 2. 生成村民按鈕
    bottomBar.innerHTML = '';
    aliveV.filter(v => currentTab == 'All' || v.gen == currentTab).forEach(v => {
        let btn = document.createElement('div');
        btn.className = `v-btn ${v.gender==="男"?"male":"female"} ${selectedId===v.id?"selected":""}`;
        btn.innerText = v.name;
        btn.onclick = (e) => { e.stopPropagation(); selectedId = v.id; document.getElementById('status-window').style.display='block'; syncBottomBar(); };
        bottomBar.appendChild(btn);
    });
}
