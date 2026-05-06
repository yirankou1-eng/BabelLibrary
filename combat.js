// ==============================
// 1. 卡牌数据库
// ==============================
const cardDatabase = [
    { id: 'education', name: '教育', desc: '造成 1.0 伤害，下次造成伤害额外触发一次连击。' },
    { id: 'creation', name: '创造', desc: '造成 2.0 伤害，使敌方下次攻击造成伤害减去 1.0。' },
    { id: 'research', name: '研究', desc: '无效果。累计使用三次后对敌方造成 10.0 伤害。' },
    { id: 'combat', name: '战斗', desc: '造成 3.0 伤害。' },
    { id: 'crime', name: '犯罪', desc: '造成 4.0 伤害，下次自己受到的伤害增加 1.0。' },
    { id: 'study', name: '学习', desc: '造成 1.0 伤害，免疫下次受到的伤害并使下次自己的伤害提升 1.0。 (冷却 1 回合)' },
    { id: 'pleasure', name: '享乐', desc: '恢复 5.0 生命。' },
    { id: 'rule', name: '统治', desc: '造成 1.0 伤害，敌人此回合将被跳过。 (冷却 1 回合)' },
    { id: 'faith', name: '信仰', desc: '【被动】若被发到此牌，初始生命翻倍。' },
    { id: 'service', name: '服务', desc: '使用后的四个回合内，每个回合额外对敌人造成 1.0 伤害。' }
];

// ==============================
// 2. 状态机与全局变量
// ==============================
function createEntity(name, maxHp) {
    return {
        name: name, hp: maxHp, maxHp: maxHp, hand: [],
        nextDamageBoost: 0, nextDamageReduction: 0, nextDamageTakenExtra: 0,
        isImmuneNext: false, duplicateNextDamage: false, skipNextTurn: false,
        researchCount: 0, researchTriggered: false, 
        serviceStacks: [], // 修改点：将单个数值替换为数组，用于存放多个倒计时
        tempAtkBuff: 0, tempDefBuff: 0,
        cooldowns: { study: 0, rule: 0 } 
    };
}

let battleState = { active: false, player: null, enemy: null, turnCount: 0 };
let currentBattleType = 'card'; 
let diceState = { playerWins: 0, enemyWins: 0 };
let isTurnProcessing = false; // 修改点：新增回合状态锁

// ==============================
// 联机模式专用全局变量
// ==============================
let isMultiplayer = false;    // 是否处于联机模式
let peer = null;              // 本地Peer网络实例
let peerConn = null;          // 与对手的网络连接实例
let myTempId = "";            // 我的临时ID
let myNickname = "";          // 我的昵称
let oppNickname = "对手";      // 对手昵称
let isMyTurn = false;         // 当前是否是我的回合
let isHost = false;           // 是否是房主(决定谁先手)
let multiplayerTimer = null;  // 30秒倒计时器
let multiplayerTimeLeft = 30; // 剩余秒数

function logBattle(message, color = "#aaa") {
    const logBox = document.getElementById('battle-log');
    logBox.innerHTML += `<div style="color: ${color}; margin-bottom: 4px;">${message}</div>`;
    logBox.scrollTop = logBox.scrollHeight;
}

function updateHPUI() {
    if (!battleState.active) return;
    document.getElementById('player-hp').innerText = battleState.player.hp.toFixed(1);
    document.getElementById('player-max-hp').innerText = battleState.player.maxHp.toFixed(1);
    document.getElementById('player-hp-fill').style.width = Math.max(0, (battleState.player.hp / battleState.player.maxHp) * 100) + '%';
    document.getElementById('enemy-hp').innerText = battleState.enemy.hp.toFixed(1);
    document.getElementById('enemy-max-hp').innerText = battleState.enemy.maxHp.toFixed(1);
    document.getElementById('enemy-hp-fill').style.width = Math.max(0, (battleState.enemy.hp / battleState.enemy.maxHp) * 100) + '%';
}

function dealDamage(source, target, baseAmount) {
    let finalDamage = baseAmount;
    if (source.nextDamageBoost > 0) { finalDamage += source.nextDamageBoost; logBattle(`【增益】伤害提升 ${source.nextDamageBoost.toFixed(1)}！`, "#ffd700"); source.nextDamageBoost = 0; }
    if (target.isImmuneNext) {
        finalDamage = 0; logBattle(`【护盾】免疫伤害！`, "#a6e3e9"); target.isImmuneNext = false;
    } else {
        if (target.nextDamageReduction > 0) { finalDamage = Math.max(0, finalDamage - target.nextDamageReduction); target.nextDamageReduction = 0; }
        if (target.nextDamageTakenExtra > 0) { finalDamage += target.nextDamageTakenExtra; target.nextDamageTakenExtra = 0; }
    }
    target.hp = Math.max(0, target.hp - finalDamage);
    if (finalDamage > 0) logBattle(`${target.name} 受到了 ${finalDamage.toFixed(1)} 点伤害。`, "#ff6b6b");
    if (source.duplicateNextDamage && finalDamage > 0) { source.duplicateNextDamage = false; logBattle(`【连击】二次打击！`, "#ffd700"); dealDamage(source, target, finalDamage); }
}

