let battleState=BabelBattle.restore(gameData.battleSnapshot,gameData.babelFloor);
let isTurnProcessing=false;
const handContainer=document.getElementById('player-hand');
function logBattle(message){const log=document.getElementById('battle-log'),line=document.createElement('div');line.textContent=message;log.appendChild(line);while(log.children.length>80)log.firstElementChild.remove();log.scrollTop=log.scrollHeight;}
function persistBattle(){gameData.battleSnapshot=battleState&&!battleState.winner?battleState:null;saveGame();}
function statusText(e){return [e.immune?'护盾就绪':'',e.duplicate?'连击就绪':'',e.research?`研究 ${e.research}/3`:'',e.atkBuff?'强化就绪':'',e.skip?'下次行动跳过':''].filter(Boolean).join(' · ');}
function currentPreparation() {
    gameData.battlePreparation = BabelStrategy.preparation(gameData, BabelBattle.cards.map(card => card.id));
    return gameData.battlePreparation;
}

function renderPreparation() {
    const active = battleState && !battleState.winner;
    const type = gameData.babelChallengeType || (gameData.babelFloor % 4 === 0 ? 'dice' : 'card');
    const panel = document.getElementById('battle-preparation');
    panel.hidden = !!active || gameData.towerCompleted || type !== 'card';
    if (panel.hidden) return;
    const prep = currentPreparation();
    setText('draft-count', `第 ${prep.floor} 层 · 已选择 ${prep.selected.length} / 3`);
    const cards = document.getElementById('draft-cards');
    cards.replaceChildren();
    for (const id of prep.offers) {
        const card = BabelBattle.lookup(id);
        const selected = prep.selected.includes(id);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'draft-card' + (selected ? ' selected' : '');
        button.setAttribute('aria-pressed', String(selected));
        button.innerHTML = `<span class="draft-selection">${selected ? '已入构筑' : '候选'}</span><strong>${card.name}</strong><span>${card.desc}</span>`;
        button.onclick = () => {
            if (battleState && !battleState.winner) return;
            if (selected) prep.selected = prep.selected.filter(value => value !== id);
            else if (prep.selected.length < 3) prep.selected.push(id);
            else {
                toast('先取消一张已选卡牌，再选择新的卡牌。');
                return;
            }
            saveGame(); renderPreparation();
        };
        cards.appendChild(button);
    }
    const routes = document.getElementById('trial-routes');
    routes.replaceChildren();
    for (const [id, route] of Object.entries(BabelStrategy.routes)) {
        const label = document.createElement('label');
        label.className = 'trial-route' + (prep.route === id ? ' selected' : '');
        const input = document.createElement('input');
        input.type = 'radio'; input.name = 'trial-route'; input.value = id; input.checked = prep.route === id;
        input.onchange = () => {
            if (battleState && !battleState.winner) return;
            prep.route = id; saveGame(); renderPreparation();
        };
        const copy = document.createElement('span');
        const reward = BabelStrategy.rewards(prep.floor, 'card', id);
        copy.innerHTML = `<strong>${route.name}</strong><span>${route.description}</span><small>通关：${reward.direction} 方向感 · 光团 +${reward.orb}%</small>`;
        label.append(input, copy);
        routes.appendChild(label);
    }
    const combos = BabelStrategy.combinations.filter(combo => prep.selected.includes(combo.from) && prep.selected.includes(combo.to));
    const explanations = combos.length ? combos.map(combo => combo.description).join(' ') : '连续打出「创造→战斗」「学习→研究」或「教育→犯罪」可触发组合。';
    setText('draft-combos', explanations + (prep.route === 'silence' && prep.selected.includes('pleasure') ? ' 注意：本次缄默试炼中享乐无法治疗。' : ''));
    const start = document.getElementById('btn-start-battle');
    start.disabled = !BabelStrategy.canStart(prep);
    start.textContent = `以此构筑进入第 ${prep.floor} 层`;
}

