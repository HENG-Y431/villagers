/* config.js - 文明法典：定義所有全域變數與數值常數 */
const CONFIG = {
    GAME_SPEED: 250,           // 遊戲速度
    SOCIAL_RANGE: 130,         // 社交感應範圍
    INITIAL_GRACE: 200,        // 初始神恩
    YEARLY_GRACE: 5,           
    HERO_TOTAL_MIN: 58,        // 神選門檻
    HERO_PEAK_MIN: 17,         
    HERO_PEAK_COUNT: 2,        
    COST_FOOD: 100,            // 飽食消耗
    COST_ENERGY: 50,           // 治癒消耗
    COST_LOVE: 200,            // 紅線消耗
    MINS_IN_YEAR: 60 * 24 * 30 * 12,
    MINS_IN_MONTH: 60 * 24 * 30, 
    MINS_IN_DAY: 60 * 24,        
    FOOTER_HEIGHT: 115         
};

const TILE_SIZE = 45;

// --- 全域存儲空間：嚴禁在其他 JS 檔案重複使用 let 宣告這些名稱 ---
let villagers = [], environment = [], selectedId = null, matchId = null;
let totalMinutes = 0, genCounters = {}, deathCount = 0, currentTab = 'All';
let plagueZone = null, gracePoints = CONFIG.INITIAL_GRACE;
