const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const Codes = require('../room-code.js');
const html = fs.readFileSync('multiplayer.html', 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];

function network() {
    const rooms = new Map(), queue = [];
    let nextId = 1;
    class Events {
        constructor() { this.listeners = {}; }
        on(name, fn) { (this.listeners[name] ||= []).push(fn); }
        emit(name, value) { for (const fn of this.listeners[name] || []) fn(value); }
    }
    class Connection extends Events {
        constructor() { super(); this.open = false; }
        send(data) { queue.push(() => this.other.emit('data', structuredClone(data))); }
        close() { this.open = false; this.emit('close'); }
    }
    class Peer extends Events {
        constructor(id) {
            super(); this.id = typeof id === 'string' ? id : 'internal-long-client-id-' + nextId++;
            this.destroyed = false;
            if (rooms.has(this.id)) queue.push(() => this.emit('error', { type: 'unavailable-id' }));
            else { rooms.set(this.id, this); queue.push(() => { this.open = true; this.emit('open', this.id); }); }
        }
        destroy() { this.destroyed = true; if (rooms.get(this.id) === this) rooms.delete(this.id); }
        connect(id) {
            const a = new Connection(), b = new Connection();
            a.other = b; b.other = a;
            queue.push(() => {
                const target = rooms.get(id);
                if (!target) { this.emit('error', { type: 'peer-unavailable' }); return; }
                target.emit('connection', b); a.open = true; b.open = true;
                b.emit('open'); a.emit('open');
            });
            return a;
        }
    }
    function client(codes = ['ABCDEF']) {
        const elements = new Map();
        const element = () => ({ style: {}, value: '探求者', disabled: false, textContent: '', innerHTML: '', innerText: '', appendChild() {}, setAttribute() {} });
        const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, createElement: element };
        let generated = 0;
        const context = vm.createContext({ Peer, BabelRoomCode: { ...Codes, generate: () => codes[Math.min(generated++, codes.length - 1)] }, document, console, Math,
            setInterval: () => 0, clearInterval() {}, clearTimeout() {},
            setTimeout(fn, ms) { if (ms === 500) queue.push(fn); return 0; },
            navigator: { clipboard: { writeText: async () => {} } } });
        vm.runInContext(script, context);
        return { run: code => vm.runInContext(code, context), elements };
    }
    function flush() { let n = 0; while (queue.length) { assert.ok(n++ < 100); queue.shift()(); } }
    return { client, flush };
}

test('six-character code connects two simulated peers and starts a shared game', () => {
    const n = network(), host = n.client(), guest = n.client();
    host.run('initHost()'); n.flush();
    assert.equal(host.elements.get('my-id').textContent, 'ABCDEF');
    guest.run("document.getElementById('opp-id').value='abc-def';connectToHost()"); n.flush();
    assert.equal(host.run('gameOver'), false); assert.equal(guest.run('gameOver'), false);
    assert.equal(host.run('isHost'), true); assert.equal(guest.run('isHost'), false);
    assert.equal(host.run('me.hp'), guest.run('opp.hp'));
    assert.notEqual(host.run('isMyTurn'), guest.run('isMyTurn'));
});
test('occupied room code retries without disrupting the existing room', () => {
    const n = network(), first = n.client(), second = n.client(['ABCDEF', 'GHJKLM']);
    first.run('initHost()'); n.flush(); second.run('initHost()'); n.flush();
    assert.equal(first.run('peer.destroyed'), false);
    assert.equal(second.elements.get('my-id').textContent, 'GHJKLM');
});
test('missing room returns a useful error and enables retry', () => {
    const n = network(), guest = n.client();
    guest.run("document.getElementById('opp-id').value='GHJKLM';connectToHost()"); n.flush();
    assert.equal(guest.elements.get('btn-join').disabled, false);
    assert.match(guest.elements.get('status-msg').innerText, /房间不存在/);
});
test('room code collisions have a bounded retry limit', () => {
    const n = network(), first = n.client(), second = n.client();
    first.run('initHost()'); n.flush(); second.run('initHost()'); n.flush();
    assert.equal(second.elements.get('btn-host').disabled, false);
    assert.match(second.elements.get('status-msg').innerText, /创建失败/);
    assert.equal(first.run('peer.destroyed'), false);
});
