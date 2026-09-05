(function (root) {
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const PREFIX = 'babel-library-room-';

    function generate(randomBytes) {
        const bytes = randomBytes || root.crypto.getRandomValues(new Uint8Array(6));
        if (bytes.length !== 6) throw new Error('Room codes require six random bytes.');
        return Array.from(bytes, value => ALPHABET[value % ALPHABET.length]).join('');
    }

    function normalize(input) {
        const code = String(input || '').toUpperCase().replace(/[\s-]/g, '');
        return code.length === 6 && [...code].every(c => ALPHABET.includes(c)) ? code : null;
    }

    function peerId(input) {
        const code = normalize(input);
        return code ? PREFIX + code : null;
    }

    const api = { generate, normalize, peerId };
    if (typeof module !== 'undefined') module.exports = api;
    else root.BabelRoomCode = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
