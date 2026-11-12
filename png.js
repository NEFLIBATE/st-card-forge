// Character Card V2 PNG metadata: tEXt keyword "chara", UTF-8 JSON encoded as base64.
// No dependencies and no calls to an image service.
const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
});
function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(encoder.encode(type), 4); out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
}
function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
}
function chunks(bytes) {
    if (bytes.length < 20 || SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error('这不是有效 PNG。');
    const result = [];
    let offset = 8;
    while (offset + 12 <= bytes.length) {
        const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
        if (offset + length + 12 > bytes.length) throw new Error('PNG 数据不完整。');
        const type = decoder.decode(bytes.subarray(offset + 4, offset + 8));
        const data = bytes.subarray(offset + 8, offset + 8 + length);
        result.push({ type, data, raw: bytes.subarray(offset, offset + length + 12) });
        offset += length + 12;
        if (type === 'IEND') return result;
    }
    throw new Error('PNG 缺少结束标记。');
}
export function embedCard(pngBytes, card) {
    const parts = [SIGNATURE];
    for (const c of chunks(pngBytes)) {
        const keyword = ['tEXt', 'iTXt', 'zTXt'].includes(c.type) ? decoder.decode(c.data.subarray(0, c.data.indexOf(0))) : '';
        // Avoid conflicting older cards, including V3 metadata.
        if (keyword === 'chara' || keyword === 'ccv3') continue;
        if (c.type === 'IEND') parts.push(chunk('tEXt', encoder.encode(`chara\0${bytesToBase64(encoder.encode(JSON.stringify(card)))}`)));
        parts.push(c.raw);
    }
    return new Blob(parts, { type: 'image/png' });
}
export function extractCard(pngBytes) {
    for (const c of chunks(pngBytes)) {
        if (c.type !== 'tEXt') continue;
        const index = c.data.indexOf(0);
        if (decoder.decode(c.data.subarray(0, index)) !== 'chara') continue;
        try {
            const binary = atob(decoder.decode(c.data.subarray(index + 1)));
            return JSON.parse(decoder.decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
        } catch { throw new Error('PNG 角色卡的 chara 元数据损坏。'); }
    }
    throw new Error('PNG 中没有 V2 chara 数据。普通图片请使用「上传头像」。');
}
