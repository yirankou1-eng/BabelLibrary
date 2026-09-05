const MAX_FLOORS=9,TOTAL_BOOKS=180;
const BOOK_COLORS=['#24364e','#2c405d','#334966','#1c3451','#46516a','#25485b','#3c4562'];
let currentExploreFloor=1;
const flatSentences=Object.entries(storyData).flatMap(([category,stories])=>stories.flatMap(story=>story.sentences.map(text=>({category,title:story.title,text}))));
// Keep the original mapping so existing book and story saves remain compatible.
const sentenceMap={};let sentenceIndex=7;
flatSentences.forEach(sentence=>{while(sentenceMap[sentenceIndex%TOTAL_BOOKS])sentenceIndex+=3;sentenceMap[sentenceIndex%TOTAL_BOOKS]=sentence;sentenceIndex+=13;});
function getFloorCost(floor){return Math.floor(50*Math.pow(1.8,floor-1));}
function getBookCost(floor){return Math.floor(30*Math.pow(1.5,floor-1));}
function showMessageModal(title,content,isConfirm=false,onConfirm=null){setText('modal-message-title',title);document.getElementById('modal-message-content').innerHTML=content;const yes=document.getElementById('modal-message-confirm'),no=document.getElementById('modal-message-cancel');yes.textContent=isConfirm?'确认':'知道了';no.style.display=isConfirm?'inline-block':'none';no.onclick=()=>closeModal('modal-message');yes.onclick=()=>{closeModal('modal-message');if(onConfirm)onConfirm();};openModal('modal-message');}
function updateFloorUI(){const unlocked=gameData.unlockedFloors.includes(currentExploreFloor),read=gameData.unlockedBooks.filter(i=>Math.floor(i/20)+1===currentExploreFloor).length;setText('explore-floor-title',`第 ${currentExploreFloor} 层`);setText('explore-floor-status',unlocked?`已阅 ${read} / 20 卷 · 首次翻阅 ${getBookCost(currentExploreFloor)} 方向感 · 重读免费`:`尚未解锁 · 开放本层需要 ${getFloorCost(currentExploreFloor)} 方向感`);for(const [id,disabled]of[['btn-floor-up',currentExploreFloor>=MAX_FLOORS],['btn-floor-down',currentExploreFloor<=1]]){document.getElementById(id).disabled=disabled;document.getElementById(id).classList.toggle('disabled',disabled);}initBookshelf();}
function changeFloor(delta){currentExploreFloor=Math.max(1,Math.min(MAX_FLOORS,currentExploreFloor+delta));updateFloorUI();}
document.getElementById('btn-floor-up').onclick=()=>changeFloor(1);document.getElementById('btn-floor-down').onclick=()=>changeFloor(-1);
window.addEventListener('keydown',e=>{if(!document.getElementById('page-explore').classList.contains('active')||document.querySelector('.modal.active')||document.getElementById('reading-overlay').classList.contains('active')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();changeFloor(e.key==='ArrowUp'?1:-1);}});
function initBookshelf(){const container=document.getElementById('bookshelf-container');container.innerHTML='';for(let i=0;i<20;i++){const index=(currentExploreFloor-1)*20+i,read=gameData.unlockedBooks.includes(index),unlocked=gameData.unlockedFloors.includes(currentExploreFloor),sentence=sentenceMap[index],collected=sentence&&gameData.collectedFragments.includes(sentence.text);const book=document.createElement('button');book.className='book'+(!unlocked?' locked':read?' unlocked':'');book.style.setProperty('--book-color',BOOK_COLORS[index%BOOK_COLORS.length]);book.style.setProperty('--book-height',(175+(index*37+index%3*13)%90)+'px');book.setAttribute('aria-label',`卷号 ${1024+index}，${collected?'片段已提取':read?'已阅，免费重读':unlocked?'未阅':'楼层未解锁'}`);book.innerHTML=`<small>${collected?'✦':''}</small><span class="book-title">卷号 ${1024+index}</span><small>${String(i+1).padStart(2,'0')}</small>`;book.onclick=()=>tryOpenBook(index);container.appendChild(book);}}
function confirmSpend(title,cost,onConfirm){const balance=gameData.directionSense-cost;const warning=balance<=-10000?'<p style="color:#e4a48e">这次透支会触发「迷失」结局。</p>':balance<0?'<p style="color:#e4a48e">余额将为负数，恢复前光团收益减半。可以先回庭院积攒方向感。</p>':'';showMessageModal(title,`消耗 <strong>${cost}</strong> 方向感。<br>确认后余额约为 <strong>${Math.floor(balance)}</strong>。${warning}`,true,onConfirm);}
function tryOpenBook(index){if(!Number.isInteger(index)||index<0||index>=180)return;const floor=Math.floor(index/20)+1;if(!gameData.unlockedFloors.includes(floor)){const cost=getFloorCost(floor);confirmSpend('解锁第 '+floor+' 层',cost,()=>{if(gameData.unlockedFloors.includes(floor))return;gameData.directionSense-=cost;gameData.unlockedFloors.push(floor);saveGame();updateUI();updateFloorUI();});return;}if(gameData.unlockedBooks.includes(index)){renderReadingInterface(index);return;}const cost=getBookCost(floor);confirmSpend('翻阅卷号 '+(1024+index),cost,()=>{if(gameData.unlockedBooks.includes(index))return;gameData.directionSense-=cost;gameData.unlockedBooks.push(index);saveGame();updateUI();updateFloorUI();if(gameData.directionSense>-10000&&!gameData.towerCompleted)renderReadingInterface(index);else if(document.getElementById('screen-ending').style.display!=='flex')renderReadingInterface(index);});}
const readingContent = document.getElementById('reading-content');
let activeBook = null;
let activeSentence = null;
let activeSentenceElement = null;
let lightPosition = { x: 0, y: 0 };
let sentenceLitSince = null;
const LIGHT_RADIUS = 120;

