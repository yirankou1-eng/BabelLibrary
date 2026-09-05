const SAVE_KEY='babel_library_save';
let gameData=BabelRules.fresh();
let saveAvailable=true,storageCorrupt=false,offlineEarnings=0;
try{const raw=localStorage.getItem(SAVE_KEY);if(raw){try{gameData=BabelRules.normalize(JSON.parse(raw));}catch{localStorage.setItem(SAVE_KEY+'_corrupt_backup',raw);storageCorrupt=true;}}}catch{saveAvailable=false;}
const getSpeedCost=()=>BabelRules.speedCost(gameData);
const getValueCost=()=>BabelRules.valueCost(gameData);
const getFrogInterval=()=>BabelRules.interval(gameData);
const getOrbValue=()=>BabelRules.orbValue(gameData);
function saveGame(){gameData.lastSaveTime=Date.now();try{localStorage.setItem(SAVE_KEY,JSON.stringify(gameData));saveAvailable=true;}catch{saveAvailable=false;}const s=document.getElementById('save-status');if(s)s.textContent=saveAvailable?'进度保存在此设备':'存档不可用，请保留当前页面';}
function setText(id,value){const e=document.getElementById(id);if(e)e.textContent=value;}
function updateUI(){
    setText('ds-amount',Math.floor(gameData.directionSense).toLocaleString('zh-CN'));setText('ds-rate',(getOrbValue()/(getFrogInterval()/1000)).toFixed(2));
    setText('cost-speed',gameData.frogSpeedLevel>=10?'已满级':getSpeedCost());setText('cost-value',getValueCost());setText('speed-progress',gameData.frogSpeedLevel+'/10');
    const speed=document.getElementById('upg-speed'),value=document.getElementById('upg-value');
    speed.disabled=gameData.frogSpeedLevel>=10||gameData.directionSense<getSpeedCost();value.disabled=gameData.frogSpeedLevel<10||gameData.directionSense<getValueCost();
    speed.className='upg-btn '+(speed.disabled?'btn-unaffordable':'btn-affordable');value.className='upg-btn '+(value.disabled?'btn-unaffordable':'btn-affordable');
    document.getElementById('speed-req-warn').style.display=gameData.frogSpeedLevel<10?'block':'none';
    setText('side-fragments',gameData.collectedFragments.length);setText('side-books',gameData.unlockedBooks.length);setText('side-floor',gameData.babelFloor);
    setText('home-interval',(getFrogInterval()/1000).toFixed(1)+' 秒');setText('home-value',getOrbValue().toFixed(2));setText('home-bonus','+'+Math.round(gameData.collectedFragments.length+gameData.completedStories.length*10+gameData.babelOrbBonus)+'%');
    const first=gameData.frogSpeedLevel===0, unread=gameData.unlockedBooks.length===0;
    setText('goal-title',first?'培养你的守馆者':unread?'翻开第一本藏书':'继续你的旅程');
    setText('goal-description',first?'积攒 15 点方向感，缩短自动收集间隔。':unread?'用 30 点方向感开启一卷藏书，寻找有意义的句子。':'故事片段和试炼胜利都会提升收益。食料培养保留已升级的收集速度。');
    const cost=first?15:unread?30:gameData.frogSpeedLevel<10?getSpeedCost():getValueCost();
    document.getElementById('goal-progress').max=cost;document.getElementById('goal-progress').value=Math.max(0,gameData.directionSense);
    document.getElementById('goal-action').innerHTML=(first?'培养青蛙':unread?'探索藏书':'培养青蛙')+' <span>↗</span>';
    checkImmediateEndings();
}
function triggerEnding(title,desc){document.getElementById('screen-ending').style.display='flex';setText('ending-title',title);setText('ending-desc',desc);if(!gameData.achievedEndings.includes(title))gameData.achievedEndings.push(title);saveGame();}
function checkImmediateEndings(){if(document.getElementById('screen-ending').style.display==='flex')return;if(gameData.directionSense<=-10000)triggerEnding('迷失','你透支了太多的方向感，永远迷失在无尽书海之中。');else if(gameData.towerCompleted&&gameData.unlockedBooks.length===180)triggerEnding('山巅','九十九层试炼，九层书架，一百八十卷藏书。你已读遍图书馆，立于塔顶。');}
function openModal(id){document.getElementById('modal-overlay').classList.add('active');document.getElementById(id).classList.add('active');}
function closeModal(id){document.getElementById(id)?.classList.remove('active');if(!document.querySelector('.modal.active'))document.getElementById('modal-overlay').classList.remove('active');}
function navigate(id){document.querySelectorAll('.nav-btn').forEach(b=>{b.classList.toggle('active',b.dataset.target===id);b.setAttribute('aria-current',b.dataset.target===id?'page':'false');});document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));if(id==='page-explore'&&typeof updateFloorUI==='function')updateFloorUI();}
document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>navigate(b.dataset.target));
document.querySelectorAll('.close-btn[data-target]').forEach(b=>b.onclick=()=>closeModal(b.dataset.target));
document.getElementById('frog').onclick=()=>{updateUI();openModal('modal-frog');};
document.getElementById('btn-personal').onclick=()=>{setText('personal-collection-count',gameData.collectedFragments.length);setText('personal-babel-floor',gameData.babelFloor);setText('personal-book-count',gameData.unlockedBooks.length);openModal('modal-personal');};
for(const type of ['speed','value'])document.getElementById('upg-'+type).onclick=()=>{if(BabelRules.upgrade(gameData,type)){saveGame();updateUI();if(typeof toast==='function')toast(type==='speed'?'收集速度已提升':'光团价值已提升，收集速度保留');}};
document.getElementById('btn-backtrack').onclick=()=>{closeModal('modal-personal');showMessageModal('确认回溯','方向感、培养等级、藏书与试炼进度将重置。故事收藏与结局记录会保留。',true,()=>{const complete=c=>storyData[c].every(s=>s.sentences.every(t=>gameData.collectedFragments.includes(t)));triggerEnding(complete('思考')?'挑剔':complete('构想')?'理想':'放弃','这段旅程已经结束。接受命运后重新出发，你的故事收藏会被保留。');});};
document.getElementById('btn-reset-game').onclick=()=>{const old=gameData;gameData=BabelRules.fresh();gameData.achievedEndings=old.achievedEndings;gameData.collectionFragments=[...new Set([...old.collectionFragments,...old.collectedFragments])];gameData.collectionStories=[...new Set([...old.collectionStories,...old.completedStories])];gameData.resetCount=old.resetCount+1;saveGame();location.reload();};
const MAX_ORBS_ON_SCREEN=5;
function spawnOrb(){const field=document.getElementById('orb-field');if(field.querySelectorAll('.orb').length>=MAX_ORBS_ON_SCREEN)return;const orb=document.createElement('button');orb.className='orb';orb.setAttribute('aria-label','收集光团');orb.style.left=(15+Math.random()*70)+'%';orb.style.top=(38+Math.random()*28)+'%';orb.onclick=()=>{if(!orb.isConnected)return;const value=BabelRules.award(gameData,1);const feedback=document.createElement('span');feedback.className='gain-float';feedback.textContent='+'+value.toFixed(2);feedback.style.left=orb.style.left;feedback.style.top=orb.style.top;field.appendChild(feedback);setTimeout(()=>feedback.remove(),1000);orb.remove();updateUI();saveGame();};field.appendChild(orb);setTimeout(()=>orb.remove(),14000);}
// Economy follows elapsed time; visual orbs are a manual collection bonus.
let lastTick=Date.now(),collectRemainder=0,hiddenAt=null;
function tickEconomy(now){const delta=Math.max(0,Math.min(now-lastTick,8*60*60*1000));lastTick=now;collectRemainder+=delta;const count=Math.floor(collectRemainder/getFrogInterval());if(count>0){collectRemainder%=getFrogInterval();BabelRules.award(gameData,count);document.getElementById('frog').classList.add('frog-bounce');setTimeout(()=>document.getElementById('frog').classList.remove('frog-bounce'),300);updateUI();}}
offlineEarnings=BabelRules.offline(gameData,Date.now());saveGame();updateUI();
setInterval(()=>{if(!document.hidden)tickEconomy(Date.now());},250);setInterval(()=>{if(!document.hidden)spawnOrb();},2500);setInterval(()=>{if(!document.hidden)saveGame();},5000);
document.addEventListener('visibilitychange',()=>{if(document.hidden){tickEconomy(Date.now());hiddenAt=Date.now();saveGame();}else{if(hiddenAt!==null){tickEconomy(Date.now());hiddenAt=null;saveGame();}}});
window.addEventListener('pagehide',()=>{if(!document.hidden)tickEconomy(Date.now());saveGame();});
spawnOrb();spawnOrb();spawnOrb();
if(offlineEarnings>0)setTimeout(()=>{setText('offline-text',`欢迎回来。青蛙为你收集了 ${Math.floor(offlineEarnings).toLocaleString()} 点方向感，已自动存入。本次收益最多计入 8 小时。`);openModal('modal-offline');},400);
if(storageCorrupt)setTimeout(()=>showMessageModal('存档已恢复','旧存档无法读取，已保留备份并创建新旅程。'),500);