// ==============================
// 3. 楼层与路由分配
// ==============================
function startNewBattle() {
    document.getElementById('btn-start-battle').style.display = 'none';
    document.getElementById('battle-log').innerHTML = '';
    battleState.turnCount = 1;
    battleState.active = true;

    logBattle(`【第 ${gameData.babelFloor} 层遭遇战开始】`, "#fff");

    // 检查并锁定本层的玩法，写入存档防止刷新重置
    if (!gameData.babelChallengeType) {
        gameData.babelChallengeType = Math.random() < 0.75 ? 'card' : 'dice';
        saveGame();
    }
    currentBattleType = gameData.babelChallengeType;

    document.getElementById('player-hand').style.display = 'none';
    document.getElementById('action-dice').style.display = 'none';
    document.getElementById('action-typing').style.display = 'none'; 

const enemyBaseHp = Math.floor((Math.random() * 7.1 + 8.0) * 10) / 10;
    battleState.player = createEntity("你", 10.0);
    battleState.enemy = createEntity("无序者", currentBattleType === 'card' ? enemyBaseHp : 99.9);

    // ==============================
    // 以下为新增的头像切换逻辑
    // ==============================
    const enemyAvatar = document.getElementById('enemy-avatar');
    if (enemyAvatar) {
        enemyAvatar.style.display = 'inline-block'; // 让头像显示出来
        if (currentBattleType === 'card') {
            // 请把引号里的字改成你准备好的卡牌无序者图片的名字（注意带上.jpg后缀）
            enemyAvatar.src = 'card-enemy.jpg'; 
        } else if (currentBattleType === 'dice') {
            // 请把引号里的字改成你准备好的骰子无序者图片的名字（注意带上.jpg后缀）
            enemyAvatar.src = 'dice-enemy.jpg'; 
        }
    }
    // ==============================

    if (currentBattleType === 'card') {
        document.getElementById('player-hand').style.display = 'flex';
        logBattle("本层规则：【命运卡牌】");
        initCardBattle();
    } else if (currentBattleType === 'dice') {
        document.getElementById('action-dice').style.display = 'block';
        diceState = { playerWins: 0, enemyWins: 0, draws: 0 };
        document.getElementById('dice-score-player').innerText = '0';
        document.getElementById('dice-score-enemy').innerText = '0';
        document.getElementById('dice-enemy').innerText = '?';
        document.getElementById('dice-player').innerText = '?';
        
        // 【新增】：根据楼层计算最小注入金额并显示（随楼层增长，但保持在合理范围）
        let minBet = Math.floor(10 + gameData.babelFloor * 2.5);
        let limitDisplay = document.getElementById('dice-bet-limit');
        if(limitDisplay) limitDisplay.innerText = `当前层最低注入: ${minBet}`;
        let betInput = document.getElementById('dice-bet-input');
        if(betInput) betInput.value = '';
        
        logBattle("本层规则：【命运骰子】三局两胜，率先获得2胜者抹杀对方！", "#ffd700");
    }
    updateHPUI();
}

// ==============================
// 玩法 A：卡牌系统 
// ==============================
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; }
    return array;
}

function initCardBattle() {
    if (gameData.babelPlayerCards.length === 0) {
        let pDeck = shuffle([...cardDatabase]).slice(0, 3);
        let eDeck = shuffle([...cardDatabase]).slice(0, 3);
        gameData.babelPlayerCards = pDeck.map(c => c.id);
        gameData.babelEnemyCards = eDeck.map(c => c.id);
        saveGame();
    }
    battleState.player.hand = gameData.babelPlayerCards.map(id => cardDatabase.find(c => c.id === id));
    battleState.enemy.hand = gameData.babelEnemyCards.map(id => cardDatabase.find(c => c.id === id));
    
    if (battleState.player.hand.some(c => c.id === 'faith')) { battleState.player.maxHp *= 2; battleState.player.hp *= 2; }
    if (battleState.enemy.hand.some(c => c.id === 'faith')) { battleState.enemy.maxHp *= 2; battleState.enemy.hp *= 2; }
    renderPlayerHand();
}

function renderPlayerHand() {
    const handContainer = document.getElementById('player-hand');
    handContainer.innerHTML = '';
    battleState.player.hand.forEach((card, index) => {
        let cardEl = document.createElement('div');
        cardEl.className = 'card';
        
        let onCooldown = (card.id === 'study' && battleState.player.cooldowns.study > 0) || 
                         (card.id === 'rule' && battleState.player.cooldowns.rule > 0);
                         
        if (card.id === 'faith' || onCooldown) cardEl.classList.add('disabled');
        
        let cdText = onCooldown ? `<div style="color:#ff6b6b; font-size:12px; font-weight:bold; margin-top:5px;">(冷却中)</div>` : '';
        
        cardEl.innerHTML = `<div class="card-name">${card.name}</div><div class="card-desc">${card.desc}</div>${cdText}${card.id !== 'faith' && !onCooldown ? '<div class="card-btn-plus" onclick="openBuffModal(event)">+</div>' : ''}`;
        
        cardEl.onclick = () => {
            // 【联机修改】如果是联机模式
            if (typeof isMultiplayer !== 'undefined' && isMultiplayer) {
                if (!isMyTurn) {
                    logBattle("等待对手出牌...", "#888");
                    return;
                }
                if (card.id !== 'faith' && !onCooldown) {
                    clearInterval(multiplayerTimer); // 停止自己的30秒倒计时
                    processTurn(index); // 执行本地出牌效果

                    // 发送我的出牌位置和卡牌ID给对手
                    if (typeof peerConn !== 'undefined' && peerConn) {
                        peerConn.send({
                            type: 'PLAY_CARD',
                            cardIndex: index,
                            cardId: card.id
                        });
                    }
                    isMyTurn = false;
                    document.getElementById('multiplayer-status').innerText = "等待对手响应...";
                }
            } else {
                // 原本的单机模式逻辑
                if (card.id !== 'faith' && !onCooldown) processTurn(index);
            }
        };
        handContainer.appendChild(cardEl);
    });
}

// 计算当前楼层的强化成本
function getBuffCost() {
    return Math.floor(50 * Math.pow(1.15, gameData.babelFloor));
}

