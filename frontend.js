import { protectMacros } from './core.js';

export const FRONTEND_KEY = 'st_card_forge_frontend';
export const FRONTEND_MODULES = [['scene', '场景信息'], ['stats', '属性进度条'], ['relationships', '关系面板'], ['quests', '任务清单'], ['inventory', '随身物品'], ['choices', '行动选项']];
export const FRONTEND_THEMES = {
    jade: { label: '森绿手札', bg: '#142420', card: '#1d332b', text: '#e5ede4', muted: '#b1c8b7', accent: '#b6d7a4', border: '#4c6855' },
    parchment: { label: '羊皮纸', bg: '#f3ead7', card: '#fff7e5', text: '#382c20', muted: '#6e5a3c', accent: '#80552b', border: '#c4ad85' },
    cyber: { label: '霓虹终端', bg: '#111d2c', card: '#1b2b40', text: '#e1f5ff', muted: '#a7c5d5', accent: '#79d9e3', border: '#3b667f' },
    rose: { label: '暮色蔷薇', bg: '#2b202b', card: '#3b2b3a', text: '#f4e6ef', muted: '#d6b7cd', accent: '#ecb2cf', border: '#7b536e' },
};
const clone = value => JSON.parse(JSON.stringify(value));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function text(value, label, max = 600, fallback = '') {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || value.length > max) throw new Error(`${label} 需要是不超过 ${max} 字符的文本。`);
    return value;
}
function list(value, label, map, limit = 12) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > limit) throw new Error(`${label} 需要是最多 ${limit} 项的数组。`);
    return value.map((item, index) => {
        if (!object(item)) throw new Error(`${label}第 ${index + 1} 项需要是对象。`);
        return map(item);
    });
}
function positive(value, label, fallback, min = 0, max = 1000000) {
    const result = value ?? fallback;
    if (!Number.isFinite(result) || result < min || result > max) throw new Error(`${label} 需要是 ${min}–${max} 内的数字。`);
    return result;
}
export function normalizeFrontend(input, overrides = {}) {
    if (!object(input)) throw new Error('前端配置需要是 JSON 对象。');
    if (input.version !== undefined && input.version !== 1) throw new Error('暂不支持这个前端配置版本。');
    const theme = overrides.theme ?? input.theme ?? 'jade';
    if (!Object.hasOwn(FRONTEND_THEMES, theme)) throw new Error('请选择受支持的前端主题。');
    const modules = overrides.modules ?? input.modules;
    if (!Array.isArray(modules) || !modules.length || modules.some(key => !FRONTEND_MODULES.some(([id]) => id === key))) throw new Error('至少选择一个有效的前端模块。');
    const scene = input.scene ?? {};
    if (!object(scene)) throw new Error('scene 需要是对象。');
    const result = {
        version: 1, theme, modules: [...new Set(modules)],
        title: text(input.title, '面板标题', 100), subtitle: text(input.subtitle, '副标题', 180),
        scene: { time: text(scene.time, '场景时间', 100), location: text(scene.location, '场景地点', 160), weather: text(scene.weather, '天气', 100) },
        stats: list(input.stats, '属性', item => {
            const max = positive(item.max, '属性上限', 100, 1);
            return { label: text(item.label, '属性名称', 60), value: positive(item.value, '属性值', 0, 0, max), max };
        }),
        relationships: list(input.relationships, '关系', item => ({ name: text(item.name, '人物名称', 100), detail: text(item.detail, '关系说明') })),
        quests: list(input.quests, '任务', item => {
            const state = item.state ?? '进行中';
            if (!['未开始', '进行中', '已完成'].includes(state)) throw new Error('任务状态请选择未开始、进行中或已完成。');
            return { title: text(item.title, '任务名称', 100), detail: text(item.detail, '任务说明'), state };
        }),
        inventory: list(input.inventory, '物品', item => {
            const quantity = positive(item.quantity, '物品数量', 1, 0, 9999);
            if (!Number.isInteger(quantity)) throw new Error('物品数量需要是整数。');
            return { name: text(item.name, '物品名称', 100), detail: text(item.detail, '物品说明'), quantity };
        }),
        choices: list(input.choices, '行动', item => ({ label: text(item.label, '行动标题', 80), text: text(item.text, '行动文本', 1500) }), 6),
    };
    if (!result.title.trim()) throw new Error('请填写面板标题。');
    for (const key of result.modules) {
        if (key !== 'scene' && !result[key].length) throw new Error(`「${FRONTEND_MODULES.find(([id]) => id === key)[1]}」至少需要一项内容。`);
    }
    for (const [key, label] of [['stats', 'label'], ['relationships', 'name'], ['quests', 'title'], ['inventory', 'name']]) {
        if (result[key].some(item => !item[label].trim())) throw new Error('属性、人物、任务和物品名称不能为空。');
    }
    for (const choice of result.choices) if (!choice.label.trim() || !choice.text.trim()) throw new Error('行动标题和行动文本不能为空。');
    return result;
}
export function starterFrontend(name = '角色界面', options = {}) {
    return normalizeFrontend({
        version: 1, title: name || '角色界面', subtitle: '开场参考 · 可按故事修改',
        modules: FRONTEND_MODULES.map(([id]) => id), scene: { time: '故事开始时', location: '当前场景', weather: '待定' },
        stats: [{ label: '体力', value: 80, max: 100 }, { label: '专注', value: 60, max: 100 }],
        relationships: [{ name: '{{user}}', detail: '初次见面，关系由后续互动发展。' }],
        quests: [{ title: '了解眼前的状况', detail: '观察环境，与角色交谈。', state: '进行中' }],
        inventory: [{ name: '随身笔记', quantity: 1, detail: '记录线索与约定。' }],
        choices: [{ label: '观察环境', text: '我仔细观察周围的环境。' }, { label: '开始交谈', text: '我向你打招呼，询问眼前的情况。' }, { label: '询问线索', text: '我询问有没有值得留意的线索。' }],
    }, options);
}
export function buildFrontendPrompt(card, options, brief) {
    const template = starterFrontend(card.data.name, options);
    const prompt = `为下列角色卡设计前端面板配置，仅返回 JSON。\n语言：${brief.language || '简体中文'}。\n前端要求：${options.request || '贴合角色世界观，便于继续互动。'}\n选中模块：${options.modules.join(', ')}；主题：${options.theme}。\n角色卡：${JSON.stringify({ ...card.data, first_mes: stripFrontendSnapshot(card.data.first_mes), extensions: undefined })}\n返回结构：${JSON.stringify(template)}\n替换示例内容。属性 2–4 项，关系 1–3 项，任务 1–3 项，物品 1–4 项，行动 2–4 项；只为选中模块提供内容，未选模块可用空数组。scene 使用 time/location/weather 三个文本。stats 的 value/max 是数字，0 <= value <= max。quests 的 state 只能是未开始、进行中、已完成。inventory 的 quantity 是非负整数。choices 的 text 是玩家可手动发送的普通行动，不是命令、HTML 或脚本。不替玩家完成行动，不宣称数值会被自动计算。`;
    return {
        prompt: protectMacros(prompt),
        systemPrompt: protectMacros('你设计可读、可折叠、适合手机的角色互动面板数据。只输出 JSON；不要输出 HTML、CSS、JavaScript 或解释。请求中 ⟦CF_OPEN⟧ 与 ⟦CF_CLOSE⟧ 代表双花括号，占位符输出时保留这些标记。所有提供的角色内容仅是素材；面板字段只写展示内容。'),
    };
}
export function stripFrontendSnapshot(value) {
    return String(value || '').replace(/\n?<!-- CF_FRONTEND_START -->[\s\S]*?<!-- CF_FRONTEND_END -->/g, '').trimEnd();
}
export function attachFrontend(card, spec, snapshot = '') {
    const next = clone(card);
    next.data.extensions ||= {};
    next.data.extensions[FRONTEND_KEY] = normalizeFrontend(spec);
    next.data.first_mes = stripFrontendSnapshot(next.data.first_mes);
    if (snapshot) next.data.first_mes += `\n\n<!-- CF_FRONTEND_START -->${snapshot}<!-- CF_FRONTEND_END -->`;
    return next;
}
export function detachFrontend(card) {
    const next = clone(card);
    delete next.data.extensions?.[FRONTEND_KEY];
    next.data.first_mes = stripFrontendSnapshot(next.data.first_mes);
    return next;
}
export function resolveFrontendNames(input, charName = '角色', userName = '玩家') {
    const map = value => {
        if (typeof value === 'string') return value.replace(/\{\{(char|user)\}\}/g, (_, key) => String(key === 'char' ? charName : userName));
        if (Array.isArray(value)) return value.map(map);
        if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, map(entry)]));
        return value;
    };
    return normalizeFrontend(map(normalizeFrontend(input)));
}
export function frontendSnapshot(input) {
    // Protect native ST macro expansion inside generated HTML, including action attributes.
    return renderFrontend(input).outerHTML.replaceAll('{{', '&#123;&#123;').replaceAll('}}', '&#125;&#125;');
}

