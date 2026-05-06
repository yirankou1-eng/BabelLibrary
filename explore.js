const MAX_FLOORS = 9;
const BOOK_COLORS = ['#2c3e50', '#34495e', '#5d6d7e', '#2e4053', '#212f3d', '#a6e3e9', '#718093'];

let currentExploreFloor = 1;

let flatSentences = [];
if (typeof storyData !== 'undefined') {
    for (let category in storyData) {
        storyData[category].forEach(story => {
            story.sentences.forEach(sentence => {
                flatSentences.push({ category: category, title: story.title, text: sentence });
            });
        });
    }
}

const TOTAL_BOOKS = 180;
let sentenceMap = {};
let sIndex = 7;
flatSentences.forEach((sentence) => {
    while(sentenceMap[sIndex % TOTAL_BOOKS]) { sIndex += 3; }
    sentenceMap[sIndex % TOTAL_BOOKS] = sentence;
    sIndex += 13;
});

// ==============================
// 动态费用计算
// ==============================
function getFloorCost(floor) { 
    // 解锁楼层：基础花费50，随着楼层增加，呈 1.8 倍的指数级增长
    return Math.floor(50 * Math.pow(1.8, floor - 1)); 
}

function getBookCost(floor) {
    // 解锁书籍：基础花费30，随着楼层增加，呈 1.5 倍的指数级增长
    return Math.floor(30 * Math.pow(1.5, floor - 1));
}

function showMessageModal(title, content, isConfirm = false, onConfirm = null) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-message');
    document.getElementById('modal-message-title').innerText = title;
    document.getElementById('modal-message-content').innerHTML = content;
    const btnConfirm = document.getElementById('modal-message-confirm');
    const btnCancel = document.getElementById('modal-message-cancel');
    overlay.classList.add('active'); modal.classList.add('active');
    btnConfirm.onclick = null; btnCancel.onclick = null;
    if (isConfirm) {
        btnCancel.style.display = 'inline-block';
        btnCancel.onclick = () => { overlay.classList.remove('active'); modal.classList.remove('active'); };
        btnConfirm.onclick = () => { overlay.classList.remove('active'); modal.classList.remove('active'); if (onConfirm) onConfirm(); };
    } else {
        btnCancel.style.display = 'none';
        btnConfirm.onclick = () => { overlay.classList.remove('active'); modal.classList.remove('active'); if (onConfirm) onConfirm(); };
    }
}

function updateFloorUI() {
    if (!gameData.unlockedFloors) gameData.unlockedFloors = [1];
    document.getElementById('explore-floor-title').innerText = `第 ${currentExploreFloor} 层`;
    let statusEl = document.getElementById('explore-floor-status');
    if (gameData.unlockedFloors.includes(currentExploreFloor)) {
        statusEl.innerText = `已解锁 - 翻阅此层卷册需 ${getBookCost(currentExploreFloor)} 方向感`;
        statusEl.style.color = "#a6e3e9";
    } else {
        statusEl.innerText = `未解锁 - 解锁该楼层需消耗 ${getFloorCost(currentExploreFloor)} 方向感`;
        statusEl.style.color = "#ff6b6b";
    }
    document.getElementById('btn-floor-up').classList.toggle('disabled', currentExploreFloor >= MAX_FLOORS);
    document.getElementById('btn-floor-down').classList.toggle('disabled', currentExploreFloor <= 1);
    initBookshelf();
}

document.getElementById('btn-floor-up').onclick = () => { if (currentExploreFloor < MAX_FLOORS) { currentExploreFloor++; updateFloorUI(); } };
document.getElementById('btn-floor-down').onclick = () => { if (currentExploreFloor > 1) { currentExploreFloor--; updateFloorUI(); } };

window.addEventListener('keydown', (e) => {
    if (!document.getElementById('page-explore').classList.contains('active')) return;
    if (e.key === 'ArrowUp') { if (currentExploreFloor < MAX_FLOORS) { currentExploreFloor++; updateFloorUI(); } } 
    else if (e.key === 'ArrowDown') { if (currentExploreFloor > 1) { currentExploreFloor--; updateFloorUI(); } }
});

