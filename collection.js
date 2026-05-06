// ==============================
// 标签页切换逻辑
// ==============================
document.querySelectorAll('.col-tab-btn').forEach(btn => {
    btn.onclick = function() {
        // 重置所有按钮的亮度
        document.querySelectorAll('.col-tab-btn').forEach(b => b.style.filter = "brightness(0.6)");
        this.style.filter = "brightness(1.2)";
        
        // 隐藏所有内容区，显示目标区
        document.querySelectorAll('.col-content').forEach(content => content.style.display = 'none');
        document.getElementById(this.dataset.tab).style.display = 'block';
    };
});

// 默认高亮第一个按钮
document.querySelector('.col-tab-btn[data-tab="col-achieve"]').style.filter = "brightness(1.2)";

// ==============================
// 弹窗开启与数据渲染
// ==============================
document.getElementById('btn-collection').onclick = () => {
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('modal-collection').classList.add('active');
    renderCollection();
};

function renderCollection() {
    renderAchievements();
    renderStories();
    renderEndings();
}

// 辅助函数：绘制进度条
function drawProgressBar(current, max) {
    let percent = Math.min(100, (current / max) * 100);
    return `
        <div style="width: 100%; height: 6px; background: #222; border-radius: 3px; margin-top: 5px; overflow: hidden;">
            <div style="width: ${percent}%; height: 100%; background: #ffd700;"></div>
        </div>
        <div style="font-size: 10px; color: #888; text-align: right; margin-top: 2px;">${current} / ${max}</div>
    `;
}

// ==============================
// 1. 成就渲染 (四类成就，各三阶)
// ==============================
function renderAchievements() {
    const achieveBox = document.getElementById('col-achieve');
    achieveBox.innerHTML = '';

    // 当前周目与永久数据的合并汇总（用于显示最高进度）
    let totalStories = new Set([...(gameData.collectionStories || []), ...(gameData.completedStories || [])]).size;
    let totalBooks = gameData.unlockedBooks ? gameData.unlockedBooks.length : 0;
    let towerFloor = gameData.babelFloor || 1;
    let resetTimes = gameData.resetCount || 0;

    const achievements = [
        { name: "智者", desc: "还原失落的故事", current: totalStories, tiers: [1, 4, 8] },
        { name: "书虫", desc: "开启未知的书籍", current: totalBooks, tiers: [10, 50, 180] },
        { name: "作家", desc: "攀登巴别塔层数", current: towerFloor, tiers: [33, 66, 99] },
        { name: "旅行家", desc: "启动回溯的次数", current: resetTimes, tiers: [1, 3, 5] }
    ];

    achievements.forEach(ach => {
        // 判断当前处于第几阶段
        let tierLevel = 0;
        let nextTarget = ach.tiers[0];
        
        if (ach.current >= ach.tiers[2]) { tierLevel = 3; nextTarget = ach.tiers[2]; }
        else if (ach.current >= ach.tiers[1]) { tierLevel = 2; nextTarget = ach.tiers[2]; }
        else if (ach.current >= ach.tiers[0]) { tierLevel = 1; nextTarget = ach.tiers[1]; }

        let stars = "";
        for (let i = 0; i < 3; i++) { stars += (i < tierLevel) ? "★" : "☆"; }

        let card = document.createElement('div');
        card.style.cssText = `background: #1a1a1a; border: 1px solid #444; border-radius: 5px; padding: 10px; margin-bottom: 10px;`;
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="color: #a6e3e9; font-size: 16px;">${ach.name}</strong>
                <span style="color: #ffd700; font-size: 14px;">${stars}</span>
            </div>
            <div style="font-size: 12px; color: #aaa; margin: 5px 0;">${ach.desc}</div>
            ${drawProgressBar(ach.current, nextTarget)}
        `;
        achieveBox.appendChild(card);
    });
}

// ==============================
// 2. 故事渲染
// ==============================
function renderStories() {
    const storyBox = document.getElementById('col-story');
    storyBox.innerHTML = '';
    
    // 合并当前与永久收集的片段
    let allFragments = new Set([...(gameData.collectionFragments || []), ...(gameData.collectedFragments || [])]);

    if (!typeof storyData !== 'undefined') {
        for (let category in storyData) {
            let catDiv = document.createElement('div');
            catDiv.innerHTML = `<h4 style="color:#ff6b6b; margin: 15px 0 5px 0; border-bottom: 1px solid #444; padding-bottom:3px;">词条：【${category}】</h4>`;
            storyBox.appendChild(catDiv);

            storyData[category].forEach(story => {
                let storyCard = document.createElement('div');
                storyCard.style.cssText = `background: #111; padding: 10px; margin-bottom: 10px; border-left: 3px solid #5d6d7e;`;
                
                let titleHtml = `<div style="font-weight:bold; color:#fff; margin-bottom:8px;">${story.title}</div>`;
                let contentHtml = "";

                story.sentences.forEach(sentence => {
                    if (allFragments.has(sentence)) {
                        contentHtml += `<div style="font-size:12px; color:#ccc; margin-bottom:4px; line-height:1.5;">${sentence}</div>`;
                    } else {
                        contentHtml += `<div style="font-size:12px; color:#444; margin-bottom:4px; font-style:italic;">（数据已损坏，尚待还原...）</div>`;
                    }
                });

                storyCard.innerHTML = titleHtml + contentHtml;
                storyBox.appendChild(storyCard);
            });
        }
    }
}

// ==============================
// 3. 结局渲染
// ==============================
function renderEndings() {
    const endingBox = document.getElementById('col-ending');
    endingBox.innerHTML = '';

    const possibleEndings = ["迷失", "山巅", "挑剔", "理想", "放弃"];
    let unlockedEndings = gameData.achievedEndings || [];

    possibleEndings.forEach(end => {
        let isUnlocked = unlockedEndings.includes(end);
        let endCard = document.createElement('div');
        endCard.style.cssText = `background: #1a1a1a; padding: 12px; margin-bottom: 10px; border-radius: 4px; text-align: center; border: 1px solid ${isUnlocked ? '#a6e3e9' : '#333'};`;
        
        if (isUnlocked) {
            endCard.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; color: #a6e3e9; letter-spacing: 2px;">结局：${end}</div>
                <div style="font-size: 12px; color: #888; margin-top: 5px;">已铭刻于世界线中</div>
            `;
        } else {
            endCard.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; color: #444; letter-spacing: 2px;">未知结局</div>
                <div style="font-size: 12px; color: #333; margin-top: 5px;">触发条件尚未达成</div>
            `;
        }
        endingBox.appendChild(endCard);
    });
}