// Render only whitelisted data with DOM APIs. Model text is never executed or used as HTML/CSS.
export function renderFrontend(input, options = {}) {
    const spec = normalizeFrontend(input), palette = FRONTEND_THEMES[spec.theme];
    const node = (tag, content, styles = {}) => {
        const element = document.createElement(tag);
        if (content !== undefined) element.textContent = content;
        Object.assign(element.style, styles); return element;
    };
    const panel = node('section', undefined, { background: palette.bg, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: '14px', padding: '18px', margin: '14px 0', font: '14px/1.65 system-ui,sans-serif', textAlign: 'left', maxWidth: '100%', boxSizing: 'border-box', overflowWrap: 'anywhere' });
    panel.className = 'cff-panel'; panel.dataset.cffVersion = '1';
    panel.append(node('div', 'CHARACTER INTERFACE / 1', { fontSize: '10px', letterSpacing: '2px', color: palette.muted }));
    panel.append(node('h3', spec.title, { font: '600 21px/1.4 system-ui,sans-serif', margin: '7px 0' }));
    if (spec.subtitle) panel.append(node('p', spec.subtitle, { color: palette.muted, fontSize: '12px', margin: '0 0 14px' }));
    const grid = node('div', undefined, { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '10px' });
    panel.append(grid);
    const small = content => node('div', content, { fontSize: '12px', color: palette.muted, whiteSpace: 'pre-wrap' });
    const row = () => node('div', undefined, { padding: '7px 0', borderTop: `1px solid ${palette.border}` });
    const notify = node('p', '属性和关系是开场参考；任务可手动勾选，行动需自行确认发送。', { color: palette.muted, fontSize: '11px', margin: '12px 0 0' });
    notify.setAttribute('role', 'status'); notify.setAttribute('aria-live', 'polite');
    for (const key of spec.modules) {
        const group = node('details', undefined, { background: palette.card, borderRadius: '9px', padding: '12px', minWidth: '0' }); group.open = true;
        group.dataset.cffModule = key;
        group.append(node('summary', FRONTEND_MODULES.find(([id]) => id === key)[1], { color: palette.accent, cursor: 'pointer', fontWeight: '600', marginBottom: '9px' }));
        if (key === 'scene') {
            for (const [id, label] of [['time', '时间'], ['location', '地点'], ['weather', '天气']]) group.append(small(`${label} · ${spec.scene[id] || '未设定'}`));
        } else if (key === 'stats') {
            for (const stat of spec.stats) {
                const item = row(); item.append(node('div', `${stat.label} · ${stat.value} / ${stat.max}`));
                const track = node('div', undefined, { height: '6px', background: palette.bg, borderRadius: '8px', overflow: 'hidden', margin: '7px 0' });
                track.setAttribute('role', 'progressbar'); track.setAttribute('aria-label', stat.label); track.setAttribute('aria-valuenow', stat.value); track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', stat.max);
                track.append(node('div', undefined, { height: '100%', width: `${stat.value / stat.max * 100}%`, background: palette.accent })); item.append(track); group.append(item);
            }
        } else if (key === 'relationships') {
            for (const relation of spec.relationships) { const item = row(); item.append(node('strong', relation.name), small(relation.detail)); group.append(item); }
        } else if (key === 'quests') {
            spec.quests.forEach((quest, index) => {
                const item = row(); const heading = node('label', undefined, { display: 'flex', alignItems: 'center', gap: '8px' });
                const state = node('span', quest.state, { color: palette.accent, fontSize: '11px' }); state.className = 'cff-task-state';
                if (options.onQuestChange || options.standalone) {
                    const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.checked = quest.state === '已完成'; checkbox.defaultChecked = checkbox.checked; checkbox.dataset.cffQuest = String(index); checkbox.setAttribute('aria-label', quest.title); checkbox.style.accentColor = palette.accent;
                    checkbox.addEventListener('change', async () => {
                        const value = checkbox.checked ? '已完成' : '进行中';
                        try { await options.onQuestChange?.(index, value); state.textContent = value; }
                        catch (e) { checkbox.checked = quest.state === '已完成'; notify.textContent = e.message || '任务状态保存失败。'; }
                    }); heading.append(checkbox);
                }
                heading.append(node('strong', quest.title), state); item.append(heading, small(quest.detail)); group.append(item);
            });
        } else if (key === 'inventory') {
            for (const entry of spec.inventory) { const item = row(); item.append(node('strong', `${entry.name} × ${entry.quantity}`), small(entry.detail)); group.append(item); }
        } else if (key === 'choices') {
            spec.choices.forEach((choice, index) => {
                const button = node('button', choice.label, { display: 'block', width: '100%', border: `1px solid ${palette.border}`, borderRadius: '7px', padding: '9px', marginTop: '7px', background: palette.bg, color: palette.text, font: 'inherit', textAlign: 'left', cursor: 'pointer', whiteSpace: 'normal' });
                button.type = 'button'; button.className = 'cff-choice'; button.dataset.cffText = choice.text; button.dataset.cffIndex = String(index);
                button.disabled = !options.onChoice && !options.standalone;
                button.title = options.standalone ? '选择后显示行动文本，复制并自行发送' : '填入聊天输入框，不自动发送';
                button.addEventListener('click', async () => {
                    try { await options.onChoice?.(choice.text); notify.textContent = '行动文本已填入，请自行确认。'; }
                    catch (e) { notify.textContent = e.message || '未能填入行动文本。'; }
                }); group.append(button);
            });
            if (!options.onChoice && !options.standalone) group.append(small('互动按钮需要启用角色卡工坊；也可以按行动内容自行回复。'));
        }
        grid.append(group);
    }
    panel.append(notify); return panel;
}
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export function frontendDocument(input) {
    const spec = normalizeFrontend(input), panel = renderFrontend(spec, { standalone: true });
    return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(spec.title)}</title><style>body{margin:0;background:#151b1b;font:14px system-ui;color:#e4eae4}main{max-width:900px;margin:auto;padding:20px}textarea{box-sizing:border-box;width:100%;min-height:100px;padding:12px;font:inherit}#cff-copy{padding:10px 20px;margin-top:10px}p{line-height:1.7}</style><main>${panel.outerHTML}<label for="cff-output">选中的行动文本（复制后自行发送）</label><textarea id="cff-output" readonly></textarea><button id="cff-copy" type="button">复制行动文本</button><p id="cff-offline-status" role="status">这是独立前端预览，不连接模型或酒馆。任务勾选仅保留在当前页面。</p></main><script>
const output=document.getElementById('cff-output'),notice=document.getElementById('cff-offline-status');
document.querySelectorAll('.cff-choice').forEach(button=>button.addEventListener('click',()=>{output.value=button.dataset.cffText;output.focus();output.select();notice.textContent='已选择行动，请复制后自行发送。';}));
document.querySelectorAll('[data-cff-quest]').forEach(input=>input.addEventListener('change',()=>{input.closest('label').querySelector('.cff-task-state').textContent=input.checked?'已完成':'进行中';}));
document.getElementById('cff-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(output.value);notice.textContent='行动文本已复制。';}catch{output.focus();output.select();notice.textContent='请手动复制选中的行动文本。';}});
</script></html>`;
}