function initBookshelf() {
    const container = document.getElementById('bookshelf-container');
    if (!container) return; 
    container.innerHTML = '';
    let isFloorUnlocked = gameData.unlockedFloors.includes(currentExploreFloor);
    for (let i = 0; i < 20; i++) {
        let globalBookIndex = (currentExploreFloor - 1) * 20 + i;
        let book = document.createElement('div');
        const randomHeight = 160 + Math.random() * 80;
        const randomColor = BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)];
        book.className = 'book';
        if (!isFloorUnlocked) { book.classList.add('locked'); } 
        else if (gameData.unlockedBooks && gameData.unlockedBooks.includes(globalBookIndex)) { book.classList.add('unlocked'); } 
        else { book.style.filter = "brightness(0.8)"; }
        book.style.setProperty('--book-height', `${randomHeight}px`);
        book.style.setProperty('--book-color', randomColor);
        book.innerHTML = `<span class="book-title">卷号 ${1024 + globalBookIndex}</span>`;
        book.onclick = () => tryOpenBook(globalBookIndex);
        container.appendChild(book);
    }
}

function tryOpenBook(globalBookIndex) {
    if (!gameData.unlockedFloors.includes(currentExploreFloor)) {
        let floorCost = getFloorCost(currentExploreFloor);
        showMessageModal("解锁楼层", `解锁第 ${currentExploreFloor} 层需要消耗 <strong>${floorCost}</strong> 点方向感。<br><span style="color:#ff6b6b; font-size:12px;">注：此行为允许方向感透支至负数。</span><br>是否确认解锁？`, true, () => {
            gameData.directionSense -= floorCost; 
            gameData.unlockedFloors.push(currentExploreFloor);
            saveGame(); updateUI(); updateFloorUI();
        });
        return;
    }

    if (gameData.unlockedBooks.includes(globalBookIndex)) {
        renderReadingInterface(globalBookIndex);
    } else {
        let currentBookCost = getBookCost(currentExploreFloor);
        showMessageModal("开启书籍", `翻阅本层卷册需要消耗 <strong>${currentBookCost}</strong> 点方向感。<br><span style="color:#ff6b6b; font-size:12px;">注：此行为允许方向感透支至负数。</span><br>是否确认翻阅？`, true, () => {
            gameData.directionSense -= currentBookCost; 
            gameData.unlockedBooks.push(globalBookIndex);
            saveGame(); updateUI(); initBookshelf();
            renderReadingInterface(globalBookIndex);
        });
    }
}

function renderReadingInterface(globalBookIndex) {
    const overlay = document.getElementById('reading-overlay');
    const contentBox = document.getElementById('reading-content');
    
    // 【新增概念：动态排版计算】
    // 动态获取玩家屏幕宽高，计算能容纳的最多字符数，防止文本超出屏幕
    let charWidth = 18; // CSS中设置的字体大小为 18px
    let lineHeight = 28.8; // 18px * 1.6行高
    let paddingWidth = 80; // 左右 padding 40px * 2
    let paddingHeight = 120; // 上下 padding 加上底部退出按钮预留的空间
    
    let charsPerLine = Math.floor((window.innerWidth - paddingWidth) / charWidth);
    let maxLines = Math.floor((window.innerHeight - paddingHeight) / lineHeight);
    
    // 计算安全字数（扣除10%冗余量防溢出，且兜底最少100字）
    let safeCharCount = Math.max(100, Math.floor(charsPerLine * maxLines * 0.9)); 

    let gibberish = generateRandomChineseCharacters(safeCharCount);
    const assignedSentence = sentenceMap[globalBookIndex];
    
    if (assignedSentence) {
        // 保证句子插入点不会超出动态计算的总长度
        let maxInsertPosition = Math.max(0, gibberish.length - assignedSentence.text.length - 2);
        const insertPosition = Math.floor(Math.random() * maxInsertPosition);
        
        const part1 = gibberish.slice(0, insertPosition);
        const part2 = gibberish.slice(insertPosition);
        let isCollected = gameData.collectedFragments.includes(assignedSentence.text);
        if (isCollected) {
            contentBox.innerHTML = `${part1}<span style="color:#555;">${assignedSentence.text}</span>${part2}`;
        } else {
            contentBox.innerHTML = `${part1}<span class="meaningful-sentence" data-category="${assignedSentence.category}" data-title="${assignedSentence.title}" onclick="extractSentenceFree(this, event)">${assignedSentence.text}</span>${part2}`;
        }
    } else {
        contentBox.innerHTML = gibberish;
    }
    contentBox.style.setProperty('--mouse-x', `50%`);
    contentBox.style.setProperty('--mouse-y', `50%`);
    overlay.classList.add('active');
}

