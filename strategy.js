(function (root) {
    const routes = {
        standard: { name: '常规试炼', description: '原有规则。敌方手牌与下一次行动隐藏。', hpMultiplier: 1, rewardMultiplier: 1, orbExtra: 0 },
        forbidden: { name: '禁书试炼', description: '敌方生命增加 25%；方向感奖励增加 60%，光团加成额外 +2%。', hpMultiplier: 1.25, rewardMultiplier: 1.6, orbExtra: 2 },
        silence: { name: '缄默试炼', description: '双方无法治疗，直接攻击 +1；方向感奖励增加 40%，光团加成额外 +1%。', hpMultiplier: 1, rewardMultiplier: 1.4, orbExtra: 1 }
    };
    const combinations = [
        { from: 'creation', to: 'combat', name: '破阵', description: '创造 → 战斗：下一张战斗伤害 +2，但清空自己剩余的减伤。' },
        { from: 'study', to: 'research', name: '求证', description: '学习 → 研究：下一张研究额外累积 1 次进度。' },
        { from: 'education', to: 'crime', name: '越界', description: '教育 → 犯罪：下一张犯罪伤害 +1，同时额外增加 1 点受伤惩罚。' }
    ];

    function preparation(data, cardIds) {
        const valid = id => cardIds.includes(id);
        const previous = data.battlePreparation;
        if (previous && previous.floor === data.babelFloor &&
            Array.isArray(previous.offers) && previous.offers.length === 5 &&
            new Set(previous.offers).size === 5 && previous.offers.every(valid)) {
            previous.selected = [...new Set((Array.isArray(previous.selected) ? previous.selected : []).filter(id => previous.offers.includes(id)))].slice(0, 3);
            if (!routes[previous.route]) previous.route = 'standard';
            return previous;
        }
        // A stable shuffle for this floor/world prevents rerolling the draft on refresh.
        let seed = (data.babelFloor * 2654435761 + data.resetCount * 1013904223) >>> 0;
        const pool = [...cardIds];
        for (let i = pool.length - 1; i > 0; i--) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const j = seed % (i + 1);
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const inherited = [...new Set((data.babelPlayerCards || []).filter(valid))].slice(0, 3);
        const offers = [...inherited, ...pool.filter(id => !inherited.includes(id))].slice(0, 5);
        if (!offers.some(id => ['combat', 'crime', 'creation', 'education', 'service'].includes(id))) offers[0] = 'combat';
        const selected = offers.slice(0, 3);
        if (!selected.some(id => ['combat', 'crime', 'creation', 'education', 'service'].includes(id))) selected[2] = offers.find(id => ['combat', 'crime', 'creation', 'education', 'service'].includes(id));
        return { floor: data.babelFloor, offers, selected, route: 'standard' };
    }

    function canStart(prep) {
        return prep && routes[prep.route] && prep.selected.length === 3 &&
            new Set(prep.selected).size === 3 && prep.selected.every(id => prep.offers.includes(id)) &&
            prep.selected.some(id => !['faith', 'pleasure'].includes(id));
    }

    function rewards(floor, type, route) {
        const selected = type === 'dice' ? routes.standard : routes[route] || routes.standard;
        return {
            direction: Math.floor((20 + floor * 5) * selected.rewardMultiplier),
            orb: (type === 'card' ? 5 : 3) + selected.orbExtra
        };
    }

    const api = { routes, combinations, preparation, canStart, rewards };
    if (typeof module !== 'undefined') module.exports = api;
    else root.BabelStrategy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