function renderBattle(){
 const s=battleState,btn=document.getElementById('btn-start-battle');setText('battle-floor',`第 ${s?s.floor:gameData.babelFloor} 层 / 99`);
 btn.style.display=s&&!s.winner?'none':'block';btn.disabled=gameData.towerCompleted;btn.textContent=gameData.towerCompleted?'九十九层试炼已完成':s?.winner==='enemy'?'重新挑战本层':s?.winner==='player'?'前往下一层':'开始本层试炼';
 setText('battle-phase',gameData.towerCompleted?'已抵达塔顶':s?.winner==='player'?'试炼通过':s?.winner==='enemy'?'试炼未通过':s?`${s.type==='card'?'命运卡牌':'命运骰子'} · 第 ${s.turn} 回合`:'准备出发');
 const reward=s?BabelStrategy.rewards(s.floor,s.type,s.route):null;
 setText('battle-reward',s?`${BabelStrategy.routes[s.route||'standard'].name} · 方向感 +${reward.direction} · 光团 +${reward.orb}%`:'战前选三张牌，选择本层试炼');
 const readyCombos=s&&!s.winner?BabelStrategy.combinations.filter(c=>c.from===s.player.lastCard&&s.player.hand.includes(c.to)):[];
 setText('battle-combo-status',readyCombos.map(c=>c.description).join(' '));
 if(!s){renderPreparation();return;}
 for(const side of ['player','enemy']){const e=s[side];setText(side+'-hp',e.hp.toFixed(1));setText(side+'-max-hp',e.maxHp.toFixed(1));document.getElementById(side+'-hp-fill').style.width=(e.hp/e.maxHp*100)+'%';}
 setText('player-status',statusText(s.player));setText('enemy-status',s.winner?'本次试炼已结束':s.type==='dice'?'先获得 2 胜即可通关，平局重掷。':statusText(s.enemy)||'无序者的下一次行动不可知');
 const avatar=document.getElementById('enemy-avatar');avatar.src=s.type==='dice'?'dice-enemy.jpg':'card-enemy.jpg';avatar.style.display='inline-block';
 document.getElementById('action-dice').style.display=s.type==='dice'&&!s.winner?'block':'none';handContainer.style.display=s.type==='card'||s.winner?'flex':'none';handContainer.innerHTML='';
 if(s.winner){const result=document.createElement('div');result.className='battle-result';result.textContent=s.winner==='player'?`试炼通过 · 获得 ${reward.direction} 方向感，光团价值提升 ${reward.orb}%（本周目）`:'暂未通过 · 不扣除方向感，保留本层手牌，可调整出牌顺序再试。';handContainer.appendChild(result);renderPreparation();return;}
 if(s.type==='dice'){setText('dice-score-player',s.playerWins);setText('dice-score-enemy',s.enemyWins);setText('dice-bet-limit',`可不注入；最低 ${10+Math.floor(s.floor*2.5)}。胜利返还两倍（含本金），平局退回。`);renderPreparation();return;}
 s.player.hand.forEach((id,index)=>{const card=BabelBattle.lookup(id),disabled=!BabelBattle.playable(s.player,id)||isTurnProcessing;const wrap=document.createElement('div');wrap.className='card-wrap';const el=document.createElement('button');el.className='card'+(disabled?' disabled':'');el.disabled=disabled;el.innerHTML=`<div class="card-kicker">ARCANA / 0${index+1}${id==='faith'?' · PASSIVE':''}</div><div class="card-name">${card.name}</div><div class="card-desc">${card.desc}</div>${s.player.cooldowns[id]?'<div class="card-cooldown">冷却中 · 下一回合可用</div>':''}`;el.onclick=()=>processTurn(id);wrap.appendChild(el);if(id!=='faith'){const plus=document.createElement('button');plus.className='card-btn-plus';plus.textContent='+';plus.setAttribute('aria-label','强化下一张牌');plus.disabled=disabled||s.player.atkBuff>0;plus.onclick=openBuffModal;wrap.appendChild(plus);}handContainer.appendChild(wrap);});renderPreparation();
}
function startNewBattle(){if(isTurnProcessing||gameData.towerCompleted||battleState&&!battleState.winner)return;document.getElementById('battle-log').innerHTML='';
 const type=gameData.babelChallengeType||(gameData.babelFloor%4===0?'dice':'card');
 const prep=type==='card'?currentPreparation():null;if(prep&&!BabelStrategy.canStart(prep))return;gameData.babelChallengeType=type;
 battleState=BabelBattle.create(gameData.babelFloor,type,prep?prep.selected:gameData.babelPlayerCards,gameData.babelEnemyCards,gameData.babelEnemyHp,prep?prep.route:'standard');
 gameData.babelPlayerCards=battleState.player.hand;gameData.babelEnemyCards=battleState.enemy.hand;gameData.babelEnemyHp=battleState.enemy.maxHp/(battleState.enemy.hand.includes('faith')?2:1)/BabelStrategy.routes[battleState.route].hpMultiplier;
 setText('dice-player','?');setText('dice-enemy','?');document.getElementById('dice-bet-input').value='';logBattle(`第 ${battleState.floor} 层试炼开始。${type==='card'?'每轮先手行动，敌方随后行动，不显示其手牌与下一张牌。第 30 回合起双方受到侵蚀伤害。':'先获得两胜者获胜。注入方向感不改变骰子概率。'}`);persistBattle();renderBattle();}