function extractSentenceFree(element, e) {
    const flashX = parseFloat(readingContent.style.getPropertyValue('--mouse-x'));
    const flashY = parseFloat(readingContent.style.getPropertyValue('--mouse-y'));
    let clickX = e.clientX || (e.touches && e.touches[0].clientX);
    let clickY = e.clientY || (e.touches && e.touches[0].clientY);
    let dist = Math.sqrt(Math.pow(flashX - clickX, 2) + Math.pow(flashY - clickY, 2));
    if (dist > 120) return;

    const category = element.getAttribute('data-category');
    const title = element.getAttribute('data-title');
    const sentence = element.innerText;
    let bonusMsg = "每个光团的方向感储量增加 1%";
    
    if (!gameData.collectedFragments.includes(sentence)) {
        gameData.collectedFragments.push(sentence);
        let storySentences = storyData[category].find(s => s.title === title).sentences;
        let isStoryComplete = storySentences.every(s => gameData.collectedFragments.includes(s));
        if (isStoryComplete && !gameData.completedStories.includes(title)) {
            gameData.completedStories.push(title);
            bonusMsg = "【故事还原！】每个光团的方向感储量增加 11%";
        }
        saveGame(); updateUI();
    }

    showMessageModal("提取成功", `
        <div style="color: #a6e3e9; margin-bottom: 10px; font-weight: bold;">发现了一枚片段：</div>
        <div style="margin-bottom: 15px; font-style: italic;">"${sentence}"</div>
        <div style="font-size: 12px; color: #888;">
            <strong>所属书籍：</strong>${title}<br>
            <strong>词条：</strong>${category}
        </div>
        <div style="margin-top: 10px; font-size: 12px; color: #ffd700;">${bonusMsg}</div>
    `);
    
    element.style.color = "#a6e3e9";
    element.style.textShadow = "0 0 15px #a6e3e9";
    element.style.pointerEvents = "none";
    setTimeout(() => { element.style.transition = "opacity 1.5s"; element.style.opacity = "0"; }, 500);
}

function generateRandomChineseCharacters(length) {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += String.fromCharCode(Math.floor(Math.random() * (0x9fa5 - 0x4e00 + 1)) + 0x4e00);
    }
    return result;
}

const readingContent = document.getElementById('reading-content');
if (readingContent) {
    function updateLightPosition(e) {
        let clientX, clientY;
        // 判定是手机触摸还是电脑鼠标，获取精准坐标
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        // 写入坐标，规避边缘坐标为0时引发的全屏高亮漏洞
        if (clientX !== undefined && clientY !== undefined) {
            readingContent.style.setProperty('--mouse-x', clientX + 'px');
            readingContent.style.setProperty('--mouse-y', clientY + 'px');
        }
    }

    // 监听电脑端鼠标移动
    readingContent.addEventListener('mousemove', updateLightPosition);
    
    // 监听手机端手指触摸
    readingContent.addEventListener('touchstart', updateLightPosition, { passive: false });
    
    // 监听手机端手指拖动（并阻止拖动时的页面默认滚动）
    readingContent.addEventListener('touchmove', (e) => {
        e.preventDefault(); 
        updateLightPosition(e);
    }, { passive: false });
}
const btnCloseReading = document.getElementById('btn-close-reading');
if (btnCloseReading) {
    btnCloseReading.onclick = () => { document.getElementById('reading-overlay').classList.remove('active'); };
}

try { updateFloorUI(); } catch (e) {}