function openBuffModal(event) {
    event.stopPropagation();
    const cost = getBuffCost();
    // 增益量设定为固定值
    const atkPlus = 5.0;
    const defPlus = 2.0;

    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('modal-card-buff').classList.add('active');
    
    document.getElementById('buff-cost-display').innerText = cost.toLocaleString();
    document.getElementById('buff-preview-atk').innerText = atkPlus.toFixed(1);
    document.getElementById('buff-preview-def').innerText = defPlus.toFixed(1);
    
    const warn = document.getElementById('buff-warning');
    const confirmBtn = document.getElementById('btn-confirm-buff');
    if (gameData.directionSense < cost) {
        warn.innerText = "方向感不足。";
        confirmBtn.style.opacity = "0.5";
        confirmBtn.disabled = true;
    } else {
        warn.innerText = "";
        confirmBtn.style.opacity = "1";
        confirmBtn.disabled = false;
    }
}

document.getElementById('btn-confirm-buff').onclick = () => {
    const cost = getBuffCost();
    if (gameData.directionSense < cost) return;

    gameData.directionSense -= cost;
    if (typeof saveGame === 'function') saveGame(); 

    // 应用固定增益
    battleState.player.tempAtkBuff = 5.0;
    battleState.player.tempDefBuff = 2.0;

    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('modal-card-buff').classList.remove('active');
    logBattle(`消耗了 ${cost.toLocaleString()} 方向感，已完成引导。`, "#a6e3e9");
    
    if (typeof updateUI === 'function') updateUI();
};

function executeCard(card, caster, target) {
    let atkBuff = caster.tempAtkBuff || 0; let defBuff = caster.tempDefBuff || 0;
    caster.tempAtkBuff = 0; caster.tempDefBuff = 0;
    logBattle(`[回合 ${battleState.turnCount}] ${caster.name} 打出了 <strong style="color:#fff;">${card.name}</strong>！`);
    
    switch (card.id) {
        case 'education': dealDamage(caster, target, 1.0 + atkBuff); caster.duplicateNextDamage = true; caster.nextDamageReduction += defBuff; break;
        case 'creation': dealDamage(caster, target, 2.0 + atkBuff); target.nextDamageReduction += (1.0 + defBuff); break;
        case 'research': caster.researchCount++; if (caster.researchCount >= 3 && !caster.researchTriggered) { logBattle(`【研究爆发】`, "#ff00ff"); dealDamage(caster, target, 10.0 + atkBuff); caster.researchTriggered = true; } caster.nextDamageReduction += defBuff; break;
        case 'combat': dealDamage(caster, target, 3.0 + atkBuff); caster.nextDamageReduction += defBuff; break;
        case 'crime': dealDamage(caster, target, 4.0 + atkBuff); caster.nextDamageTakenExtra += 1.0; caster.nextDamageReduction += defBuff; break;
        case 'study': dealDamage(caster, target, 1.0 + atkBuff); caster.isImmuneNext = true; caster.nextDamageBoost += 1.0; caster.nextDamageReduction += defBuff; caster.cooldowns.study = 2; break; 
        case 'pleasure': 
            // 联机模式回复4.0，单机回复5.0
            let healValue = (typeof isMultiplayer !== 'undefined' && isMultiplayer) ? 4.0 : 5.0;
            caster.hp = Math.min(caster.maxHp, caster.hp + healValue + defBuff); 
            logBattle(`${caster.name} 恢复了 ${healValue.toFixed(1)} 生命。`, "#a6e3e9"); 
            dealDamage(caster, target, atkBuff); 
            break;
        case 'rule': dealDamage(caster, target, 1.0 + atkBuff); target.skipNextTurn = true; caster.nextDamageReduction += defBuff; caster.cooldowns.rule = 2; break;
        case 'faith': break;
        case 'service': caster.serviceStacks.push(4); dealDamage(caster, target, atkBuff); caster.nextDamageReduction += defBuff; break; // 修改点：推入4回合的计数
    }
}

