const tutorialSteps = [
    { title: '01 · 收集方向感', description: '方向感用于培养青蛙、开启藏书和战斗强化。试着点击下方光团；正式游戏中青蛙也会自动收集。' },
    { title: '02 · 食料进阶，速度归位', description: '速度练到 2.5 秒后才能升级食料。更高价值需要重新训练：进阶后速度回到 7.5 秒。下方已准备好练习资源。' },
    { title: '03 · 在黑暗中辨认', description: '移动鼠标、拖动手指或用方向键移动光圈，找到并点击有意义的句子。光圈之外完全不可见；正式藏书首次翻阅收费，重读免费。' },
    { title: '04 · 控制之后，必须应战', description: '每层随机三张牌，不能挑选或刷新换牌。先使用统治或学习，再打战斗：两张控制牌共享两回合冷却，无法交替保持无敌。' },
    { title: '05 · 带着风险进入图书馆', description: '探索可以透支方向感，但负数时收益减半，达到 −10,000 会迷失。高风险试炼有额外光团加成；失败不会替换手牌。食料进阶和战斗强化会竞争同一笔资源。' }
];
let tutorialSession = { active: false, step: 0, done: false, demoEconomy: null, demoBattle: null };
let tutorialPreviousFocus = null;

function finishPractice(step, message) {
    if (!tutorialSession.active || tutorialSession.step !== step) return;
    tutorialSession.done = true;
    setText('tutorial-feedback', message);
    document.getElementById('tutorial-next').disabled = false;
}

function startTutorial(restart = false) {
    tutorialPreviousFocus = document.activeElement;
    tutorialSession.active = true;
    tutorialSession.step = restart || gameData.tutorial.complete ? 0 : gameData.tutorial.step;
    document.getElementById('tutorial-overlay').hidden = false;
    renderTutorial();
    document.getElementById('tutorial-dismiss').focus();
}

function dismissTutorial(completed = false) {
    gameData.tutorial = { version: 1, step: tutorialSession.step, complete: completed || gameData.tutorial.complete, dismissed: true };
    tutorialSession.active = false;
    document.getElementById('tutorial-overlay').hidden = true;
    saveGame();
    tutorialPreviousFocus?.focus();
}