function pointInLight(point, center = lightPosition) {
    return Number.isFinite(point.x) && Number.isFinite(point.y) &&
        Math.hypot(point.x - center.x, point.y - center.y) <= LIGHT_RADIUS * 0.65;
}

function litSentenceRects() {
    if (!activeSentenceElement) return [];
    const bounds = readingContent.getBoundingClientRect();
    return [...activeSentenceElement.getClientRects()].map(rect => ({
        left: rect.left - bounds.left,
        right: rect.right - bounds.left,
        top: rect.top - bounds.top,
        bottom: rect.bottom - bounds.top
    })).filter(rect => pointInLight({
        x: Math.max(rect.left, Math.min(rect.right, lightPosition.x)),
        y: Math.max(rect.top, Math.min(rect.bottom, lightPosition.y))
    }));
}

function updateLight(x, y) {
    lightPosition = {
        x: Math.max(0, Math.min(readingContent.clientWidth, x)),
        y: Math.max(0, Math.min(readingContent.clientHeight, y))
    };
    readingContent.style.setProperty('--mouse-x', lightPosition.x + 'px');
    readingContent.style.setProperty('--mouse-y', lightPosition.y + 'px');
    if (litSentenceRects().length) sentenceLitSince ??= Date.now();
    else sentenceLitSince = null;
}

