// 游戏存档数据
// 游戏存档数据
let gameData = {
    directionSense: 0, frogSpeedLevel: 0, frogValueLevel: 0,
    valueUpgradeCount: 0, speedUpgradeCount: 0,
    unlockedFloors: [1], unlockedBooks: [], babelFloor: 1,
    // 修改：巴别塔持久化状态
    babelChallenge: {
        type: null,        // 'card' 或 'dice'
        playerHand: null,  // 记忆卡牌手牌
        enemyHand: null,   // 记忆敌方卡牌
        playerDice: null,  // 记忆骰子点数（如有必要）
        enemyDice: null,
        started: false
    },
    collectedFragments: [], achievedEndings: [], completedStories: [],
    collectionFragments: [], collectionStories: [], resetCount: 0,
    lastSaveTime: 0
};

const BASE_ORB_VALUE = 1;
const MAX_ORBS_ON_SCREEN = 5;

// 采用指数增长算法平衡长线经济
function getSpeedCost() { return Math.floor(15 * Math.pow(1.25, gameData.speedUpgradeCount || 0)); }
function getValueCost() { return Math.floor(500 * Math.pow(2.5, gameData.valueUpgradeCount || 0)); }

// 获取当前青蛙的收集间隔（初始7.5秒，每升1级减少0.5秒，10级时达到光团生成的2.5秒）
function getFrogInterval() { 
    return Math.max(500, 7500 - gameData.frogSpeedLevel * 500); 
}

// 【新增核心算法】：计算当前光团的最终价值 (基础 + 等级) * (1 + 碎片加成 + 故事加成 + 巴别塔通关加成)
function getOrbValue() {
    let base = BASE_ORB_VALUE + gameData.frogValueLevel;
    let fragmentBonus = gameData.collectedFragments.length * 0.01;
    let storyBonus = gameData.completedStories.length * 0.10;
    
    // 获取巴别塔玩法累积的光团加成（百分比转化为小数）
    let babelBonus = (gameData.babelOrbBonus || 0) * 0.01; 
    
    let multiplier = 1.0 + fragmentBonus + storyBonus + babelBonus;
    let finalValue = base * multiplier;
    
    // 如果方向感为负数，获取量减半的惩罚机制
    if (gameData.directionSense < 0) {
        finalValue /= 2;
    }
    
    return finalValue;
}

function saveGame() {
    gameData.lastSaveTime = Date.now(); // 记录保存时的时间戳
    localStorage.setItem('babel_library_save', JSON.stringify(gameData));
}

function initGame() {
    let savedData = localStorage.getItem('babel_library_save');
    let offlineEarnings = 0;
    if (savedData) {
        gameData = JSON.parse(savedData);
        if (!gameData.unlockedFloors) gameData.unlockedFloors = [1];
        if (!gameData.babelFloor) { gameData.babelFloor = 1; gameData.babelPlayerCards = []; gameData.babelEnemyCards = []; }
        if (!gameData.unlockedBooks) gameData.unlockedBooks = [];
        if (!gameData.collectedFragments) gameData.collectedFragments = [];
        if (!gameData.achievedEndings) gameData.achievedEndings = [];
        if (!gameData.completedStories) gameData.completedStories = [];
        // 跨周目数据兼容
        if (!gameData.collectionFragments) gameData.collectionFragments = [];
        if (!gameData.collectionStories) gameData.collectionStories = [];
        if (!gameData.resetCount) gameData.resetCount = 0;
        
// 初始化分离的升级次数计数器（兼容老存档）
        if (gameData.valueUpgradeCount === undefined) {
            gameData.valueUpgradeCount = Math.max(0, Math.floor(gameData.frogValueLevel || 0));
        }
        if (gameData.speedUpgradeCount === undefined) {
            gameData.speedUpgradeCount = Math.max(0, Math.floor(gameData.frogSpeedLevel || 0));
        }

// 【新增】：计算离线收益
        if (gameData.lastSaveTime) {
            let now = Date.now();
            let offlineMs = now - gameData.lastSaveTime;
            if (offlineMs > 60000) { // 离开超过1分钟才计算
                let maxOfflineMs = Math.min(offlineMs, 28800000); // 最多计算8小时的离线收益 (28,800,000 毫秒)
                let effectiveInterval = Math.max(2500, getFrogInterval());
                let collectTimes = Math.floor(maxOfflineMs / effectiveInterval);
                if (collectTimes > 0) {
                    offlineEarnings = collectTimes * getOrbValue();
                    gameData.directionSense += offlineEarnings;
                }
            }
        }
    } else {
        gameData.valueUpgradeCount = 0;
    }
    
    updateUI();
    setInterval(spawnOrb, 2500);       
    setInterval(frogAutoCollect, 1000); 
    setInterval(saveGame, 5000);        
    
    // 【修改】：使用游戏内专属 UI 弹窗替代原生的 alert 弹窗
    if (offlineEarnings > 0) {
        setTimeout(() => {
            // 将文本注入到弹窗的 p 标签中
            document.getElementById('offline-text').innerText = `欢迎回来！在你离开的这段时间里，\n青蛙在后台默默为你收集了 ${Math.floor(offlineEarnings)} 点方向感。`;
            // 激活遮罩层和弹窗
            document.getElementById('modal-overlay').classList.add('active');
            document.getElementById('modal-offline').classList.add('active');
        }, 1000);
    }
}