function renderTutorial() {
    const step = tutorialSession.step;
    tutorialSession.done = step === 4;
    setText('tutorial-title', tutorialSteps[step].title);
    setText('tutorial-description', tutorialSteps[step].description);
    setText('tutorial-feedback', '');
    setText('tutorial-step', `${step + 1} / ${tutorialSteps.length}`);
    document.getElementById('tutorial-progress').value = step + 1;
    document.getElementById('tutorial-back').disabled = step === 0;
    document.getElementById('tutorial-next').disabled = !tutorialSession.done;
    setText('tutorial-next', step === 4 ? '开始旅程' : '下一步');
    const box = document.getElementById('tutorial-practice');
    box.replaceChildren();
    if (step === 0) {
        const orb = document.createElement('button');
        orb.className = 'practice-orb'; orb.setAttribute('aria-label', '收集练习光团');
        orb.onclick = () => {
            if (!tutorialSession.active || tutorialSession.step !== 0) return;
            orb.disabled = true;
            finishPractice(0, '已收集练习光团。正式资源没有增加；下一步了解培养循环。');
        };
        box.appendChild(orb);
    } else if (step === 1) {
        const demo = BabelRules.fresh();
        demo.directionSense = 500; demo.frogSpeedLevel = 10; demo.speedUpgradeCount = 10;
        tutorialSession.demoEconomy = demo;
        const metrics = document.createElement('div'); metrics.className = 'practice-metrics';
        metrics.innerHTML = '<span>每团价值<strong id="practice-orb-value">1</strong></span><span>收集间隔<strong id="practice-interval">2.5 秒</strong></span>';
        const upgrade = document.createElement('button'); upgrade.textContent = '用 500 练习方向感进阶食料';
        upgrade.onclick = () => {
            if (!tutorialSession.active || tutorialSession.step !== 1 || !BabelRules.upgrade(demo, 'value')) return;
            setText('practice-orb-value', BabelRules.orbValue(demo));
            setText('practice-interval', BabelRules.interval(demo) / 1000 + ' 秒');
            upgrade.disabled = true;
            finishPractice(1, '价值变为 2，速度回到 7.5 秒。新一轮速度训练现已开启。');
        };
        box.append(metrics, upgrade);
    } else if (step === 2) {
        const reading = document.createElement('div');
        reading.className = 'tutorial-reading'; reading.tabIndex = 0;
        reading.setAttribute('role', 'region'); reading.setAttribute('aria-label', '练习照明，方向键移动光圈，Enter 提取');
        reading.append(document.createTextNode('缭奁羿臻岫笙朔磬嵯雩栖荼翳霁潋曦阙祎笺篆弈珩砚篁汀蘅'));
        const sentence = document.createElement('span'); sentence.id = 'tutorial-reading-sentence'; sentence.textContent = '在混乱的文字里找到一句有意义的话。';
        reading.append(sentence, document.createTextNode('翕岑绛澍粲蘅溯牍琬荏苒袤耋爰罍黍缃荻秾衿汀'));
        let light = { x: 20, y: 20 }, litSince = null;
        const insideSentence = point => {
            const parent = reading.getBoundingClientRect();
            return [...sentence.getClientRects()].some(r => point.x >= r.left - parent.left && point.x <= r.right - parent.left && point.y >= r.top - parent.top && point.y <= r.bottom - parent.top);
        };
        const move = (x, y) => {
            light = { x: Math.max(0, Math.min(reading.clientWidth, x)), y: Math.max(0, Math.min(reading.clientHeight, y)) };
            reading.style.setProperty('--light-x', light.x + 'px'); reading.style.setProperty('--light-y', light.y + 'px');
            if (insideSentence(light)) litSince ??= Date.now(); else litSince = null;
        };
        const collect = point => {
            if (!tutorialSession.active || tutorialSession.step !== 2 || !insideSentence(point) || Math.hypot(point.x - light.x, point.y - light.y) > 58 || litSince === null || Date.now() - litSince < 180) return;
            finishPractice(2, '找到了。正式藏书的片段能提高光团价值，完整故事还有额外加成。');
        };
        reading.onpointermove = event => { const r = reading.getBoundingClientRect(); move(event.clientX - r.left, event.clientY - r.top); };
        reading.onpointerdown = event => { reading.onpointermove(event); reading.focus(); };
        sentence.onclick = event => { const r = reading.getBoundingClientRect(); collect({ x: event.clientX - r.left, y: event.clientY - r.top }); };
        reading.onkeydown = event => {
            const directions = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
            if (directions[event.key]) { event.preventDefault(); move(light.x + directions[event.key][0], light.y + directions[event.key][1]); }
            if (event.key === 'Enter') { event.preventDefault(); collect(light); }
        };
        box.appendChild(reading);
    } else if (step === 3) {
        const demo = BabelBattle.create(1, 'card', ['rule', 'study', 'combat'], ['combat', 'crime', 'creation'], 30);
        tutorialSession.demoBattle = demo;
        let controlled = false;
        const draw = () => {
            box.replaceChildren();
            const hp = document.createElement('p'); hp.textContent = `练习生命 ${demo.player.hp.toFixed(1)} / ${demo.player.maxHp} · 共享冷却 ${demo.player.cooldowns.study}`;
            const actions = document.createElement('div'); actions.className = 'practice-battle';
            for (const id of demo.player.hand) {
                const button = document.createElement('button'); button.disabled = !BabelBattle.playable(demo.player, id) || !!demo.winner;
                button.innerHTML = `${BabelBattle.lookup(id).name}<small>${demo.player.cooldowns[id] ? `冷却 ${demo.player.cooldowns[id]} 回合` : '点击出牌'}</small>`;
                button.onclick = () => {
                    if (!tutorialSession.active || tutorialSession.step !== 3) return;
                    const result = BabelBattle.resolve(demo, id); if (!result.ok) return;
                    const followUp = controlled && id === 'combat';
                    controlled ||= id === 'rule' || id === 'study';
                    draw();
                    if (followUp) finishPractice(3, '控制之后需要用其他牌应战。敌方出牌隐藏，无法保证每次防守都恰好有效。');
                    else setText('tutorial-feedback', controlled ? '两张控制牌都进入冷却了。现在试着用战斗牌承担下一回合。' : '再试一次控制牌，观察两张牌是否一起进入冷却。');
                };
                actions.appendChild(button);
            }
            box.append(hp, actions);
            if (demo.winner && !tutorialSession.done) {
                const retry = document.createElement('button'); retry.textContent = '重新练习'; retry.onclick = renderTutorial; box.appendChild(retry);
            }
        };
        draw();
    } else {
        const note = document.createElement('p');
        note.textContent = '正式游戏从首页开始。先收集方向感并培养青蛙，再决定把资源投入藏书、食料进阶还是战斗强化。入馆指南随时可以重学。';
        box.appendChild(note);
    }
}

document.getElementById('btn-tutorial').onclick = () => startTutorial(true);
document.getElementById('tutorial-dismiss').onclick = () => dismissTutorial();
document.getElementById('tutorial-back').onclick = () => {
    if (!tutorialSession.active || tutorialSession.step === 0) return;
    tutorialSession.step--; renderTutorial();
};
document.getElementById('tutorial-next').onclick = () => {
    if (!tutorialSession.active || !tutorialSession.done) return;
    if (tutorialSession.step === 4) { dismissTutorial(true); return; }
    tutorialSession.step++;
    gameData.tutorial.step = tutorialSession.step; saveGame(); renderTutorial();
};
window.addEventListener('keydown', event => {
    if (!tutorialSession.active) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); dismissTutorial(); return; }
    if (event.key === 'Tab') {
        const panel = document.querySelector('.tutorial-panel');
        const items = [...panel.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(e => e.offsetParent !== null);
        if (!items.length) return;
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    }
}, true);
if (!hadExistingSave && !gameData.tutorial.dismissed && !gameData.tutorial.complete) setTimeout(() => startTutorial(), 600);
