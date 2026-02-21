// config.js
export const CONFIG = {
    TILE_SIZE: 45,
    SOCIAL_RANGE: 130, // 社交判定半徑
    MINS_IN_YEAR: 60 * 24 * 30 * 12, // 一年的遊戲內分鐘數
    SPEED_MULTIPLIER: 250, // 每次迴圈推進的時間量 (時空跳躍)
    
    // 神權點數系統設定
    POINTS: {
        YEAR_PASSED: 5,     // 每年自然增加
        BIRTH_NORMAL: 10,   // 普通嬰兒誕生
        BIRTH_HERO: 20,     // 神選之才誕生
    },
    
    // 神權干預技能消耗
    COSTS: {
        FOOD: 100,           // 投放聖餐
        HEAL: 50,           // 神聖治癒
        PLAGUE: 10,         // 天罰災厄
        MATCHMAKE: 200       // 神聖紅線
    }
};

export function getCoC6Label(val) {
    if (val <= 5) return { txt: "缺陷", cls: "rank-poor" };
    if (val <= 7) return { txt: "稍弱", cls: "rank-poor" };
    if (val <= 12) return { txt: "正常", cls: "" };
    if (val <= 15) return { txt: "優秀", cls: "rank-good" };
    return { txt: "超群", cls: "rank-rare" };
}
