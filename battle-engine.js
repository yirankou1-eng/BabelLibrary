/* Pure turn resolution shared by the game and regression tests. */
(function(root){
const strategy=typeof module!=='undefined'?require('./strategy.js'):root.BabelStrategy;
const cards=[
{id:'education',name:'教育',desc:'造成 1 点伤害。下一次有效伤害触发连击。'},
{id:'creation',name:'创造',desc:'造成 2 点伤害。自己下一次受到的伤害减少 1 点。'},
{id:'research',name:'研究',desc:'每使用 3 次，造成 10 点伤害。进度可重复累积。'},
{id:'combat',name:'战斗',desc:'造成 3 点伤害。稳定而直接的进攻。'},
{id:'crime',name:'犯罪',desc:'造成 4 点伤害。自己下一次受到的伤害增加 1 点。'},
{id:'study',name:'学习',desc:'造成 1 点伤害。免疫下次受击，下次攻击 +1。与统治共享 2 回合冷却。'},
{id:'pleasure',name:'享乐',desc:'恢复 5 点生命，不能超过生命上限。'},
{id:'rule',name:'统治',desc:'造成 1 点伤害，跳过敌方下次行动。与学习共享 2 回合冷却。'},
{id:'faith',name:'信仰',desc:'被动：初始生命翻倍。无需打出，不占用行动。'},
{id:'service',name:'服务',desc:'本回合起连续 4 回合额外造成 1 点伤害，可叠加。'}];
const lookup=id=>cards.find(c=>c.id===id);
function entity(name,maxHp,hand){const faith=hand.includes('faith');return {name,hp:maxHp*(faith?2:1),maxHp:maxHp*(faith?2:1),hand,boost:0,reduction:0,vulnerable:0,immune:false,duplicate:false,skip:false,research:0,service:[],atkBuff:0,defBuff:0,lastCard:null,damageBonus:0,healingBlocked:false,cooldowns:{study:0,rule:0}};}
function damage(source,target,base,log){if(base<=0)return;let amount=base+source.boost+(source.damageBonus||0);source.boost=0;if(target.immune){target.immune=false;log.push('护盾抵挡了这次攻击。');return;}amount=Math.max(0,amount-target.reduction+target.vulnerable);target.reduction=0;target.vulnerable=0;target.hp=Math.max(0,target.hp-amount);log.push(`${target.name} 受到 ${amount.toFixed(1)} 点伤害。`);if(source.duplicate&&amount>0){source.duplicate=false;target.hp=Math.max(0,target.hp-amount);log.push(`连击追加 ${amount.toFixed(1)} 点伤害。`);}}
function execute(id,caster,target,log=[]){const card=lookup(id);if(!card||id==='faith')return log;let atk=caster.atkBuff;const def=caster.defBuff;caster.atkBuff=0;caster.defBuff=0;const previous=caster.lastCard;caster.lastCard=id;
 if(previous==='creation'&&id==='combat'){atk+=2;caster.reduction=0;log.push('组合·破阵：战斗伤害 +2，清空剩余减伤。');}
 if(previous==='study'&&id==='research'){caster.research++;caster.boost=0;log.push('组合·求证：研究额外积累 1 次，消耗下次增伤。');}
 if(previous==='education'&&id==='crime'){atk+=1;caster.vulnerable++;log.push('组合·越界：伤害 +1，额外承受 1 点受伤惩罚。');}
 log.push(`${caster.name} 使用「${card.name}」。`);
 switch(id){
 case'education':damage(caster,target,1+atk,log);caster.duplicate=true;break;
 case'creation':damage(caster,target,2+atk,log);caster.reduction+=1;break;
 case'research':caster.research++;if(caster.research>=3){caster.research=0;damage(caster,target,10+atk,log);}else if(atk>0)damage(caster,target,atk,log);log.push(`研究进度 ${caster.research}/3。`);break;
 case'combat':damage(caster,target,3+atk,log);break;
 case'crime':damage(caster,target,4+atk,log);caster.vulnerable+=1;break;
 case'study':damage(caster,target,1+atk,log);caster.immune=true;caster.boost+=1;caster.cooldowns.study=3;caster.cooldowns.rule=3;break;
 case'pleasure':{const heal=caster.healingBlocked?0:Math.min(caster.maxHp-caster.hp,5+def);if(caster.healingBlocked)log.push('缄默规则：治疗被禁止。');caster.hp+=heal;log.push(`恢复 ${heal.toFixed(1)} 点生命。`);damage(caster,target,atk,log);break;}
 case'rule':damage(caster,target,1+atk,log);target.skip=true;caster.cooldowns.study=3;caster.cooldowns.rule=3;break;
 case'service':caster.service.push(4);damage(caster,target,atk,log);break;
 }
 if(id!=='pleasure')caster.reduction+=def;return log;
}
function playable(e,id){return id==='wait'||e.hand.includes(id)&&id!=='faith'&&!(e.cooldowns[id]>0);}
function service(e,target,log){if(!e.service.length)return;const damage=e.service.length;target.hp=Math.max(0,target.hp-damage);e.service=e.service.map(t=>t-1).filter(t=>t>0);log.push(`${e.name} 的服务造成 ${damage} 点持续伤害。`);}
function nextRandom(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function intent(s){
 const options=s.enemy.hand.filter(id=>playable(s.enemy,id));
 if(!options.length)return null;
 // Evaluate visible health/effects, never the player's next input. Seeded tie breaks remain hidden.
 let best=null,bestScore=-Infinity;
 for(const id of options){
  const caster=JSON.parse(JSON.stringify(s.enemy)),target=JSON.parse(JSON.stringify(s.player));
  const beforeHp=target.hp,beforeSelf=caster.hp;
  execute(id,caster,target,[]);
  let score=(beforeHp-target.hp)*1.5+(caster.hp-beforeSelf)*0.85;
  if(target.hp<=0)score+=100;
  if(id==='research')score+=caster.research===2?4:2;
  if(id==='service')score+=3;
  if(id==='study')score+=2;
  if(id==='rule')score+=s.player.skip?0:2.8;
  if(id==='creation')score+=0.7;
  if(id==='education')score+=1.4;
  if(id==='crime')score-=0.7;
  score+=nextRandom(s)*1.2;
  if(score>bestScore){bestScore=score;best=id;}
 }
 return best;
}
function winner(s){if(s.enemy.hp<=0)return'player';if(s.player.hp<=0)return'enemy';return null;}
function resolve(s,id){if(s.winner||!playable(s.player,id))return {ok:false,log:[]};const log=[];if(s.player.skip){s.player.skip=false;log.push('受到统治影响，本次行动被跳过。');}else if(id==='wait'){s.player.lastCard=null;log.push('旅人等待，冷却推进一回合。');}else execute(id,s.player,s.enemy,log);service(s.player,s.enemy,log);s.winner=winner(s);if(!s.winner){if(s.enemy.skip){s.enemy.skip=false;log.push('无序者的行动被跳过。');}else if(s.intent&&playable(s.enemy,s.intent))execute(s.intent,s.enemy,s.player,log);else log.push('无序者暂时无法行动。');service(s.enemy,s.player,log);s.winner=winner(s);}
 for(const e of [s.player,s.enemy])for(const k of ['study','rule'])e.cooldowns[k]=Math.max(0,e.cooldowns[k]-1);
 // Prevent infinite defensive stalemates without bypassing tactical early rounds.
 if(!s.winner&&s.turn>=30){const fatigue=1+Math.floor((s.turn-30)/5);s.player.hp=Math.max(0,s.player.hp-fatigue);s.enemy.hp=Math.max(0,s.enemy.hp-fatigue);log.push(`无序侵蚀：双方失去 ${fatigue} 点生命。`);s.winner=winner(s);}
 s.turn++;s.intent=s.winner?null:intent(s);return {ok:true,log};
}
function deck(seed){const ids=cards.map(c=>c.id);for(let i=ids.length-1;i>0;i--){const j=Math.floor(nextRandom(seed)*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}const hand=ids.slice(0,3);return hand;}
function create(floor,type,pHand,eHand,enemyHp,route='standard'){route=type==='dice'?'standard':strategy.routes[route]?route:'standard';const routeRules=strategy.routes[route];const s={version:1,floor,type,route,turn:1,seed:(Date.now()^Math.floor(Math.random()*4294967296))>>>0,winner:null,playerWins:0,enemyWins:0};const valid=h=>Array.isArray(h)&&h.length===3&&new Set(h).size===3&&h.every(id=>lookup(id));s.player=entity('旅人',10,valid(pHand)?pHand:deck(s));s.enemy=entity('无序者',(enemyHp||10+Math.min(20,(floor-1)*.2))*routeRules.hpMultiplier,valid(eHand)?eHand:deck(s));for(const actor of [s.player,s.enemy]){actor.damageBonus=route==='silence'?1:0;actor.healingBlocked=route==='silence';}s.intent=type==='card'?intent(s):null;return s;}
function restore(raw,floor){if(!raw||raw.version!==1||raw.floor!==floor||!['card','dice'].includes(raw.type)||raw.winner!==null||!Number.isInteger(raw.seed)||raw.seed<0||raw.seed>4294967295||!Number.isInteger(raw.turn)||raw.turn<1)return null;
 for(const k of ['playerWins','enemyWins'])if(!Number.isInteger(raw[k])||raw[k]<0||raw[k]>1)return null;
 for(const k of ['player','enemy']){const e=raw[k];if(!e||!Array.isArray(e.hand)||e.hand.length!==3||new Set(e.hand).size!==3||!e.hand.every(id=>lookup(id)))return null;for(const n of ['hp','maxHp','boost','reduction','vulnerable','research','atkBuff','defBuff'])if(!Number.isFinite(e[n])||e[n]<0||e[n]>10000)return null;if(e.hp<=0||e.hp>e.maxHp||e.maxHp<=0)return null;if(!Array.isArray(e.service)||!e.service.every(n=>Number.isInteger(n)&&n>0&&n<=4))return null;for(const b of ['immune','duplicate','skip'])if(typeof e[b]!=='boolean')return null;if(!e.cooldowns||!['study','rule'].every(id=>Number.isInteger(e.cooldowns[id])&&e.cooldowns[id]>=0&&e.cooldowns[id]<=3))return null;}
 if(raw.intent!==null&&(!lookup(raw.intent)||!raw.enemy.hand.includes(raw.intent)))return null;const restored=JSON.parse(JSON.stringify(raw));restored.player.name='旅人';restored.enemy.name='无序者';restored.route=strategy.routes[raw.route]?raw.route:'standard';for(const actor of [restored.player,restored.enemy]){const controlCooldown=Math.max(actor.cooldowns.study,actor.cooldowns.rule);actor.cooldowns.study=controlCooldown;actor.cooldowns.rule=controlCooldown;actor.lastCard=lookup(actor.lastCard)?actor.lastCard:null;actor.damageBonus=restored.route==='silence'?1:0;actor.healingBlocked=restored.route==='silence';}return restored;
}
const api={cards,lookup,entity,damage,execute,playable,resolve,create,restore,nextRandom};if(typeof module!=='undefined')module.exports=api;else root.BabelBattle=api;
})(typeof globalThis!=='undefined'?globalThis:this);
