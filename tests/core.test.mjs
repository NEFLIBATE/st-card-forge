import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCard, normalizeCard, parseModelJson, validateCard, normalizeBook, buildPrompt, fileName } from '../core.js';
import { embedCard, extractCard } from '../png.js';

const sample = () => ({ ...emptyCard(), data: { ...emptyCard().data, name: '林间·书店 📚', description: '记忆与旧书。{{char}} 遇见 {{user}}。', first_mes: '“你找哪一本？”\n窗外下着雨。', extensions: { another_extension: { value: 123 } } } });
test('模型前言、围栏、带引号的大括号和中文可正确解析', () => {
    const expected = { name: '明月', description: '她说：“{你好}”； "结束"。', first_mes: '你来了。' };
    assert.deepEqual(parseModelJson('以下是角色卡：\n```json\n' + JSON.stringify(expected) + '\n```'), expected);
    assert.deepEqual(parseModelJson('<think>{"irrelevant":true}</think>\n' + JSON.stringify(expected)), expected);
    assert.throws(() => parseModelJson('{"name":"截断'), /有效 JSON/);
    assert.throws(() => parseModelJson(''), /没有返回文字/);
});
test('V1 导入转 V2；未知扩展保留；禁止错误字段类型', () => {
    const original = sample();
    const roundtrip = normalizeCard(original);
    assert.deepEqual(roundtrip.data.extensions, original.data.extensions);
    assert.equal(roundtrip.data.first_mes, original.data.first_mes);
    assert.equal(normalizeCard({ name: 'V1', description: 'old' }).spec, 'chara_card_v2');
    assert.throws(() => normalizeCard({ name: 'X', tags: 'a,b' }), /数组/);
    assert.throws(() => normalizeCard({ data: { name: ['X'] } }), /文本/);
    assert.throws(() => normalizeCard({ spec: 'chara_card_v3', data: original.data }), /暂不支持/);
    assert.throws(() => normalizeCard({ hello: 'world' }), /未识别/);
});
test('导出需要名称、描述和开场白，未完成草稿仍可保存', () => {
    assert.equal(normalizeCard(emptyCard()).data.name, '');
    assert.throws(() => validateCard(emptyCard()), /角色名称/);
    const value = sample(); value.data.first_mes = ' ';
    assert.throws(() => validateCard(value), /开场白/);
    assert.equal(validateCard(sample()).data.name, '林间·书店 📚');
});
test('世界书验证关键词与开关，保留条目扩展', () => {
    const book = normalizeBook({ entries: [{ keys: ['书店'], content: '午夜开放。', extensions: { third_party: true } }] });
    assert.equal(book.entries[0].enabled, true);
    assert.equal(book.entries[0].extensions.third_party, true);
    assert.throws(() => normalizeBook({ entries: [{ keys: '书店', content: 'x' }] }), /keys/);
    assert.throws(() => normalizeBook({ entries: [{ keys: [], content: 'x', enabled: 'false' }] }), /布尔/);
});
test('独立制卡提示可加入玩家参考与单字段重写要求', () => {
    const p = buildPrompt({ idea: '夜班医生', language: '简体中文', worldbook: true }, '玩家是旅人');
    assert.match(p.prompt, /玩家是旅人/); assert.match(p.prompt, /character_book/);
    assert.match(p.systemPrompt, /⟦CF_OPEN⟧user⟦CF_CLOSE⟧/);
    assert.doesNotMatch(p.systemPrompt, /\{\{/);
    assert.doesNotMatch(p.prompt, /\{\{/);
    const q = buildPrompt({ idea: '' }, '', sample(), 'first_mes');
    assert.match(q.prompt, /只重写 first_mes/);
    assert.equal(fileName('../../x:hi?.'), '.._.._x_hi_');
});
test('酒馆占位符与其他完整宏不会被当前聊天展开，模型标记会还原', () => {
    const p = buildPrompt({ idea: '{{char}} 认识 {{user}}，保留 {{getvar::memory}}。' }, '', sample());
    const substituteLikeTavern = text => text.replace(/\{\{char\}\}/gi, '当前不相关角色').replace(/\{\{user\}\}/gi, '当前玩家');
    assert.equal(substituteLikeTavern(p.prompt), p.prompt);
    assert.match(p.prompt, /⟦CF_OPEN⟧getvar::memory⟦CF_CLOSE⟧/);
    const result = parseModelJson('{"first_mes":"你好，⟦CF_OPEN⟧user⟦CF_CLOSE⟧。","alternate_greetings":["⟦CF_OPEN⟧char⟦CF_CLOSE⟧来了。"]}');
    assert.equal(result.first_mes, '你好，{{user}}。');
    assert.deepEqual(result.alternate_greetings, ['{{char}}来了。']);
});
test('PNG 元数据可被独立读取，Unicode 完整，重复嵌入不保留旧卡', async () => {
    const base = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64'));
    const first = new Uint8Array(await embedCard(base, sample()).arrayBuffer());
    assert.deepEqual(extractCard(first), sample());
    let offset = 8, metadataCount = 0;
    while (offset < first.length) {
        const length = new DataView(first.buffer).getUint32(offset);
        const type = Buffer.from(first.slice(offset + 4, offset + 8)).toString();
        if (type === 'tEXt') {
            const body = Buffer.from(first.slice(offset + 8, offset + 8 + length));
            const [key, text] = body.toString().split('\0');
            assert.equal(key, 'chara');
            const external = JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
            assert.equal(external.data.name, sample().data.name);
            metadataCount++;
        }
        offset += length + 12;
    }
    assert.equal(metadataCount, 1);
    const changed = sample(); changed.data.name = '新角色';
    const second = new Uint8Array(await embedCard(first, changed).arrayBuffer());
    assert.equal(extractCard(second).data.name, '新角色');
    assert.equal(Buffer.from(second).toString().split('chara\0').length - 1, 1);
    assert.throws(() => extractCard(base), /没有 V2/);
    assert.throws(() => extractCard(first.slice(0, 15)), /有效 PNG|不完整|结束/);
});
