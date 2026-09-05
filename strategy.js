(function (root) {
    const routes = {
        standard: { name: '常规试炼', description: '敌方手牌与下一次行动隐藏，不附加额外规则。', hpMultiplier: 1, orbExtra: 0 },
        forbidden: { name: '禁书试炼', description: '敌方生命增加 25%；光团加成额外 +2%。', hpMultiplier: 1.25, orbExtra: 2 },
        silence: { name: '缄默试炼', description: '双方无法治疗，直接攻击 +1；光团加成额外 +1%。', hpMultiplier: 1, orbExtra: 1 }
    };
    const combinations = [
        { from: 'creation', to: 'combat', name: '破阵', description: '创造 → 战斗：下一张战斗伤害 +2，但清空自己剩余的减伤。' },
        { from: 'study', to: 'research', name: '求证', description: '学习 → 研究：下一张研究额外累积 1 次进度，消耗学习提供的下次增伤。' },
        { from: 'education', to: 'crime', name: '越界', description: '教育 → 犯罪：下一张犯罪伤害 +1，同时额外增加 1 点受伤惩罚。' }
    ];

    function preparation(data, cardIds) {
        const previous = data.battlePreparation;
        return { floor: data.babelFloor, route: previous?.floor === data.babelFloor && routes[previous.route] ? previous.route : 'standard' };
    }

    function canStart(prep) {
        return !!prep && !!routes[prep.route];
    }

    function rewards(floor, type, route) {
        const selected = type === 'dice' ? routes.standard : routes[route] || routes.standard;
        return {
            direction: 0,
            orb: (type === 'card' ? 5 : 3) + selected.orbExtra
        };
    }

    const api = { routes, combinations, preparation, canStart, rewards };
    if (typeof module !== 'undefined') module.exports = api;
    else root.BabelStrategy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
