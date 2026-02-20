/* config.js - 文明法典：V9.6 校正版 */
const CONFIG = {
    GAME_SPEED: 250,           
    SOCIAL_RANGE: 130,         
    INITIAL_GRACE: 200,        
    YEARLY_GRACE: 5,           
    HERO_TOTAL_MIN: 58,        
    HERO_PEAK_MIN: 17,         
    HERO_PEAK_COUNT: 2,        
    COST_FOOD: 100,            
    COST_ENERGY: 50,           
    COST_LOVE: 200,            
    MINS_IN_YEAR: 60 * 24 * 30 * 12,
    MINS_IN_MONTH: 60 * 24 * 30, 
    MINS_IN_DAY: 60 * 24,        
    FOOTER_HEIGHT: 115         
};

// --- 全域變數 (全文明僅此處聲明，禁止在 script.js 重複寫) ---
let villagers = [], environment = [], selectedId = null, matchId = null;
let totalMinutes = 0, genCounters = {}, deathCount = 0, currentTab = 'All';
let plagueZone = null, gracePoints = CONFIG.INITIAL_GRACE;