function processTurn(playerCardIndex) {
    if (!battleState.active) return;
    if (isTurnProcessing) return; // 修改点：如果回合正在结算中，拦截一切额外点击

    // 【联机修改】如果处于联机模式且不是我的回合，拦截操作
    if (typeof isMultiplayer !== 'undefined' && isMultiplayer && !isMyTurn) {
        logBattle("等待对手出牌...", "#888");
        return;
    }

    // 【联机修改】停止倒计时
    if (typeof isMultiplayer !== 'undefined' && isMultiplayer) {
        clearInterval(multiplayerTimer);
    }

    isTurnProcessing = true; // 锁定回合
    
    const p = battleState.player; const e = battleState.enemy;
    
    if (p.skipNextTurn) {
        logBattle(`【统治生效】你被跳过回合！无法行动！`, "#ff6b6b");
        p.skipNextTurn = false;
    } else {
        executeCard(p.hand[playerCardIndex], p, e);
    }
    
    // 修改点：结算玩家的服务牌（支持多层叠加计算）
    if (p.serviceStacks.length > 0) { 
        let totalDamage = p.serviceStacks.length * 1.0;
        logBattle(`【服务】造成 ${totalDamage.toFixed(1)} 持续伤害（叠加 ${p.serviceStacks.length} 层）。`, "#ff8c00"); 
        e.hp = Math.max(0, e.hp - totalDamage); 
        p.serviceStacks = p.serviceStacks.map(turns => turns - 1).filter(turns => turns > 0);
    }
    
    if (checkWinCondition()) {
        isTurnProcessing = false;
        return;
    }

    // 【联机修改】如果是联机模式，拦截单机AI出牌，并同步出牌状态
    if (typeof isMultiplayer !== 'undefined' && isMultiplayer) {
        const p = battleState.player;
        const e = battleState.enemy;

        // 发送我的出牌位置和卡牌ID给对手
        if (typeof peerConn !== 'undefined' && peerConn) {
            peerConn.send({
                type: 'PLAY_CARD',
                cardIndex: playerCardIndex,
                cardId: p.hand[playerCardIndex].id
            });
        }
        isMyTurn = false;
        document.getElementById('multiplayer-status').innerText = "等待对手响应...";

        // 统一在本地对双方的冷却进行扣减并刷新 UI
        p.cooldowns.study = Math.max(0, p.cooldowns.study - 1); 
        p.cooldowns.rule = Math.max(0, p.cooldowns.rule - 1);
        e.cooldowns.study = Math.max(0, e.cooldowns.study - 1); 
        e.cooldowns.rule = Math.max(0, e.cooldowns.rule - 1);
        
        battleState.turnCount++; 
        updateHPUI();
        if (battleState.active) renderPlayerHand();
        isTurnProcessing = false; // 彻底解除锁定
        return; // 直接拦截，不运行下方的单机敌人 AI 逻辑
    }

    // 内部函数：统一下发回合末的冷却结算并解锁
    const finishTurn = () => {
        setTimeout(() => {
            p.cooldowns.study = Math.max(0, p.cooldowns.study - 1); p.cooldowns.rule = Math.max(0, p.cooldowns.rule - 1);
            e.cooldowns.study = Math.max(0, e.cooldowns.study - 1); e.cooldowns.rule = Math.max(0, e.cooldowns.rule - 1);
            battleState.turnCount++; updateHPUI(); 
            if (battleState.active) renderPlayerHand(); 
            isTurnProcessing = false; // 彻底解除锁定，允许下一次点击
        }, 600);
    };

    if (e.skipNextTurn) {
        logBattle(`【统治生效】无序者被跳过回合！`, "#a6e3e9"); e.skipNextTurn = false;
        finishTurn();
    } else {
        let playableIndices = e.hand.map((c, i) => {
            if (c.id === 'faith') return -1;
            if (c.id === 'study' && e.cooldowns.study > 0) return -1;
            if (c.id === 'rule' && e.cooldowns.rule > 0) return -1;
            return i;
        }).filter(i => i !== -1);
        
        if (playableIndices.length > 0) {
            let enemyCard = e.hand[playableIndices[Math.floor(Math.random() * playableIndices.length)]];
            setTimeout(() => {
                executeCard(enemyCard, e, p);
                
                // 修改点：结算敌方的服务牌（支持多层）
                if (e.serviceStacks.length > 0) { 
                    let totalDamage = e.serviceStacks.length * 1.0;
                    p.hp = Math.max(0, p.hp - totalDamage); 
                    e.serviceStacks = e.serviceStacks.map(turns => turns - 1).filter(turns => turns > 0);
                }
                
                checkWinCondition(); updateHPUI();
                
                if (!battleState.active) {
                    isTurnProcessing = false;
                    return;
                }
                finishTurn();
            }, 500);
        } else {
            setTimeout(() => { 
                logBattle(`${e.name} 所有可用卡牌均在冷却中，无法行动！`, "#888"); 
                finishTurn();
            }, 500);
        }
    }
}

// ==============================
// 玩法 B：命运骰子
// ==============================
document.getElementById('btn-roll-dice').onclick = () => {
    if(!battleState.active || currentBattleType !== 'dice') return;
    
    // 检查总回合数是否已达到3局
    let totalRounds = diceState.playerWins + diceState.enemyWins + (diceState.draws || 0);
    if (totalRounds >= 3) return;

    // 获取并校验玩家的押注
    let minBet = Math.floor(10 + gameData.babelFloor * 2.5);
    let betAmount = parseInt(document.getElementById('dice-bet-input').value) || 0;
    
    if (betAmount > 0) {
        if (betAmount < minBet) {
            logBattle(`注入方向感不足，本层至少需要 ${minBet} 点。`, "#ff6b6b");
            return;
        }
        if (gameData.directionSense < betAmount) {
            logBattle(`方向感储备不足。`, "#ff6b6b");
            return;
        }
        // 判定通过，先扣除方向感
        gameData.directionSense -= betAmount;
        if (typeof updateUI === 'function') updateUI();
    }

    // 掷骰子
    let pRoll = Math.floor(Math.random() * 20) + 1; 
    let eRoll = Math.floor(Math.random() * 20) + 1;
    document.getElementById('dice-player').innerText = pRoll; 
    document.getElementById('dice-enemy').innerText = eRoll;
    
    // 过场动画效果：通过屏幕外边框发光来提示盈亏
    const diceScreen = document.getElementById('action-dice');
    diceScreen.style.transition = "box-shadow 0.3s";
    
    if (pRoll > eRoll) { 
        diceState.playerWins++; 
        let winText = `【本局获胜】你掷出了 ${pRoll}，碾压了对方的 ${eRoll}！`;
        if (betAmount > 0) {
            let winAmount = betAmount * 2;
            gameData.directionSense += winAmount;
            winText += ` 真理回馈了 ${winAmount} 额外方向感！`;
            diceScreen.style.boxShadow = "0 0 30px #a6e3e9";
        }
        logBattle(winText, "#a6e3e9"); 
    }
    else if (eRoll > pRoll) { 
        diceState.enemyWins++; 
        let loseText = `【本局落败】无序者掷出了 ${eRoll}，压制了你的 ${pRoll}！`;
        if (betAmount > 0) {
            loseText += ` 注入的 ${betAmount} 方向感已化为泡影。`;
            diceScreen.style.boxShadow = "0 0 30px #ff6b6b";
        }
        logBattle(loseText, "#ff6b6b"); 
    }
    else { 
        diceState.draws = (diceState.draws || 0) + 1;
        let drawText = `【平局】双方均掷出 ${pRoll}，力量互相抵消。`;
        if (betAmount > 0) {
            gameData.directionSense += betAmount;
            drawText += ` 注入的 ${betAmount} 方向感已安全退回。`;
            diceScreen.style.boxShadow = "0 0 30px #ffd700";
        }
        logBattle(drawText, "#ffd700"); 
    }
    
    // 0.5秒后清除发光动画
    setTimeout(() => { diceScreen.style.boxShadow = "none"; }, 500);
    if (typeof updateUI === 'function') updateUI();
    
    document.getElementById('dice-score-player').innerText = diceState.playerWins;
    document.getElementById('dice-score-enemy').innerText = diceState.enemyWins;
    
    // 重新计算回合
    totalRounds = diceState.playerWins + diceState.enemyWins + (diceState.draws || 0);
    
    // 三局两胜制大结算判定
    if (diceState.playerWins >= 2) { 
        logBattle("=== 命运骰子：你赢得了对决！ ===", "#a6e3e9"); 
        battleState.enemy.hp = 0; // 敌方死亡，触发胜利的 3% 光团奖励逻辑
        checkWinCondition(); 
    }
    else if (diceState.enemyWins >= 2 || (totalRounds >= 3 && diceState.playerWins < 2)) { 
        // 满3局但玩家未达到2胜，也一律算失败
        logBattle("=== 命运骰子：无序者吞噬了你！ ===", "#ff6b6b"); 
        battleState.player.hp = 0; // 己方死亡
        checkWinCondition(); 
    }
    updateHPUI();
};


