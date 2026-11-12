import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCard, normalizeCard } from '../core.js';
import { FRONTEND_KEY, normalizeFrontend, starterFrontend, buildFrontendPrompt, attachFrontend, detachFrontend, stripFrontendSnapshot, resolveFrontendNames } from '../frontend.js';

test('前端配置限制模块、主题和字段类型，模板可按所选模块生成', () => {
    const spec = starterFrontend('雾灯书店', { theme: 'parchment', modules: ['stats', 'choices'] });
    assert.equal(spec.title, '雾灯书店'); assert.equal(spec.theme, 'parchment');
    assert.deepEqual(spec.modules, ['stats', 'choices']);
    assert.throws(() => normalizeFrontend({ ...spec, theme: 'javascript:evil' }), /主题/);
    assert.throws(() => normalizeFrontend({ ...spec, modules: [] }), /至少选择/);
    assert.throws(() => normalizeFrontend({ ...spec, modules: ['execute'] }), /有效/);
    assert.throws(() => normalizeFrontend({ ...spec, version: 9 }), /版本/);
    assert.throws(() => normalizeFrontend({ ...spec, title: {} }), /文本/);
});
test('属性范围、任务状态、物品数量和行动不能为空均被校验', () => {
    const spec = starterFrontend();
    assert.throws(() => normalizeFrontend({ ...spec, stats: [{ label: '体力', value: 200, max: 100 }] }), /属性值/);
    assert.throws(() => normalizeFrontend({ ...spec, stats: [{ label: '体力', value: '80', max: 100 }] }), /数字/);
    assert.throws(() => normalizeFrontend({ ...spec, quests: [{ title: '任务', state: '自动执行' }] }), /任务状态/);
    assert.throws(() => normalizeFrontend({ ...spec, inventory: [{ name: '书', quantity: 1.5 }] }), /整数/);
    assert.throws(() => normalizeFrontend({ ...spec, choices: [{ label: '调查', text: ' ' }] }), /不能为空/);
    assert.throws(() => normalizeFrontend({ ...spec, choices: Array(7).fill({ label: 'x', text: 'x' }) }), /最多 6/);
});
test('前端写入 V2 命名空间；重写快照不重复，移除保留原文和第三方扩展', () => {
    const card = emptyCard(); card.data.name = '书店'; card.data.first_mes = '你好，{{user}}。'; card.data.extensions.other = { keep: true };
    const one = attachFrontend(card, starterFrontend('书店'), '<section>面板</section>');
    const two = attachFrontend(one, starterFrontend('新版'), '<section>新版面板</section>');
    assert.equal((two.data.first_mes.match(/CF_FRONTEND_START/g) || []).length, 1);
    assert.equal(normalizeCard(two).data.extensions[FRONTEND_KEY].title, '新版');
    assert.deepEqual(detachFrontend(two), card);
    assert.equal(stripFrontendSnapshot('<div>用户自定义 HTML</div>'), '<div>用户自定义 HTML</div>');
    assert.equal(attachFrontend(two, starterFrontend('书店')).data.first_mes, card.data.first_mes);
    assert.equal(card.data.extensions[FRONTEND_KEY], undefined);
});
test('前端请求引用角色、排除已生成 HTML 和无关扩展，保护占位符', () => {
    const card = emptyCard(); card.data.name = '{{char}}'; card.data.description = '记忆书店'; card.data.first_mes = '你好，{{user}}。'; card.data.extensions.secretPlugin = { raw: 'UNRELATED_PLUGIN_DATA' };
    const attached = attachFrontend(card, starterFrontend(), '<div>SNAPSHOT_HTML</div>');
    const prompt = buildFrontendPrompt(attached, { theme: 'cyber', modules: ['quests', 'choices'], request: '调查面板' }, { language: 'English' });
    assert.match(prompt.prompt, /记忆书店/); assert.match(prompt.prompt, /调查面板/); assert.match(prompt.prompt, /English/);
    assert.doesNotMatch(prompt.prompt, /SNAPSHOT_HTML|UNRELATED_PLUGIN_DATA|\{\{/);
    assert.match(prompt.prompt, /⟦CF_OPEN⟧user⟦CF_CLOSE⟧/);
    assert.match(prompt.systemPrompt, /不要输出 HTML、CSS、JavaScript/);
});
test('显示时只替换角色与玩家名称，其他宏仍为普通文本', () => {
    const spec = starterFrontend('{{char}}'); spec.choices[0].text = '{{user}} 观察 {{getvar::secret}}。';
    const resolved = resolveFrontendNames(spec, '书店主人', '旅人');
    assert.equal(resolved.title, '书店主人');
    assert.equal(resolved.relationships[0].name, '旅人');
    assert.equal(resolved.choices[0].text, '旅人 观察 {{getvar::secret}}。');
    assert.equal(spec.title, '{{char}}');
});
