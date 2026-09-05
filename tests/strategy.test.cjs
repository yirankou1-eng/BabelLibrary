const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../strategy.js');
const R = require('../rules.js');
const B = require('../battle-engine.js');
const C = require('../room-code.js');
const ids = B.cards.map(c => c.id);

test('drafts are stable across refresh and offer five distinct choices', () => {
    const data = R.fresh();
    const a = S.preparation(data, ids);
    const b = S.preparation(data, ids);
    assert.deepEqual(a, b);
    assert.equal(new Set(a.offers).size, 5);
    assert.ok(S.canStart(a));
});
test('draft choices survive save migration', () => {
    const data = R.fresh();
    data.battlePreparation = S.preparation(data, ids);
    data.battlePreparation.selected = data.battlePreparation.offers.slice(2, 5);
    data.battlePreparation.route = 'silence';
    const loaded = R.normalize(JSON.parse(JSON.stringify(data)));
    assert.deepEqual(S.preparation(loaded, ids), data.battlePreparation);
});
test('incomplete, duplicated and invented selections cannot begin combat', () => {
    const p = S.preparation(R.fresh(), ids);
    p.selected = ['combat']; assert.equal(S.canStart(p), false);
    p.selected = ['combat', 'combat', 'combat']; assert.equal(S.canStart(p), false);
    p.selected = ['fake', 'faith', 'pleasure']; assert.equal(S.canStart(p), false);
});
test('forbidden trial increases HP and payouts in their declared ratios', () => {
    const s = B.create(1, 'card', ['combat', 'faith', 'crime'], ['combat', 'crime', 'service'], 10, 'forbidden');
    assert.equal(s.enemy.maxHp, 12.5);
    assert.deepEqual(S.rewards(1, 'card', 'forbidden'), { direction: 40, orb: 7 });
});
test('silence blocks both sides healing and increases direct damage', () => {
    const s = B.create(1, 'card', ['combat', 'pleasure', 'crime'], ['combat', 'pleasure', 'crime'], 10, 'silence');
    s.player.hp = 5; s.enemy.hp = 5;
    B.execute('pleasure', s.player, s.enemy); B.execute('pleasure', s.enemy, s.player);
    assert.equal(s.player.hp, 5); assert.equal(s.enemy.hp, 5);
    B.execute('combat', s.player, s.enemy); assert.equal(s.enemy.hp, 1);
});
test('creation to combat grants damage at the cost of remaining reduction', () => {
    const p = B.entity('p', 30, []), e = B.entity('e', 30, []);
    B.execute('creation', p, e); assert.equal(p.reduction, 1);
    B.execute('combat', p, e); assert.equal(p.reduction, 0); assert.equal(e.hp, 23);
});
test('study to research grants an extra research step without revealing enemies', () => {
    const p = B.entity('p', 30, []), e = B.entity('e', 30, []);
    B.execute('study', p, e); B.execute('research', p, e);
    assert.equal(p.research, 2);
    B.execute('research', p, e); assert.equal(p.research, 0); assert.equal(e.hp, 18);
});
test('education to crime increases outgoing damage and incoming risk', () => {
    const p = B.entity('p', 30, []), e = B.entity('e', 30, []);
    B.execute('education', p, e); B.execute('crime', p, e);
    assert.equal(e.hp, 19); assert.equal(p.vulnerable, 2);
});
test('inserting another card breaks a combination', () => {
    const p = B.entity('p', 30, []), e = B.entity('e', 30, []);
    B.execute('creation', p, e); B.execute('pleasure', p, e); B.execute('combat', p, e);
    assert.equal(e.hp, 25); assert.equal(p.reduction, 1);
});
test('trial constraints and combo state survive restoring an active battle', () => {
    const s = B.create(3, 'card', ['study', 'research', 'combat'], ['crime', 'service', 'faith'], 20, 'silence');
    B.resolve(s, 'study'); const restored = B.restore(JSON.parse(JSON.stringify(s)), 3);
    assert.equal(restored.route, 'silence'); assert.equal(restored.player.lastCard, 'study');
    assert.equal(restored.player.healingBlocked, true); assert.equal(restored.player.damageBonus, 1);
});
test('six-character room codes omit ambiguous characters and map to the same peer', () => {
    const code = C.generate(new Uint8Array([0, 1, 2, 30, 31, 10]));
    assert.equal(code.length, 6); assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(C.peerId(code), C.peerId(code.toLowerCase()));
    assert.equal(C.peerId(code), C.peerId(code.slice(0, 3) + '-' + code.slice(3)));
});
test('invalid room codes never become peer lookup requests', () => {
    for (const code of ['', 'abc', '012345', 'IIIIII', 'ABCDEF7', '<html>']) assert.equal(C.peerId(code), null);
});