// ==============================
// 通用结算逻辑
// ==============================
function checkWinCondition() {
    updateHPUI();
    
    // 联机结算逻辑：不影响单机层数，提供退出和再来一把选项
    if (typeof isMultiplayer !== 'undefined' && isMultiplayer) {
        if (battleState.enemy.hp <= 0 || battleState.player.hp <= 0) {
            battleState.active = false;
            clearInterval(multiplayerTimer);
            let isWin = battleState.enemy.hp <= 0;
            logBattle(`========= 联机对决结束：${isWin ? "胜利" : "败北"} =========`, isWin ? "#a6e3e9" : "#ff6b6b");
            
            const handContainer = document.getElementById('player-hand');
            handContainer.innerHTML = `
                <div style="display:flex; gap:20px; justify-content:center; width:100%;">
                    <button id="rematch-confirm-btn" class="battle-btn" style="background:#a6e3e9; color:#000;">再来一把</button>
                    <button onclick="location.reload()" class="battle-btn" style="background:#444;">退出联机</button>
                </div>
            `;
            
            document.getElementById('rematch-confirm-btn').onclick = () => {
                peerConn.send({ type: 'REMATCH_REQUEST' });
                document.getElementById('rematch-confirm-btn').innerText = "等待对手...";
                document.getElementById('rematch-confirm-btn').disabled = true;
            };
            return true;
        }
        return false;
    }

    // 单机模式结算逻辑（完整版，包含光团奖励与层数推进）
    if (battleState.enemy.hp <= 0) {
        battleState.active = false;
        logBattle("========= 战斗结束 =========", "#a6e3e9");
        document.getElementById('player-hand').innerHTML = '';
        document.getElementById('btn-start-battle').style.display = 'block';
        
        if (!gameData.babelOrbBonus) gameData.babelOrbBonus = 0;
        let bonusGained = 0;
        if (currentBattleType === 'card') {
            gameData.babelOrbBonus += 5;
            bonusGained = 5;
        } else if (currentBattleType === 'dice') {
            gameData.babelOrbBonus += 3;
            bonusGained = 3;
        }
        
        if (typeof showMessageModal === 'function') {
            showMessageModal("试炼通过", `你成功通关了本层！\n受到真理的馈赠，首页所有光团的方向感含量永久增加了 ${bonusGained}%！`);
        } else {
            alert(`试炼通过！\n受到真理的馈赠，首页所有光团的方向感含量永久增加了 ${bonusGained}%！`);
        }
        
        if (gameData.babelFloor >= 99) {
            document.getElementById('btn-start-battle').innerText = "已至塔顶";
        } else {
            document.getElementById('btn-start-battle').innerText = "前往更高层";
            gameData.babelFloor++; 
        }
        
        gameData.babelPlayerCards = []; 
        gameData.babelEnemyCards = []; 
        gameData.babelChallengeType = null; 
        if (typeof saveGame === 'function') saveGame();
        return true;
        
    } else if (battleState.player.hp <= 0) {
        battleState.active = false;
        logBattle("========= 失败 =========", "#ff6b6b");
        document.getElementById('player-hand').innerHTML = '';
        document.getElementById('btn-start-battle').style.display = 'block';
        document.getElementById('btn-start-battle').innerText = "重新尝试本层";
        return true;
    }
    
    return false;
}

document.getElementById('btn-start-battle').onclick = startNewBattle;

// ==============================
// 联机模式逻辑控制
// ==============================

// 1. 弹出和关闭窗口
document.getElementById('btn-multiplayer').onclick = () => {
    // 使用 setProperty 和 important 强制顶掉隐藏状态
    document.getElementById('modal-multiplayer').style.setProperty('display', 'flex', 'important');
    initPeer(); // 打开窗口时初始化网络ID
};
const closeMultiplayerBtn = document.getElementById('btn-close-multiplayer') || document.getElementById('btn-force-close-multi');
if (closeMultiplayerBtn) {
    closeMultiplayerBtn.onclick = () => {
        document.getElementById('modal-multiplayer').style.setProperty('display', 'none', 'important');
    };
}

// 2. 初始化网络 ID
// 确保全局有 peer 变量
window.peer = window.peer || null;