function settle(){const s=battleState;if(!s?.winner||s.settled)return;s.settled=true;gameData.battleSnapshot=null;
 if(s.winner==='player'){const reward=BabelStrategy.rewards(s.floor,s.type,s.route);gameData.directionSense+=reward.direction;gameData.babelOrbBonus+=reward.orb;gameData.battlePreparation=null;if(s.floor===99)gameData.towerCompleted=true;else gameData.babelFloor=s.floor+1;gameData.babelPlayerCards=[];gameData.babelEnemyCards=[];gameData.babelEnemyHp=null;gameData.babelChallengeType=null;logBattle('试炼通过，奖励已存入。');}else logBattle('试炼失败，可以保留手牌重新挑战。');saveGame();updateUI();}
function processTurn(id){if(!battleState||battleState.type!=='card'||isTurnProcessing||battleState.winner)return;const result=BabelBattle.resolve(battleState,id);if(!result.ok)return;isTurnProcessing=true;result.log.forEach(logBattle);if(battleState.winner)settle();else persistBattle();renderBattle();setTimeout(()=>{isTurnProcessing=false;renderBattle();},450);}
function getBuffCost(){return Math.floor(30*Math.pow(1.035,gameData.babelFloor));}
function openBuffModal(){if(!battleState||battleState.winner||isTurnProcessing||battleState.player.atkBuff)return;setText('buff-cost-display',getBuffCost());setText('buff-preview-atk','5');setText('buff-preview-def','2');setText('buff-warning',gameData.directionSense<getBuffCost()?'方向感不足。':'对下一张主动打出的牌生效。');document.getElementById('btn-confirm-buff').disabled=gameData.directionSense<getBuffCost();openModal('modal-card-buff');}
document.getElementById('btn-confirm-buff').onclick=()=>{if(!battleState||battleState.winner||isTurnProcessing||battleState.player.atkBuff||gameData.directionSense<getBuffCost())return;gameData.directionSense-=getBuffCost();battleState.player.atkBuff=5;battleState.player.defBuff=2;persistBattle();updateUI();closeModal('modal-card-buff');renderBattle();};
document.getElementById('btn-roll-dice').onclick=()=>{const s=battleState;if(!s||s.type!=='dice'||s.winner||isTurnProcessing)return;const raw=document.getElementById('dice-bet-input').value.trim(),bet=raw===''?0:Number(raw),min=10+Math.floor(s.floor*2.5);if(!Number.isSafeInteger(bet)||bet<0||bet>0&&bet<min||bet>Math.max(0,gameData.directionSense)){logBattle('请输入可支付的非负整数；注入为 0 或达到本层最低金额。');return;}
 const p=1+Math.floor(BabelBattle.nextRandom(s)*20),e=1+Math.floor(BabelBattle.nextRandom(s)*20);setText('dice-player',p);setText('dice-enemy',e);const r=BabelRules.diceResult(s.playerWins,s.enemyWins,p,e);s.playerWins=r.playerWins;s.enemyWins=r.enemyWins;s.winner=r.winner;s.turn++;gameData.directionSense+=p>e?bet:p<e?-bet:0;
 logBattle(`你掷出 ${p}，无序者掷出 ${e}。${p===e?'平局，本金保留，重掷。':p>e?'本局获胜。':'本局落败。'}${bet?`方向感净变化 ${p===e?'0':p>e?'+'+bet:'-'+bet}。`:''}`);if(s.winner){s[s.winner==='player'?'enemy':'player'].hp=0;settle();}else persistBattle();updateUI();renderBattle();};
document.getElementById('btn-start-battle').onclick=startNewBattle;
if(battleState)logBattle('已恢复上次未结束的试炼。生命、手牌、冷却与骰子进度保持不变。');else if(gameData.battleSnapshot){gameData.battleSnapshot=null;saveGame();}
renderBattle();