// ==============================
// 结局触发系统
// ==============================
function triggerEnding(title, desc) {
    document.getElementById('screen-ending').style.display = 'flex';
    document.getElementById('ending-title').innerText = `【${title}】`;
    document.getElementById('ending-desc').innerText = desc;
    
    if (!gameData.achievedEndings.includes(title)) {
        gameData.achievedEndings.push(title);
        saveGame();
    }
}

// 实时检测结局（迷失、山巅）
function checkImmediateEndings() {
    if (document.getElementById('screen-ending').style.display === 'flex') return;

    // 迷失结局
    if (gameData.directionSense <= -10000) {
        triggerEnding("迷失", "方向感低于 -10,000。你透支了太多的感知，负债的重压将你的意识彻底碾碎，你永远地迷失在了通天塔图书馆的无尽书海之中。");
    } 
    // 山巅结局 (巴别塔到达99层，且解锁全部180本书)
    else if (gameData.babelFloor >= 99 && gameData.unlockedBooks.length >= 180) {
        triggerEnding("山巅", "你完成了巴别塔所有的试炼，并翻阅了探索层所有的书籍。通天塔已无秘密，你立于塔顶，俯瞰着世间所有的真理。");
    }
}
function updateUI() {
    document.getElementById('ds-amount').innerText = Math.floor(gameData.directionSense);
    
    let speedCost = getSpeedCost();
    let valueCost = getValueCost();
    
    document.getElementById('cost-speed').innerText = speedCost;
    document.getElementById('cost-value').innerText = valueCost;

    let valPerOrb = getOrbValue(); 
    let frogIntervalSec = getFrogInterval() / 1000;
    document.getElementById('ds-rate').innerText = (valPerOrb / frogIntervalSec).toFixed(2);

    // 1. 更新速度要求进度文本 (满级计算为10级)
    let currentSpeedLevel = Math.min(10, gameData.frogSpeedLevel);
    document.getElementById('speed-progress').innerText = `${currentSpeedLevel}/10`;

    // 2. 更新“贪婪的青蛙”按钮颜色状态
    let speedBtn = document.getElementById('upg-speed');
    if (gameData.directionSense >= speedCost) {
        speedBtn.className = "upg-btn btn-affordable";
    } else {
        speedBtn.className = "upg-btn btn-unaffordable";
    }

    // 3. 更新“更有营养的食料”按钮状态及前置提示
    let valBtn = document.getElementById('upg-value');
    let reqWarn = document.getElementById('speed-req-warn');
    
    if (getFrogInterval() > 2500) {
        // 速度未达标：按钮变灰，显示红字警告
        valBtn.className = "upg-btn btn-unaffordable";
        reqWarn.style.display = "block";
    } else {
        // 速度达标：隐藏红字警告，再判定资源是否足够
        reqWarn.style.display = "none";
        if (gameData.directionSense >= valueCost) {
            valBtn.className = "upg-btn btn-affordable";
        } else {
            valBtn.className = "upg-btn btn-unaffordable";
        }
    }

    checkImmediateEndings();
}

// ==============================
// 个人中心与回溯按钮逻辑
// ==============================
document.getElementById('btn-personal').onclick = () => {
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('modal-personal').classList.add('active');
    
    document.getElementById('personal-collection-count').innerText = gameData.collectedFragments.length;
    document.getElementById('personal-babel-floor').innerText = gameData.babelFloor;
    document.getElementById('personal-book-count').innerText = gameData.unlockedBooks.length;
};

document.getElementById('btn-backtrack').onclick = () => {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('modal-personal').classList.remove('active');

    let collectedThought = 0;
    let collectedConcept = 0;

    // 遍历核对词条收集进度
    storyData["思考"].forEach(story => {
        story.sentences.forEach(txt => { if (gameData.collectedFragments.includes(txt)) collectedThought++; });
    });
    storyData["构想"].forEach(story => {
        story.sentences.forEach(txt => { if (gameData.collectedFragments.includes(txt)) collectedConcept++; });
    });

    // 回溯判定结局
    if (collectedThought >= 20) {
        triggerEnding("挑剔", "你还原了所有关于『思考』的故事并选择了回溯。带着对理性的执念，你重新开始了这个轮回。");
    } else if (collectedConcept >= 20) {
        triggerEnding("理想", "你还原了所有关于『构想』的故事并选择了回溯。带着对未来的愿景，你重新开始了这个轮回。");
    } else {
        triggerEnding("放弃", "你没有达成任何特定的执念便选择了回溯。你放弃了当前的进度，世界在一片虚无中重启。");
    }
};