window.initPeer = function() {
    if (window.peer) return;

    const statusEl = document.getElementById('multiplayer-status');
    if (statusEl) statusEl.innerText = "正在请求网络 ID...";

    try {
        window.peer = new Peer({
            debug: 2,
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });
    } catch (e) {
        if (statusEl) statusEl.innerText = "网络库加载失败: " + e.message;
        return;
    }

    window.peer.on('open', (id) => {
        // 兼容你可能存在的 myTempId 变量
        if (typeof myTempId !== 'undefined') {
            myTempId = id;
        } else {
            window.myTempId = id;
        }
        
        const idBox = document.getElementById('my-peer-id');
        if (idBox) {
            idBox.innerText = id;
            idBox.onclick = () => {
                navigator.clipboard.writeText(id);
                if (statusEl) statusEl.innerText = "ID 已复制！";
            };
        }
        if (statusEl) {
            statusEl.innerText = "ID 生成成功，请发送给对手...";
            statusEl.style.color = "#00ff88";
        }
    });

    window.peer.on('connection', (conn) => {
        window.isMultiplayer = true; // 【核心开关】：激活你的原生联机逻辑
        if (typeof isMultiplayer !== 'undefined') isMultiplayer = true;
        
        if (typeof isHost !== 'undefined') isHost = true; 
        if (typeof setupConnection === 'function') {
            setupConnection(conn); 
        }
        
        
    });

    window.peer.on('error', (err) => {
        console.error(err);
        if (statusEl) {
            statusEl.innerText = "网络错误: " + err.type;
            statusEl.style.color = "#ff4757";
        }
    });
};

// 3. 主动发起连接
document.getElementById('btn-connect-peer').onclick = () => {
    const targetId = document.getElementById('opponent-id').value.trim();
    if (!targetId) {
        alert("请输入对手的 ID");
        return;
    }
    const conn = peer.connect(targetId);
    isHost = false; // 发起连接者作为从机
    setupConnection(conn);
};

// 4. 设置连接后的数据处理逻辑
// ====================================================
// 联机模式物理隔离与核心接管区 (独立且不可逾越)
// ====================================================