function renderReadingInterface(index) {
    activeBook = index;
    activeSentence = sentenceMap[index] || null;
    activeSentenceElement = null;
    sentenceLitSince = null;
    const overlay = document.getElementById('reading-overlay');
    overlay.classList.add('active');
    const width = readingContent.clientWidth || window.innerWidth;
    const height = readingContent.clientHeight || Math.max(200, window.innerHeight - 180);
    const padding = window.innerWidth <= 600 ? 36 : 68;
    const capacity = Math.max(120, Math.floor((width - padding) / 18) * Math.floor((height - 60) / 28.8));
    const count = Math.max(0, Math.floor(capacity * 0.88) - (activeSentence?.text.length || 0));
    let seed = index + 1024;
    let gibberish = '';
    for (let i = 0; i < count; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        gibberish += String.fromCharCode(0x4e00 + seed % 15000);
    }
    readingContent.replaceChildren();
    if (activeSentence) {
        const position = Math.floor(count * (0.2 + ((index * 17) % 50) / 100));
        readingContent.append(document.createTextNode(gibberish.slice(0, position)));
        const sentence = document.createElement('span');
        sentence.textContent = activeSentence.text;
        const collected = gameData.collectedFragments.includes(activeSentence.text);
        sentence.className = collected ? 'collected-sentence' : 'meaningful-sentence';
        sentence.onclick = event => extractSentenceFree(sentence, activeSentence, event);
        readingContent.append(sentence, document.createTextNode(gibberish.slice(position)));
        activeSentenceElement = sentence;
    } else readingContent.textContent = gibberish;
    setText('reading-book-label', `第 ${Math.floor(index / 20) + 1} 层 · 卷号 ${1024 + index}`);
    setText('reading-status', '光圈之外完全不可见。慢慢移动，辨认有意义的句子。');
    updateLight(width * 0.5, height * 0.4);
    readingContent.focus();
}

function extractSentenceFree(element, assigned, event) {
    if (element !== activeSentenceElement || assigned !== activeSentence ||
        gameData.collectedFragments.includes(assigned.text)) return false;
    const bounds = readingContent.getBoundingClientRect();
    const point = event ? { x: event.clientX - bounds.left, y: event.clientY - bounds.top } : lightPosition;
    const visible = litSentenceRects().some(rect => point.x >= rect.left && point.x <= rect.right &&
        point.y >= rect.top && point.y <= rect.bottom);
    if (!visible || !pointInLight(point) || sentenceLitSince === null || Date.now() - sentenceLitSince < 180) {
        setText('reading-status', '先把光圈停在句子上，辨认后再提取。');
        return false;
    }
    gameData.collectedFragments.push(assigned.text);
    const story = storyData[assigned.category].find(s => s.title === assigned.title);
    const completed = story.sentences.every(s => gameData.collectedFragments.includes(s));
    if (completed && !gameData.completedStories.includes(story.title)) gameData.completedStories.push(story.title);
    element.className = 'collected-sentence';
    element.onclick = null;
    saveGame(); updateUI(); initBookshelf();
    showMessageModal(completed ? '故事已还原' : '发现故事片段', `<p>${assigned.text}</p><p>${assigned.title} · ${assigned.category}</p><p style="color:#a6c8e9">${completed ? '本次片段 +1%，完整故事额外 +10%' : '光团价值加成 +1%'}（本周目）</p>`);
    return true;
}

function moveLight(event) {
    const rect = readingContent.getBoundingClientRect();
    updateLight(event.clientX - rect.left, event.clientY - rect.top);
}
readingContent.addEventListener('pointermove', moveLight);
readingContent.addEventListener('pointerdown', event => {
    moveLight(event);
    readingContent.focus();
    // Capture on the sentence when present, so touch release still reaches its click handler.
    event.target.setPointerCapture?.(event.pointerId);
});
readingContent.addEventListener('keydown', event => {
    const moves = { ArrowLeft: [-25, 0], ArrowRight: [25, 0], ArrowUp: [0, -25], ArrowDown: [0, 25] };
    if (moves[event.key]) {
        event.preventDefault();
        updateLight(lightPosition.x + moves[event.key][0], lightPosition.y + moves[event.key][1]);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (activeSentenceElement) extractSentenceFree(activeSentenceElement, activeSentence);
    }
});
document.getElementById('btn-close-reading').onclick = () => {
    document.getElementById('reading-overlay').classList.remove('active');
    document.querySelector('.book')?.focus();
};
window.addEventListener('resize', () => {
    if (activeBook !== null && document.getElementById('reading-overlay').classList.contains('active')) renderReadingInterface(activeBook);
});
updateFloorUI();