// 接受命运，执行世界重置
// 接受命运，执行世界重置
document.getElementById('btn-reset-game').onclick = () => {
    let keptEndings = gameData.achievedEndings || [];
    let prevReset = gameData.resetCount || 0;
    
    // 【核心机制】：将本周目的收集进度合并入永久收藏库
    let mergedFragments = [...new Set([...(gameData.collectionFragments || []), ...gameData.collectedFragments])];
    let mergedStories = [...new Set([...(gameData.collectionStories || []), ...gameData.completedStories])];
    
    localStorage.removeItem('babel_library_save');
gameData = {
        directionSense: 0, frogSpeedLevel: 0, frogValueLevel: 0,
        valueUpgradeCount: 0, // 重置食料升级次数
        speedUpgradeCount: 0, // 重置速度升级次数
        unlockedFloors: [1], unlockedBooks: [], babelFloor: 1,
        babelPlayerCards: [], babelEnemyCards: [],
        collectedFragments: [], completedStories: [], // 周目进度归零
        achievedEndings: keptEndings, // 永久保留
        collectionFragments: mergedFragments, // 永久保留
        collectionStories: mergedStories, // 永久保留
        resetCount: prevReset + 1 // 轮回次数+1
    };
    saveGame();
    location.reload(); // 刷新网页，重头开始
};

// ==============================
// 游戏玩法：光团与青蛙
// ==============================
function spawnOrb() {
    let currentOrbs = document.querySelectorAll('.orb');
    if (currentOrbs.length >= MAX_ORBS_ON_SCREEN) return;

    let homePage = document.getElementById('page-home');
    let orb = document.createElement('div');
    orb.className = 'orb';

    let x = Math.random() * 80 + 10; 
    let y = Math.random() * 60 + 10;
    orb.style.left = x + '%';
    orb.style.top = y + '%';

    setTimeout(() => orb.style.opacity = 1, 50);

    orb.onclick = function() {
        orb.remove();
        gameData.directionSense += getOrbValue(); // 调用新算法
        updateUI();
    };

    homePage.appendChild(orb);
    setTimeout(() => {
        if (orb.parentNode) {
            orb.style.opacity = 0; 
            setTimeout(() => { if (orb.parentNode) orb.remove(); }, 1000); 
        }
    }, 6000);
}

let lastCollectTime = 0;
function frogAutoCollect() {
    let now = Date.now();
    let interval = getFrogInterval(); // 调用新的统一间隔函数

    if (now - lastCollectTime > interval) {
        let orbs = document.querySelectorAll('.orb');
        if (orbs.length > 0) {
            orbs[0].remove();
            gameData.directionSense += getOrbValue(); 
            updateUI();
            lastCollectTime = now;
            
            // 继承第一轮优化的青蛙弹跳动画
            let frogElement = document.getElementById('frog');
            if (frogElement) {
                frogElement.classList.add('frog-bounce');
                setTimeout(() => {
                    frogElement.classList.remove('frog-bounce');
                }, 300);
            }
        }
    }
}

// ==============================
// 界面交互
// ==============================
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = function() {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        document.getElementById(this.dataset.target).classList.add('active');
    };
});

const overlay = document.getElementById('modal-overlay');
const frogModal = document.getElementById('modal-frog');

document.getElementById('frog').onclick = () => {
    overlay.classList.add('active');
    frogModal.classList.add('active');
    updateUI();
};

document.querySelectorAll('.close-btn').forEach(btn => {
    btn.onclick = function() {
        overlay.classList.remove('active');
        document.getElementById(this.dataset.target).classList.remove('active');
    };
});

document.getElementById('upg-speed').onclick = () => {
    let cost = getSpeedCost();
    if (gameData.directionSense >= cost) {
        gameData.directionSense -= cost;
        gameData.frogSpeedLevel++;
        gameData.speedUpgradeCount = (gameData.speedUpgradeCount || 0) + 1; // 单独增加速度购买成本计数
        updateUI();
    }
};

document.getElementById('upg-value').onclick = () => {
    // 强制限制条件：只有当收集速度达到 2500ms 或更短时才能触发购买逻辑
    if (getFrogInterval() > 2500) return;
    
    let cost = getValueCost();
    if (gameData.directionSense >= cost) {
        gameData.directionSense -= cost;
        gameData.frogValueLevel++;
        gameData.valueUpgradeCount = (gameData.valueUpgradeCount || 0) + 1; // 【新增】单独增加成本计数
        gameData.frogSpeedLevel = 0; 
        updateUI();
    }
};

initGame();
// 处理进入游戏界面的消失逻辑
document.getElementById('btn-enter-game').onclick = function() {
    const entryScreen = document.getElementById('entry-screen');
    entryScreen.style.opacity = '0';
    // 等待淡出动画完成后彻底移除元素，防止挡住交互
    setTimeout(() => {
        entryScreen.style.display = 'none';
    }, 1000);
};