function enterMultiplayerQuarantine() {
    // 1. 强力物理隔离：注入最高优先级 CSS，永久抹除单机干扰 UI
    let style = document.getElementById('mp-quarantine-style');
    if (!style) {
        style = document.createElement('style');
        style.id = 'mp-quarantine-style';
        style.innerHTML = `
            #entry-screen, #btn-start-battle, .card-btn-plus, #enemy-avatar {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.getElementById('modal-multiplayer').style.display = 'none';
    document.getElementById('page-babel').style.display = 'block';

    // 2. 全局状态锁定
    window.isMultiplayer = true;
    if (typeof isMultiplayer !== 'undefined') isMultiplayer = true;

    // 3. 动态函数重定义：彻底剥夺单机代码的结算权
    window.checkWinCondition = function() {
        if (typeof updateHPUI === 'function') updateHPUI();
        if (battleState.enemy.hp <= 0 || battleState.player.hp <= 0) {
            battleState.active = false;
            if (typeof multiplayerTimer !== 'undefined') clearInterval(multiplayerTimer);
            let isWin = battleState.enemy.hp <= 0;
            if (typeof logBattle === 'function') logBattle(`========= 联机对决结束：${isWin ? "胜利" : "败北"} =========`, isWin ? "#a6e3e9" : "#ff6b6b");

            const handContainer = document.getElementById('player-hand');
            if (handContainer) {
                handContainer.innerHTML = `
                    <div style="display:flex; gap:20px; justify-content:center; width:100%; margin-top:20px;">
                        <button id="rematch-confirm-btn" class="battle-btn" style="background:#a6e3e9; color:#000;">再来一把</button>
                        <button onclick="location.reload()" class="battle-btn" style="background:#444;">退出联机</button>
                    </div>
                `;
                document.getElementById('rematch-confirm-btn').onclick = () => {
                    if (window.peerConn) window.peerConn.send({ type: 'REMATCH_REQUEST' });
                    document.getElementById('rematch-confirm-btn').innerText = "等待对手...";
                    document.getElementById('rematch-confirm-btn').disabled = true;
                };
            }
            return true; // 拦截执行，绝对不向下执行任何单机逻辑
        }
        return false;
    };

    // 4. 剥夺单机初始化的执行权，将其变为空函数
    window.startNewBattle = function() { console.log("单机初始化被联机隔离机制拦截"); };
    window.initBattle = function() { console.log("单机初始化被联机隔离机制拦截"); };
}

function startMultiplayerGame() {
    // 强制进入隔离区
    enterMultiplayerQuarantine();

    // 彻底初始化纯净的 30 血底层数据
    battleState.active = true;
    battleState.turnCount = 1;
    battleState.player = { hp: 30.0, maxHp: 30.0, effects: [], serviceStacks: [], cooldowns: { study: 0, rule: 0 } };
    battleState.enemy = { hp: 30.0, maxHp: 30.0, name: window.oppNickname || "神秘对手", effects: [], serviceStacks: [], cooldowns: { study: 0, rule: 0 } };

    document.getElementById('enemy-hand').style.display = 'flex';
    document.getElementById('multiplayer-timer').style.display = 'block';
    document.getElementById('enemy-name').innerText = battleState.enemy.name;

    if (typeof updateHPUI === 'function') updateHPUI();

    // 房主负责发牌
    if (typeof isHost !== 'undefined' && isHost) {
        window.isMyTurn = Math.random() > 0.5;
        if (typeof isMyTurn !== 'undefined') isMyTurn = window.isMyTurn;

        let pHand = Array.from({length: 4}, () => cardDatabase[Math.floor(Math.random() * cardDatabase.length)]);
        let eHand = Array.from({length: 4}, () => cardDatabase[Math.floor(Math.random() * cardDatabase.length)]);

        if (window.peerConn) {
            window.peerConn.send({
                type: 'START_GAME',
                isYourTurn: !isMyTurn,
                playerHand: eHand,
                enemyHand: pHand,
                oppNickname: window.myNickname || "房主"
            });
        }

        if (typeof renderMultiplayerBattle === 'function') renderMultiplayerBattle(pHand, eHand);
        if (window.isMyTurn && typeof startTurnTimer === 'function') startTurnTimer();
    }
}

function setupConnection(conn) {
    window.peerConn = conn;
    const statusEl = document.getElementById('multiplayer-status');

    window.peerConn.on('open', () => {
        if (statusEl) statusEl.innerText = "连接已建立！正在交换昵称...";
        const nameInput = document.getElementById('my-nickname');
        window.myNickname = nameInput ? nameInput.value.trim() || "探求者" : "探求者";
        window.peerConn.send({ type: 'HANDSHAKE', nickname: window.myNickname });
    });

    window.peerConn.on('data', (data) => {
        if (typeof handlePeerData === 'function') handlePeerData(data);
    });

    window.peerConn.on('close', () => {
        alert("网络通路已断开");
        location.reload();
    });
}

function handlePeerData(data) {
    const p = battleState.player;
    const e = battleState.enemy;

    if (data.type === 'HANDSHAKE') {
        window.oppNickname = data.nickname;
        const statusEl = document.getElementById('multiplayer-status');
        if (statusEl) statusEl.innerText = "对手已就绪: " + window.oppNickname;

        if (typeof isHost !== 'undefined' && isHost) {
            enterMultiplayerQuarantine(); // 房主立即进入物理隔离
            setTimeout(() => startMultiplayerGame(), 1000);
        }
    } else if (data.type === 'START_GAME') {
        window.oppNickname = data.oppNickname;
        window.isMyTurn = data.isYourTurn;
        if (typeof isMyTurn !== 'undefined') isMyTurn = window.isMyTurn;

        enterMultiplayerQuarantine(); // 客机立即进入物理隔离

        // 客机彻底初始化纯净数据
        battleState.active = true;
        battleState.turnCount = 1;
        battleState.player = { hp: 30.0, maxHp: 30.0, hand: data.playerHand, effects: [], serviceStacks: [], cooldowns: { study: 0, rule: 0 } };
        battleState.enemy = { hp: 30.0, maxHp: 30.0, name: window.oppNickname, hand: data.enemyHand, effects: [], serviceStacks: [], cooldowns: { study: 0, rule: 0 } };

        document.getElementById('enemy-hand').style.display = 'flex';
        document.getElementById('multiplayer-timer').style.display = 'block';
        document.getElementById('enemy-name').innerText = window.oppNickname;

        if (typeof updateHPUI === 'function') updateHPUI();
        if (typeof renderMultiplayerBattle === 'function') renderMultiplayerBattle(data.playerHand, data.enemyHand);
        if (window.isMyTurn && typeof startTurnTimer === 'function') startTurnTimer();

    } else if (data.type === 'PLAY_CARD') {
        const enemyHandContainer = document.getElementById('enemy-hand');
        if (enemyHandContainer && enemyHandContainer.children[data.cardIndex]) {
            enemyHandContainer.children[data.cardIndex].style.border = "2px solid #ff4757";
            setTimeout(() => { enemyHandContainer.children[data.cardIndex].remove(); }, 500);
        }

        setTimeout(() => {
            const card = typeof cardDatabase !== 'undefined' ? cardDatabase.find(c => c.id === data.cardId) : null;
            if (!card) return;

            if (e.skipNextTurn) {
                if (typeof logBattle === 'function') logBattle(`【统治生效】${e.name} 被跳过回合！无法行动！`, "#ff6b6b");
                e.skipNextTurn = false;
            } else {
                if (typeof executeCard === 'function') executeCard(card, e, p);
            }

            if (e.serviceStacks.length > 0) {
                let totalDamage = e.serviceStacks.length * 1.0;
                if (typeof logBattle === 'function') logBattle(`【服务】造成 ${totalDamage.toFixed(1)} 持续伤害。`, "#ff8c00");
                p.hp = Math.max(0, p.hp - totalDamage);
                e.serviceStacks = e.serviceStacks.map(turns => turns - 1).filter(turns => turns > 0);
            }

            if (typeof updateHPUI === 'function') updateHPUI();

            if (typeof checkWinCondition === 'function' && !checkWinCondition()) {
                p.cooldowns.study = Math.max(0, p.cooldowns.study - 1); 
                p.cooldowns.rule = Math.max(0, p.cooldowns.rule - 1);
                e.cooldowns.study = Math.max(0, e.cooldowns.study - 1); 
                e.cooldowns.rule = Math.max(0, e.cooldowns.rule - 1);

                battleState.turnCount++;
                if (battleState.active && typeof renderPlayerHand === 'function') renderPlayerHand();

                if (battleState.turnCount % 3 === 0 && typeof isHost !== 'undefined' && isHost) {
                    if (typeof redealCards === 'function') redealCards(); 
                } else if (battleState.turnCount % 3 !== 0) {
                    window.isMyTurn = true;
                    if (typeof isMyTurn !== 'undefined') isMyTurn = window.isMyTurn;
                    if (typeof isTurnProcessing !== 'undefined') isTurnProcessing = false;
                    if (typeof startTurnTimer === 'function') startTurnTimer();
                    const statusEl = document.getElementById('multiplayer-status');
                    if (statusEl) statusEl.innerText = "轮到你了！";
                }
            }
        }, 800);
    } else if (data.type === 'REDEAL_CARDS') {
        battleState.player.hand = data.playerHand;
        battleState.enemy.hand = data.enemyHand;
        if (typeof renderMultiplayerBattle === 'function') renderMultiplayerBattle(data.playerHand, data.enemyHand);
        window.isMyTurn = data.isYourTurn;
        if (typeof isMyTurn !== 'undefined') isMyTurn = window.isMyTurn;
        if (typeof isTurnProcessing !== 'undefined') isTurnProcessing = false;
        if (window.isMyTurn && typeof startTurnTimer === 'function') startTurnTimer();
    } else if (data.type === 'REMATCH_REQUEST') {
        if (confirm((window.oppNickname || "对手") + " 邀请你再来一把，是否接受？")) {
            if (window.peerConn) window.peerConn.send({ type: 'REMATCH_ACCEPT' });
            startMultiplayerGame();
        }
    } else if (data.type === 'REMATCH_ACCEPT') {
        startMultiplayerGame();
    }
}

// 7. 渲染联机画面
function renderMultiplayerBattle(pHand, eHand) {
    // 更新血量条和名字
    document.getElementById('enemy-name').innerText = battleState.enemy.name;
    updateBattleUI(); 
    
    // 渲染自己的手牌
    const pContainer = document.getElementById('player-hand');
    pContainer.innerHTML = '';
    pHand.forEach((card, index) => {
        const cardEl = createCardElement(card, index, true);
        pContainer.appendChild(cardEl);
    });

    // 渲染对方的手牌 (透明度稍低)
    const eContainer = document.getElementById('enemy-hand');
    eContainer.innerHTML = '';
    eHand.forEach(card => {
        const div = document.createElement('div');
        div.className = 'card-item';
        div.style.opacity = '0.6';
        div.style.transform = 'scale(0.8)';
        div.innerHTML = `<div class="card-name">${card.name}</div>`;
        eContainer.appendChild(div);
    });
}

// 8. 倒计时逻辑
function startTurnTimer() {
    clearInterval(multiplayerTimer);
    multiplayerTimeLeft = 30;
    const timerEl = document.getElementById('multiplayer-timer');
    
    multiplayerTimer = setInterval(() => {
        multiplayerTimeLeft--;
        timerEl.innerText = `剩余时间: ${multiplayerTimeLeft}s`;
        
        if (multiplayerTimeLeft <= 0) {
            clearInterval(multiplayerTimer);
            if (isMyTurn) autoPlayCard(); // 超时自动出牌
        }
    }, 1000);
}

function autoPlayCard() {
    const cards = document.querySelectorAll('#player-hand .card-item');
    if (cards.length > 0) {
        const randomIdx = Math.floor(Math.random() * cards.length);
        cards[randomIdx].click(); // 模拟点击第一张牌
    }
}
// ==============================
// 9. 联机模式洗牌发牌逻辑
// ==============================
function redealCards() {
    // 随机分配先手
    isMyTurn = Math.random() > 0.5;
    let pHand = Array.from({length: 4}, () => cardDatabase[Math.floor(Math.random() * cardDatabase.length)]);
    let eHand = Array.from({length: 4}, () => cardDatabase[Math.floor(Math.random() * cardDatabase.length)]);
    
    peerConn.send({
        type: 'REDEAL_CARDS',
        isYourTurn: !isMyTurn,
        playerHand: eHand,
        enemyHand: pHand
    });
    
    battleState.player.hand = pHand;
    battleState.enemy.hand = eHand;
    renderMultiplayerBattle(pHand, eHand);
    isTurnProcessing = false;
    
    logBattle("========= 命运重组：双方重新获得 4 张随机手牌 =========", "#ffd700");
    if (isMyTurn) {
        startTurnTimer();
        document.getElementById('multiplayer-status').innerText = "轮到你了！";
    } else {
        document.getElementById('multiplayer-status').innerText = "等待对手响应...";
    }
}

// 联机模式禁用加强功能
function checkMultiplayerRestrictions() {
    if (typeof isMultiplayer !== 'undefined' && isMultiplayer) {
        const plusBtns = document.querySelectorAll('.card-btn-plus');
        plusBtns.forEach(b => b.style.display = 'none');
    }
}
const forceBindBtn = setInterval(() => {
    const multiBtn = document.getElementById('btn-multiplayer');
    const multiModal = document.getElementById('modal-multiplayer');
    const closeBtn1 = document.getElementById('btn-close-multiplayer');
    const closeBtn2 = document.getElementById('btn-force-close-multi');
    const connectBtn = document.getElementById('btn-connect-peer');

    if (multiBtn && multiModal) {
        multiBtn.onclick = () => {
            multiModal.style.setProperty('display', 'flex', 'important');
            if (typeof window.initPeer === 'function') window.initPeer();
        };
        
        const closeModal = () => {
            multiModal.style.setProperty('display', 'none', 'important');
        };

        if (closeBtn1) closeBtn1.onclick = closeModal;
        if (closeBtn2) closeBtn2.onclick = closeModal;
    }
    
    // 修复：“连接对手”按钮
    if (connectBtn && !connectBtn.hasAttribute('data-bound')) {
        connectBtn.onclick = () => {
            const oppId = document.getElementById('opponent-id').value.trim();
            const statusEl = document.getElementById('multiplayer-status');
            
            // 【核心修复】：必须使用 window.peer，否则点击直接报错
            if (!oppId || !window.peer) return; 
            
            statusEl.innerText = "正在呼叫对手: " + oppId;
            statusEl.style.color = "#ffd700";
            
            // 【核心修复】：必须使用 window.peer.connect 发起连接
            const conn = window.peer.connect(oppId, { reliable: true });
            
            conn.on('open', () => {
                if (typeof isHost !== 'undefined') isHost = false; // 发起连接方作为客机
                
                statusEl.innerText = "连接成功！正在移交原生逻辑...";
                statusEl.style.color = "#00ff88";
                
                if (typeof setupConnection === 'function') {
                    // 正式唤起你 combat.js 原生写好的联机同步逻辑
                    setupConnection(conn); 
                    
                    // 【UI保底过渡】：1秒后自动隐藏联机面板和首页大门，露出战场
                    setTimeout(() => {
                        multiModal.style.setProperty('display', 'none', 'important');
                        const entryScreen = document.getElementById('entry-screen');
                        if (entryScreen) entryScreen.style.display = 'none';
                    }, 1000);
                } else {
                    statusEl.innerText = "严重错误：找不到 setupConnection 函数";
                    statusEl.style.color = "#ff4757";
                }
            });
            
            conn.on('error', (err) => {
                statusEl.innerText = "连接失败: " + err.type;
                statusEl.style.color = "#ff4757";
            });
        };
        connectBtn.setAttribute('data-bound', 'true');
    }
}, 1000);