import { VERSION, TEXT_FIELDS, DEFAULT_BRIEF, DETAIL_SECTIONS, GENRES, generationOptions, emptyCard, normalizeCard, normalizeBook, parseModelJson, validateCard, buildPrompt, fileName } from './core.js';
import { embedCard, extractCard } from './png.js';
import { FRONTEND_KEY, FRONTEND_MODULES, FRONTEND_THEMES, normalizeFrontend, starterFrontend, buildFrontendPrompt, stripFrontendSnapshot, attachFrontend, detachFrontend, renderFrontend, frontendSnapshot, frontendDocument } from './frontend.js';
import { installFrontendRuntime } from './frontend-runtime.js';

const KEY = 'st_card_forge';
const MAX_FILE = 20 * 1024 * 1024;
let dialog, root, settings, card = emptyCard(), avatarData = '', rawOutput = '', activeTab = 'brief';
let busy = false, discardGeneration = false, chatBusy = false, lastFocus, saveTimer;
let importReceipt = '';
let frontendDraft = null;
const context = () => globalThis.SillyTavern?.getContext?.();
const $ = selector => root.querySelector(selector);
const $$ = selector => [...root.querySelectorAll(selector)];
const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
};
function status(message, error = false) {
    if (!root) return;
    $('#cf-status').textContent = message;
    $('#cf-status').classList.toggle('cf-error', error);
}
function action(label, fn, className = 'cf-button') {
    const button = el('button', className, label);
    button.type = 'button';
    button.addEventListener('click', () => Promise.resolve().then(fn).catch(e => status(e.message || String(e), true)));
    return button;
}
function getBrief() {
    return Object.fromEntries(Object.keys(DEFAULT_BRIEF).map(key => {
        const input = $(`[data-brief="${key}"]`);
        return [key, input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value];
    }));
}
function persist() {
    clearTimeout(saveTimer);
    settings.brief = getBrief();
    settings.card = structuredClone(card);
    if ($('#cf-front-theme')) {
        settings.frontendOptions = readFrontendOptions();
        settings.frontendDraft = frontendDraft;
    }
    context()?.saveSettingsDebounced?.();
}
function scheduleSave() {
    clearTimeout(saveTimer);
    updateDetailCounts(); syncGenerationOptions();
    saveTimer = setTimeout(persist, 450);
}
function updateDetailCounts() {
    let total = 0;
    for (const section of DETAIL_SECTIONS) {
        const filled = section.fields.filter(f => $(`[data-brief="${f.key}"]`)?.value.trim()).length;
        total += filled;
        const badge = $(`[data-detail-count="${section.id}"]`);
        if (badge) badge.textContent = `${filled}/${section.fields.length}`;
    }
    const counter = $('#cf-detail-total');
    if (counter) counter.textContent = `已填写 ${total} / ${DETAIL_SECTIONS.reduce((sum, s) => sum + s.fields.length, 0)} 项细节`;
}
function syncGenerationOptions() {
    const world = $('[data-brief="worldbook"]');
    const count = $('[data-brief="worldbookCount"]');
    if (!world || !count) return;
    count.disabled = busy || !world.checked;
    const options = generationOptions(getBrief());
    $('#cf-output-plan').textContent = `1 条主开场 · ${options.greetings} 条备选开场 · ${options.dialogues} 组对白${world.checked ? ` · ${options.worldEntries} 条世界书` : ''}`;
}
function loadCard(next) {
    const previousFrontend = JSON.stringify(card.data.extensions?.[FRONTEND_KEY]);
    card = normalizeCard(next);
    for (const [key] of TEXT_FIELDS) $(`[data-field="${key}"]`).value = card.data[key];
    $('#cf-tags').value = card.data.tags.join(', ');
    $('#cf-book').value = card.data.character_book ? JSON.stringify(card.data.character_book, null, 2) : '';
    if (previousFrontend !== JSON.stringify(card.data.extensions?.[FRONTEND_KEY])) {
        try { frontendDraft = card.data.extensions?.[FRONTEND_KEY] ? normalizeFrontend(card.data.extensions[FRONTEND_KEY]) : null; }
        catch { frontendDraft = null; }
        renderFrontendDraft();
    }
    $('#cf-front-attached').textContent = card.data.extensions?.[FRONTEND_KEY] ? '当前角色卡已附带前端配置' : '当前角色卡尚未附带前端';
    renderGreetings(); renderPreview(); updateStats(); persist();
}
function updateStats() {
    const data = card.data;
    const count = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example'].filter(k => data[k].trim()).length;
    $('#cf-completeness').textContent = `${count}/6 核心字段`;
    $('#cf-count').textContent = `${new Intl.NumberFormat().format(JSON.stringify(data).length)} 字符 · ${data.character_book?.entries.length || 0} 条世界书`;
}
function setTab(name) {
    activeTab = name;
    for (const button of $$('[data-tab]')) {
        const selected = button.dataset.tab === name;
        button.classList.toggle('cf-active', selected);
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
    }
    for (const panel of $$('[data-panel]')) panel.hidden = panel.dataset.panel !== name;
    if (name === 'preview') renderPreview();
}
function addBrief(parent, key, label, options = null, placeholder = '', rows = 1) {
    const wrapper = el('label', `cf-field${rows > 1 ? ' cf-wide' : ''}`);
    wrapper.append(el('span', 'cf-label', label));
    const input = el(options ? 'select' : rows > 1 ? 'textarea' : 'input', 'cf-input');
    input.dataset.brief = key;
    if (options) {
        for (const value of options) {
            const [id, text] = Array.isArray(value) ? value : [value, value];
            input.add(new Option(text, id));
        }
    } else {
        input.placeholder = placeholder;
        if (rows > 1) input.rows = rows;
        else input.type = 'text';
    }
    input.addEventListener('input', scheduleSave);
    wrapper.append(input); parent.append(wrapper); return input;
}
function personaOptions() {
    const select = $('[data-brief="persona"]');
    const previous = select.value;
    select.replaceChildren(new Option('不引用玩家人设', 'none'), new Option('引用当前玩家人设', 'current'));
    const power = context()?.powerUserSettings || {};
    for (const [id, name] of Object.entries(power.personas || {})) select.add(new Option(String(name), `saved:${id}`));
    select.value = [...select.options].some(o => o.value === previous) ? previous : 'none';
}
function personaText(brief) {
    const ctx = context(), power = ctx.powerUserSettings || {};
    if (brief.persona === 'current') return `${ctx.name1 || '玩家'}\n${power.persona_description || ''}`;
    if (brief.persona.startsWith('saved:')) {
        const id = brief.persona.slice(6);
        if (!Object.hasOwn(power.personas || {}, id)) throw new Error('所选玩家人设已不存在，请重新选择。');
        return `${power.personas[id]}\n${power.persona_descriptions?.[id]?.description || ''}`;
    }
    return '';
}
function refreshConnection() {
    const ctx = context();
    let preset = '';
    try { preset = ctx.getPresetManager?.()?.getSelectedPresetName?.() || ''; } catch { /* Optional API. */ }
    $('#cf-connection').textContent = `当前 API：${ctx.mainApi || '未选择'}${preset ? ` · 采样预设：${preset}` : ''}`;
    personaOptions();
}
function confirmInline(message, onConfirm) {
    const box = $('#cf-confirm');
    box.replaceChildren(el('span', '', message));
    box.append(action('确认', async () => { box.hidden = true; await onConfirm(); }, 'cf-button cf-danger'));
    box.append(action('取消', () => { box.hidden = true; }));
    box.hidden = false;
    box.querySelector('button').focus();
}
function setBusy(value, operation = 'generation') {
    busy = value;
    for (const node of $$('input, select, textarea, button')) {
        if (node.id === 'cf-close' || node.id === 'cf-discard' || node.id === 'cf-front-discard' || node.dataset.tab) continue;
        node.disabled = value;
    }
    $('#cf-discard').hidden = !value || operation !== 'generation';
    $('#cf-discard').disabled = false;
    $('#cf-generate').textContent = value ? operation === 'import' ? '正在导入…' : '正在生成…' : '✦ 生成角色卡';
    if ($('#cf-front-generate')) $('#cf-front-generate').textContent = value && operation === 'frontend' ? '正在生成前端…' : '✦ AI 生成前端';
    if ($('#cf-front-discard')) { $('#cf-front-discard').hidden = !value || operation !== 'frontend'; $('#cf-front-discard').disabled = false; }
    root.setAttribute('aria-busy', String(value));
    syncGenerationOptions();
}
async function generate(field = '') {
    if (busy) return;
    const ctx = context();
    if (typeof ctx?.generateRaw !== 'function') throw new Error('当前酒馆缺少 generateRaw 接口，请升级 SillyTavern。');
    if (chatBusy || ctx.streamingProcessor && !ctx.streamingProcessor.isFinished) throw new Error('酒馆正在生成聊天回复，请等回复结束后再生成角色卡。');
    if (!['openai', 'textgenerationwebui', 'kobold', 'koboldhorde', 'novel'].includes(ctx.mainApi)) throw new Error('请先在酒馆连接可用的文本生成 API。');
    const brief = getBrief();
    if (!brief.idea.trim() && !field) throw new Error('先写下核心设定，例如「经营午夜书店的失忆魔女」。');
    if (!Number.isInteger(brief.responseLength) || brief.responseLength < 256 || brief.responseLength > 16384) throw new Error('最大输出 tokens 需要是 256–16384 之间的整数。');
    if (field) {
        const book = $('#cf-book').value.trim();
        if (book) {
            try { card.data.character_book = normalizeBook(JSON.parse(book)); }
            catch (e) { throw new Error(`请先修正世界书 JSON：${e.message}`); }
        } else delete card.data.character_book;
    }
    const params = buildPrompt(brief, personaText(brief), card, field);
    persist();
    discardGeneration = false; importReceipt = ''; rawOutput = ''; $('#cf-raw').value = ''; setBusy(true);
    status(field ? `正在重写「${field === 'alternate_greetings' ? '备选开场白' : TEXT_FIELDS.find(f => f[0] === field)?.[1]}」…` : '正在向酒馆当前模型请求完整角色卡，请稍候…');
    try {
        const response = await ctx.generateRaw({ ...params, responseLength: brief.responseLength, trimNames: false });
        if (discardGeneration) { status('已放弃本次结果；之前的角色卡已保留。'); return; }
        rawOutput = typeof response === 'string' ? response : JSON.stringify(response);
        $('#cf-raw').value = rawOutput;
        const parsed = parseModelJson(rawOutput);
        if (field) {
            if (!parsed || typeof parsed !== 'object' || !Object.hasOwn(parsed, field)) throw new Error(`输出缺少 ${field} 字段，原角色卡已保留。`);
            const next = structuredClone(card);
            next.data[field] = parsed[field];
            loadCard(next);
        } else {
            const next = validateCard(parsed);
            if (!brief.worldbook) delete next.data.character_book;
            loadCard(next);
        }
        setTab('edit'); status('生成完成，草稿已自动保存。可修改后导入或导出。');
    } catch (e) {
        if (discardGeneration) status('已放弃本次结果；之前的角色卡已保留。');
        else status(`${e.message || String(e)}${rawOutput ? ' 可在「创作 → 原始输出」中查看。' : ''}`, true);
    } finally { setBusy(false); }
}
function requestGenerate(field = '') {
    if (!field && ['description', 'first_mes'].some(k => card.data[k].trim())) {
        confirmInline('重新生成整卡会替换当前草稿内容。继续？', () => generate());
    } else if (field && (Array.isArray(card.data[field]) ? card.data[field].length : card.data[field]?.trim())) {
        confirmInline('重写会替换该字段；其余字段保留。继续？', () => generate(field));
    } else return generate(field);
}
function renderGreetings() {
    const list = $('#cf-greetings'); list.replaceChildren();
    card.data.alternate_greetings.forEach((text, index) => {
        const row = el('div', 'cf-greeting');
        const label = el('label', 'cf-field'); label.append(el('span', 'cf-label', `备选开场白 ${index + 1}`));
        const input = el('textarea', 'cf-input'); input.rows = 5; input.value = text;
        input.addEventListener('input', () => { card.data.alternate_greetings[index] = input.value; scheduleSave(); updateStats(); });
        label.append(input);
        row.append(label, action('删除', () => { card.data.alternate_greetings.splice(index, 1); renderGreetings(); persist(); updateStats(); }, 'cf-button cf-small'));
        list.append(row);
    });
}
function renderPreview() {
    const preview = $('#cf-preview'); preview.replaceChildren();
    const heading = el('div', 'cf-preview-heading');
    if (avatarData) { const img = el('img', 'cf-preview-avatar'); img.src = avatarData; img.alt = '角色头像'; heading.append(img); }
    else heading.append(el('div', 'cf-preview-placeholder', '✦'));
    const intro = el('div'); intro.append(el('div', 'cf-eyebrow', 'CHARACTER CARD / V2'), el('h2', '', card.data.name || '未命名角色'));
    const tags = el('div', 'cf-tags');
    for (const tag of card.data.tags) tags.append(el('span', 'cf-tag', tag));
    intro.append(tags); heading.append(intro); preview.append(heading);
    if (card.data.extensions?.[FRONTEND_KEY]) {
        try { preview.append(renderFrontend(card.data.extensions[FRONTEND_KEY], { onChoice: text => status(`预览行动：${text}`) })); }
        catch { preview.append(el('p', 'cf-hint', '卡内前端配置暂时无法预览，可在前端页重新生成。')); }
    }
    const fields = TEXT_FIELDS.filter(([key]) => !['name', 'creator', 'character_version'].includes(key));
    for (const [key, label] of fields) {
        if (!card.data[key]) continue;
        const section = el('section', 'cf-preview-section');
        section.append(el('h3', '', label), el('p', 'cf-prose', key === 'first_mes' ? stripFrontendSnapshot(card.data[key]) : card.data[key])); preview.append(section);
    }
    card.data.alternate_greetings.forEach((text, i) => {
        const section = el('section', 'cf-preview-section');
        section.append(el('h3', '', `备选开场白 ${i + 1}`), el('p', 'cf-prose', text)); preview.append(section);
    });
    for (const entry of card.data.character_book?.entries || []) {
        const section = el('section', 'cf-preview-section');
        section.append(el('h3', '', `世界书 · ${entry.keys.join(' / ') || '常驻条目'}${entry.enabled ? '' : '（已禁用）'}`), el('p', 'cf-prose', entry.content)); preview.append(section);
    }
    if (!card.data.description) preview.append(el('p', 'cf-hint', '角色还没有内容。先生成一张卡，或在编辑页手动填写。'));
}
function currentCard() {
    // A JSON editor may contain invalid unsaved text; do not silently export old lore.
    const text = $('#cf-book').value.trim();
    const next = structuredClone(card);
    if (text) {
        try { next.data.character_book = normalizeBook(JSON.parse(text)); }
        catch (e) { throw new Error(`世界书 JSON 无效：${e.message}`); }
    } else delete next.data.character_book;
    return validateCard(next);
}
function download(blob, name) {
    const url = URL.createObjectURL(blob), anchor = el('a');
    anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function readFrontendOptions() {
    return {
        theme: $('#cf-front-theme').value,
        modules: $$('[data-front-module]').filter(input => input.checked).map(input => input.dataset.frontModule),
        request: $('#cf-front-request').value,
        showInGreeting: $('#cf-front-snapshot')?.checked ?? true,
    };
}
function readFrontendEditor() {
    return normalizeFrontend(parseModelJson($('#cf-front-json').value));
}
function renderFrontendDraft() {
    const host = $('#cf-front-preview'); if (!host) return;
    host.replaceChildren();
    $('#cf-front-json').value = frontendDraft ? JSON.stringify(frontendDraft, null, 2) : '';
    if (!frontendDraft) { host.append(el('p', 'cf-hint', '选择模块和主题后生成前端，或先创建基础模板。')); return; }
    host.append(renderFrontend(frontendDraft, {
        onChoice: text => { $('#cf-front-action').value = text; status('这是前端预览，行动尚未发送。'); },
        onQuestChange: (index, value) => {
            const next = readFrontendEditor();
            if (!next.quests[index]) throw new Error('请先刷新 JSON 预览。');
            next.quests[index].state = value; frontendDraft = next; renderFrontendDraft(); persist();
        },
    }));
}
async function generateFrontend() {
    if (busy) return;
    const ctx = context(), source = currentCard(), options = readFrontendOptions();
    if (chatBusy || ctx.streamingProcessor && !ctx.streamingProcessor.isFinished) throw new Error('请等酒馆聊天生成结束后再生成前端。');
    if (!options.modules.length) throw new Error('请至少选择一个前端模块。');
    if (typeof ctx.generateRaw !== 'function' || !['openai', 'textgenerationwebui', 'kobold', 'koboldhorde', 'novel'].includes(ctx.mainApi)) throw new Error('请先连接酒馆的文本生成 API。');
    const brief = getBrief();
    if (!Number.isInteger(brief.responseLength) || brief.responseLength < 256 || brief.responseLength > 16384) throw new Error('请在创作页设置有效的最大输出 tokens（256–16384）。');
    persist(); discardGeneration = false; $('#cf-front-raw').value = ''; setBusy(true, 'frontend'); status('正在为当前角色生成前端配置…');
    try {
        const raw = await ctx.generateRaw({ ...buildFrontendPrompt(source, options, brief), responseLength: brief.responseLength, trimNames: false });
        if (discardGeneration) { status('已放弃本次前端结果，之前的草稿已保留。'); return; }
        $('#cf-front-raw').value = typeof raw === 'string' ? raw : JSON.stringify(raw);
        frontendDraft = normalizeFrontend(parseModelJson($('#cf-front-raw').value), options);
        renderFrontendDraft(); persist(); status('前端已生成。检查预览后点击「写入角色卡」。');
    } catch (error) {
        status(discardGeneration ? '已放弃本次前端结果。' : `前端生成失败：${error.message || String(error)}。原有草稿保留；可查看本次原始输出。`, !discardGeneration);
    } finally { setBusy(false); }
}
function buildFrontendUI() {
    const panel = el('section', 'cf-panel'); panel.dataset.panel = 'frontend';
    const layout = el('div', 'cf-front-layout'); panel.append(layout);
    const controls = el('div', 'cf-surface'); controls.append(el('div', 'cf-eyebrow', 'FRONTEND BUILDER'), el('h3', '', '生成可互动的角色面板'));
    controls.append(el('p', 'cf-hint', '先生成或填写角色卡，再用当前酒馆模型设计面板。也可免费创建基础模板。'));
    const saved = settings.frontendOptions || {};
    const themeLabel = el('label', 'cf-field'); themeLabel.append(el('span', 'cf-label', '面板主题'));
    const theme = el('select', 'cf-input'); theme.id = 'cf-front-theme';
    for (const [id, value] of Object.entries(FRONTEND_THEMES)) theme.add(new Option(value.label, id));
    theme.value = Object.hasOwn(FRONTEND_THEMES, saved.theme) ? saved.theme : 'jade'; theme.addEventListener('change', scheduleSave); themeLabel.append(theme); controls.append(themeLabel);
    const choices = el('fieldset', 'cf-front-modules'); choices.append(el('legend', 'cf-label', '生成模块'));
    for (const [id, label] of FRONTEND_MODULES) {
        const item = el('label', 'cf-checkbox'), input = el('input'); input.type = 'checkbox'; input.dataset.frontModule = id;
        input.checked = Array.isArray(saved.modules) ? saved.modules.includes(id) : true; input.addEventListener('change', scheduleSave); item.append(input, el('span', '', label)); choices.append(item);
    }
    controls.append(choices);
    const requestLabel = el('label', 'cf-field'); requestLabel.append(el('span', 'cf-label', '前端需求'));
    const request = el('textarea', 'cf-input'); request.id = 'cf-front-request'; request.rows = 4; request.value = typeof saved.request === 'string' ? saved.request : '';
    request.placeholder = '例如：适合魔法书店，显示专注、魔力、与旅人的关系，给出三个调查行动。'; request.addEventListener('input', scheduleSave); requestLabel.append(request); controls.append(requestLabel);
    const generate = action('✦ AI 生成前端', generateFrontend, 'cf-button cf-primary cf-full'); generate.id = 'cf-front-generate'; controls.append(generate);
    const discard = action('放弃本次前端结果', () => { discardGeneration = true; discard.disabled = true; status('将忽略本次前端结果。请求可能继续计费，请等待返回。'); }, 'cf-button cf-full'); discard.id = 'cf-front-discard'; discard.hidden = true; controls.append(discard);
    controls.append(action('创建基础模板', () => { frontendDraft = starterFrontend(card.data.name || '角色界面', readFrontendOptions()); renderFrontendDraft(); persist(); status('基础模板已创建，可编辑后写入角色卡。'); }, 'cf-button cf-full'));
    const snapshotLabel = el('label', 'cf-checkbox'); const snapshot = el('input'); snapshot.type = 'checkbox'; snapshot.checked = saved.showInGreeting !== false; snapshot.id = 'cf-front-snapshot'; snapshot.addEventListener('change', scheduleSave); snapshotLabel.append(snapshot, el('span', '', '在主开场附带可显示的面板')); controls.append(snapshotLabel);
    const attached = el('p', 'cf-hint'); attached.id = 'cf-front-attached'; controls.append(attached);
    controls.append(action('写入角色卡', () => {
        const next = readFrontendEditor(), source = currentCard();
        confirmInline('将前端配置写入当前角色卡草稿？之后可导出或导入酒馆。', () => {
            frontendDraft = next;
            loadCard(attachFrontend(source, next, snapshot.checked ? frontendSnapshot(next) : ''));
            status('前端已写入角色卡草稿。请导出或导入酒馆以保存角色。');
        });
    }, 'cf-button cf-primary cf-full'));
    controls.append(action('导出独立 HTML', () => {
        const spec = readFrontendEditor(); download(new Blob([frontendDocument(spec)], { type: 'text/html;charset=utf-8' }), `${fileName(spec.title)}-frontend.html`); status('独立 HTML 已导出，可在浏览器打开。');
    }, 'cf-button cf-full'));
    controls.append(action('移除卡内前端', () => confirmInline('移除本工坊附带的前端配置和开场面板？角色文字保留。', () => { loadCard(detachFrontend(card)); status('已移除卡内前端。'); }), 'cf-button cf-full'));
    controls.append(el('p', 'cf-hint', '属性和关系是开场参考，不会自动计算。任务可在单角色聊天中手动勾选。行动按钮只填入输入框，发送由你确认。酒馆互动需要启用本扩展。'));
    layout.append(controls);
    const work = el('div'); const preview = el('div'); preview.id = 'cf-front-preview'; work.append(preview);
    const outputLabel = el('label', 'cf-field'); outputLabel.append(el('span', 'cf-label', '预览中选中的行动'));
    const output = el('textarea', 'cf-input'); output.id = 'cf-front-action'; output.rows = 2; output.readOnly = true; outputLabel.append(output); work.append(outputLabel);
    const editor = el('details', 'cf-surface'); editor.append(el('summary', '', '编辑前端配置 JSON'));
    const json = el('textarea', 'cf-input cf-code'); json.id = 'cf-front-json'; json.rows = 16; json.setAttribute('aria-label', '前端配置 JSON'); editor.append(json);
    editor.append(action('刷新前端预览', () => { frontendDraft = readFrontendEditor(); renderFrontendDraft(); persist(); status('前端预览已更新，写入角色卡后才会随卡导出。'); })); work.append(editor);
    const rawBox = el('details', 'cf-surface'); rawBox.append(el('summary', '', '本次前端原始输出'));
    const raw = el('textarea', 'cf-input cf-code'); raw.id = 'cf-front-raw'; raw.rows = 10; raw.setAttribute('aria-label', '前端原始输出'); rawBox.append(raw);
    rawBox.append(action('解析前端原始输出', () => { frontendDraft = normalizeFrontend(parseModelJson(raw.value)); renderFrontendDraft(); persist(); status('前端配置已解析，请检查预览。'); })); work.append(rawBox);
    layout.append(work); return panel;
}
async function pngCard(next) {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 900;
    const paint = canvas.getContext('2d');
    if (!paint) throw new Error('浏览器无法创建 PNG，请改用 JSON 导出。');
    if (avatarData) {
        const image = new Image(); image.src = avatarData; await image.decode();
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        paint.drawImage(image, 0, 0);
    } else {
        const gradient = paint.createLinearGradient(0, 0, 600, 900);
        gradient.addColorStop(0, '#183936'); gradient.addColorStop(1, '#10191c');
        paint.fillStyle = gradient; paint.fillRect(0, 0, 600, 900);
        paint.strokeStyle = '#83bca2'; paint.lineWidth = 2; paint.strokeRect(38, 38, 524, 824);
        paint.textAlign = 'center'; paint.fillStyle = '#d4e9d8'; paint.font = '80px serif'; paint.fillText('✦', 300, 330);
        const title = Array.from(next.data.name);
        paint.font = 'bold 40px sans-serif';
        for (let i = 0; i < Math.min(title.length, 36); i += 12) paint.fillText(title.slice(i, i + 12).join(''), 300, 465 + i / 12 * 60, 480);
        paint.fillStyle = '#8bb4a3'; paint.font = '20px sans-serif'; paint.fillText('CHARACTER CARD · V2', 300, 785);
    }
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG 编码失败。')), 'image/png'));
    return embedCard(new Uint8Array(await blob.arrayBuffer()), next);
}
async function exportCard(format) {
    const next = currentCard();
    const blob = format === 'png' ? await pngCard(next) : new Blob([JSON.stringify(next, null, 2)], { type: 'application/json' });
    download(blob, `${fileName(next.data.name)}.${format}`);
    status(`已导出 ${format.toUpperCase()} 角色卡。`);
}
async function importToTavern() {
    const next = currentCard();
    const receipt = JSON.stringify(next) + avatarData;
    if (receipt === importReceipt) { status('这张卡已导入。修改内容后可创建新副本；也可在角色列表查找。'); return; }
    const name = next.data.name;
    confirmInline(`将「${name}」添加为一个新角色？`, async () => {
        if (busy) return;
        if (chatBusy) throw new Error('请等聊天生成结束后再导入。');
        setBusy(true, 'import');
        let imported = false;
        try {
            const ctx = context(), form = new FormData();
            const png = await pngCard(next);
            form.append('avatar', new File([png], `${fileName(name)}.png`, { type: 'image/png' }));
            form.append('file_type', 'png'); form.append('user_name', ctx.name1 || 'User');
            if (typeof ctx.getRequestHeaders !== 'function') throw new Error('酒馆请求接口不可用，请使用导出文件后手动导入。');
            const headers = new Headers(ctx.getRequestHeaders({ omitContentType: true }));
            headers.delete('Content-Type');
            const response = await fetch('/api/characters/import', { method: 'POST', headers, body: form });
            if (!response.ok) throw new Error(`角色导入失败（HTTP ${response.status}），可导出 PNG 后手动导入。`);
            const data = await response.json();
            if (data.error || !data.file_name) throw new Error(`角色导入失败：${data.error || '服务器未返回角色文件名'}`);
            imported = true; importReceipt = receipt;
            if (typeof ctx.getCharacters === 'function') await ctx.getCharacters();
            status(`已添加新角色「${name}」，请到酒馆角色列表查看。`);
        } catch (e) {
            status(imported ? `角色已导入，但列表刷新失败。刷新页面后查看「${name}」，请勿重复导入。` : e.message || String(e), true);
        } finally { setBusy(false); }
    });
}
async function readFile(file, asDataUrl = false) {
    if (!file) return null;
    if (file.size > MAX_FILE) throw new Error('文件超过 20 MB，请换用较小文件。');
    if (asDataUrl) return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
    });
    return file;
}
async function setAvatar(file) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('头像支持 PNG、JPG 和 WebP。');
    const data = await readFile(file, true), image = new Image(); image.src = data; await image.decode();
    // Resize locally to cap export memory; strip previous embedded card metadata.
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    avatarData = canvas.toDataURL('image/png'); renderPreview();
    $('#cf-avatar-state').textContent = `${file.name} · ${canvas.width}×${canvas.height}`;
    status('头像已载入。本次会话中保留；角色文字会自动保存。');
}
async function openCardFile(file) {
    if (!file) return;
    await readFile(file);
    const png = file.name.toLowerCase().endsWith('.png');
    let input;
    try { input = png ? extractCard(new Uint8Array(await file.arrayBuffer())) : JSON.parse(await file.text()); }
    catch (e) { throw new Error(`读取角色卡失败：${e.message}`); }
    const next = normalizeCard(input);
    confirmInline(`载入「${next.data.name || '未命名角色'}」并替换当前草稿？`, async () => {
        if (png) await setAvatar(file);
        else { avatarData = ''; $('#cf-avatar-state').textContent = '尚未选择头像 · 自动生成文字封面'; }
        loadCard(next); setTab('edit'); status('角色卡已载入，可继续编辑。');
    });
}

function buildUI() {
    const savedFrontendDraft = settings.frontendDraft;
    dialog = el('dialog', 'cf-dialog'); dialog.id = 'cf-dialog'; dialog.setAttribute('aria-labelledby', 'cf-title');
    root = el('div', 'cf-app'); dialog.append(root);
    const header = el('header', 'cf-header');
    const brand = el('div', 'cf-brand'); brand.append(el('span', 'cf-mark', '✦'));
    const titles = el('div'); const title = el('h2', '', '角色卡工坊'); title.id = 'cf-title';
    titles.append(el('div', 'cf-eyebrow', `CARD FORGE / ${VERSION}`), title); brand.append(titles);
    const close = action('关闭', () => dialog.close(), 'cf-button cf-small'); close.id = 'cf-close';
    header.append(brand, close); root.append(header);
    const tabs = el('div', 'cf-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '角色卡工作区');
    [['brief', '01 创作'], ['edit', '02 角色卡'], ['preview', '03 预览'], ['frontend', '04 前端']].forEach(([id, text]) => {
        const button = action(text, () => setTab(id), 'cf-tab'); button.dataset.tab = id; button.id = `cf-tab-${id}`;
        button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', `cf-panel-${id}`); tabs.append(button);
    });
    tabs.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const buttons = [...tabs.children], index = buttons.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length;
        setTab(buttons[next].dataset.tab); buttons[next].focus();
    });
    root.append(tabs);
    const scroll = el('div', 'cf-scroll'); root.append(scroll);
    const briefPanel = el('section', 'cf-panel'); briefPanel.dataset.panel = 'brief';
    const grid = el('div', 'cf-brief-layout'); briefPanel.append(grid);
    const form = el('div', 'cf-surface'); grid.append(form);
    form.append(el('div', 'cf-eyebrow', 'THE IDEA'), el('h3', '', '从一个念头开始'));
    addBrief(form, 'idea', '核心设定', null, '例如：经营午夜书店的失忆魔女，能从旧书读到顾客遗忘的记忆。', 5);
    const pairs = el('div', 'cf-grid'); form.append(pairs);
    addBrief(pairs, 'name', '角色名称', null, '留空，让模型取名');
    addBrief(pairs, 'genre', '题材', GENRES);
    addBrief(pairs, 'language', '语言', ['简体中文', '繁體中文', 'English', '日本語']);
    addBrief(pairs, 'style', '叙述风格', ['细腻沉浸', '轻松幽默', '简洁直接', '文学叙事', '戏剧张力']);
    addBrief(pairs, 'detail', '内容篇幅', ['精简', '标准', '详细', '深度']);
    addBrief(pairs, 'persona', '玩家人设参考', [['none', '不引用玩家人设'], ['current', '引用当前玩家人设']]);
    addBrief(form, 'relationship', '与玩家的关系', null, '初次见面 / 旧友 / 委托人与向导…');
    addBrief(form, 'requirements', '额外要求', null, '外貌、背景、互动方式、希望避开的设定…', 3);
    const detailHeading = el('div', 'cf-detail-heading');
    detailHeading.append(el('div', 'cf-eyebrow', 'CHARACTER DETAILS'), el('h3', '', '把角色写得更具体'));
    const detailCounter = el('span', 'cf-tag'); detailCounter.id = 'cf-detail-total'; detailHeading.append(detailCounter);
    form.append(detailHeading, el('p', 'cf-hint cf-detail-intro', '以下细节全部可选。填写的内容会参与生成和字段重写；留空可交给模型发挥。性别可保持不指定。'));
    const detailActions = el('div', 'cf-detail-actions');
    detailActions.append(action('展开全部', () => $$('[data-detail-section]').forEach(node => { node.open = true; }), 'cf-button cf-small'));
    detailActions.append(action('收起全部', () => $$('[data-detail-section]').forEach(node => { node.open = false; }), 'cf-button cf-small'));
    detailActions.append(action('清空细节', () => confirmInline('清空这 35 项创作细节？已生成的角色卡、核心设定和数量选项保留。', () => {
        for (const section of DETAIL_SECTIONS) for (const field of section.fields) $(`[data-brief="${field.key}"]`).value = '';
        updateDetailCounts(); persist(); status('已清空创作细节。');
    }), 'cf-button cf-small'));
    form.append(detailActions);
    for (const section of DETAIL_SECTIONS) {
        const group = el('details', 'cf-detail-group'); group.dataset.detailSection = section.id;
        const summary = el('summary'); const badge = el('span', 'cf-tag'); badge.dataset.detailCount = section.id;
        summary.append(el('span', '', section.title), badge); group.append(summary, el('p', 'cf-hint', section.hint));
        const controls = el('div', 'cf-grid cf-detail-grid');
        for (const field of section.fields) addBrief(controls, field.key, field.label, field.options || null, field.placeholder || '', field.rows || 1);
        group.append(controls); form.append(group);
    }
    const world = el('label', 'cf-checkbox'); const checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.dataset.brief = 'worldbook'; checkbox.addEventListener('change', scheduleSave);
    world.append(checkbox, el('span', '', '同时生成内嵌世界书')); form.append(world);
    const aside = el('aside', 'cf-aside'); grid.append(aside);
    const connection = el('div', 'cf-surface'); connection.append(el('div', 'cf-eyebrow', 'GENERATION'), el('h3', '', '使用酒馆当前模型'));
    const badge = el('p', 'cf-hint'); badge.id = 'cf-connection'; connection.append(badge);
    connection.append(el('p', 'cf-hint', '沿用当前连接和采样设置。使用独立的制卡提示，不附带当前聊天、角色卡或预设提示词。其他酒馆扩展可能修改请求。'));
    const length = addBrief(connection, 'responseLength', '最大输出 tokens', null); length.type = 'number'; length.min = '256'; length.max = '16384'; length.step = '256';
    addBrief(connection, 'greetingCount', '备选开场白数量', [['0', '0 条（仅主开场）'], ['1', '1 条'], ['2', '2 条'], ['3', '3 条'], ['4', '4 条'], ['5', '5 条']]);
    addBrief(connection, 'dialogueCount', '对话示例组数', [['1', '1 组'], ['2', '2 组'], ['3', '3 组'], ['4', '4 组'], ['5', '5 组'], ['6', '6 组']]);
    addBrief(connection, 'worldbookCount', '世界书条目数', [['3', '3 条'], ['5', '5 条'], ['8', '8 条'], ['10', '10 条']]);
    const outputPlan = el('p', 'cf-hint'); outputPlan.id = 'cf-output-plan'; connection.append(outputPlan);
    connection.append(el('p', 'cf-hint', '详细或深度模式建议 8192 tokens；大量开场和世界书可按模型上限提高。数量越多，占用的输出空间越大。生成会消耗当前 API 额度。'));
    const generateButton = action('✦ 生成角色卡', () => requestGenerate(), 'cf-button cf-primary cf-full'); generateButton.id = 'cf-generate'; connection.append(generateButton);
    const discard = action('放弃本次结果', () => { discardGeneration = true; $('#cf-discard').disabled = true; status('将忽略本次结果。请求可能继续计费，等待返回后可再次生成。'); }, 'cf-button cf-full'); discard.id = 'cf-discard'; discard.hidden = true; connection.append(discard);
    aside.append(connection);
    const tools = el('div', 'cf-surface'); tools.append(el('div', 'cf-eyebrow', 'WORKSPACE'), el('h3', '', '载入与草稿'));
    const input = el('input'); input.type = 'file'; input.accept = '.json,.png'; input.hidden = true; input.id = 'cf-card-file';
    input.addEventListener('change', () => { const file = input.files[0]; input.value = ''; openCardFile(file).catch(e => status(e.message, true)); });
    tools.append(input, action('载入 JSON / PNG 卡', () => input.click(), 'cf-button cf-full'));
    tools.append(action('新建空白角色卡', () => confirmInline('清空当前角色卡和头像？创作设定保留。', () => {
        avatarData = ''; importReceipt = ''; rawOutput = ''; $('#cf-raw').value = ''; frontendDraft = null; renderFrontendDraft();
        $('#cf-avatar-state').textContent = '尚未选择头像 · 自动生成文字封面'; loadCard(emptyCard()); status('已新建空白角色卡。');
    }), 'cf-button cf-full'));
    tools.append(el('p', 'cf-hint', '自动保存一份文字草稿。头像仅在本次页面会话保留，刷新前请导出 PNG。')); aside.append(tools);
    const raw = el('details', 'cf-surface'); raw.append(el('summary', '', '原始输出 / 格式修复'));
    const rawArea = el('textarea', 'cf-input cf-code'); rawArea.id = 'cf-raw'; rawArea.rows = 8; rawArea.setAttribute('aria-label', '模型原始输出'); rawArea.placeholder = '模型输出会显示在这里；格式错误时可手动修正后重新解析。'; raw.append(rawArea);
    raw.append(action('解析为完整角色卡', () => {
        const next = validateCard(parseModelJson(rawArea.value));
        confirmInline('将修正后的完整角色卡载入并替换当前草稿？', () => { loadCard(next); setTab('edit'); status('已解析并载入角色卡。'); });
    })); aside.append(raw); scroll.append(briefPanel);

    const editor = el('section', 'cf-panel'); editor.dataset.panel = 'edit';
    const editorTop = el('div', 'cf-editor-top'); editorTop.append(el('div', 'cf-eyebrow', 'MAKE IT YOURS'));
    const completeness = el('span', 'cf-tag'); completeness.id = 'cf-completeness'; editorTop.append(completeness); editor.append(editorTop);
    const portrait = el('div', 'cf-surface cf-portrait');
    const avatarInput = el('input'); avatarInput.type = 'file'; avatarInput.accept = 'image/png,image/jpeg,image/webp'; avatarInput.hidden = true;
    avatarInput.addEventListener('change', () => { const file = avatarInput.files[0]; avatarInput.value = ''; setAvatar(file).catch(e => status(e.message, true)); });
    const avatarState = el('span', 'cf-hint', '尚未选择头像 · 自动生成文字封面'); avatarState.id = 'cf-avatar-state';
    portrait.append(avatarInput, action('上传头像', () => avatarInput.click()), action('移除头像', () => { avatarData = ''; avatarState.textContent = '尚未选择头像 · 自动生成文字封面'; renderPreview(); }), avatarState); editor.append(portrait);
    const fields = el('div', 'cf-editor-fields'); editor.append(fields);
    for (const [key, label, rows] of TEXT_FIELDS) {
        const wrapper = el('section', 'cf-surface cf-edit-field');
        const heading = el('div', 'cf-field-heading');
        const labelNode = el('label', 'cf-label', label); labelNode.htmlFor = `cf-field-${key}`; heading.append(labelNode);
        if (!['creator', 'character_version'].includes(key)) heading.append(action('✦ 重写', () => requestGenerate(key), 'cf-button cf-small'));
        const area = el(rows === 1 ? 'input' : 'textarea', 'cf-input'); area.id = `cf-field-${key}`; area.dataset.field = key;
        if (rows > 1) area.rows = rows;
        else area.type = 'text';
        area.addEventListener('input', () => { card.data[key] = area.value; scheduleSave(); updateStats(); });
        wrapper.append(heading, area);
        if (key === 'mes_example') wrapper.append(el('p', 'cf-hint', '格式：<START> 换行 {{user}}: … 换行 {{char}}: …'));
        if (key === 'system_prompt' || key === 'post_history_instructions') wrapper.append(el('p', 'cf-hint', '可留空；是否生效由酒馆的角色指令偏好决定。'));
        fields.append(wrapper);
    }
    const tagsSection = el('section', 'cf-surface'); const tagsLabel = el('label', 'cf-label', '标签（逗号分隔）'); tagsLabel.htmlFor = 'cf-tags';
    const tagsInput = el('input', 'cf-input'); tagsInput.id = 'cf-tags'; tagsInput.type = 'text';
    tagsInput.addEventListener('input', () => { card.data.tags = tagsInput.value.split(/[,，]/).map(x => x.trim()).filter(Boolean); scheduleSave(); updateStats(); }); tagsSection.append(tagsLabel, tagsInput); editor.append(tagsSection);
    const greetings = el('section', 'cf-surface'); const greetingHeading = el('div', 'cf-field-heading'); greetingHeading.append(el('h3', '', '备选开场白'), action('✦ 重写', () => requestGenerate('alternate_greetings'), 'cf-button cf-small'));
    const greetingList = el('div'); greetingList.id = 'cf-greetings'; greetings.append(greetingHeading, greetingList, action('+ 添加开场白', () => { card.data.alternate_greetings.push(''); renderGreetings(); persist(); })); editor.append(greetings);
    const bookSection = el('details', 'cf-surface'); bookSection.append(el('summary', '', '内嵌世界书（JSON）'));
    bookSection.append(el('p', 'cf-hint', '可修改条目、关键词和内容；清空表示移除世界书。JSON 无效时会阻止导出和导入。'));
    const bookInput = el('textarea', 'cf-input cf-code'); bookInput.id = 'cf-book'; bookInput.rows = 14; bookInput.setAttribute('aria-label', '内嵌世界书 JSON');
    bookInput.addEventListener('input', () => {
        try {
            if (!bookInput.value.trim()) delete card.data.character_book;
            else card.data.character_book = normalizeBook(JSON.parse(bookInput.value));
            bookInput.setAttribute('aria-invalid', 'false'); scheduleSave(); updateStats();
        } catch { bookInput.setAttribute('aria-invalid', 'true'); status('世界书 JSON 尚未有效，修正后才可导出或导入。', true); }
    });
    bookSection.append(bookInput); editor.append(bookSection); scroll.append(editor);
    const preview = el('section', 'cf-panel'); preview.dataset.panel = 'preview'; const previewCard = el('article', 'cf-preview'); previewCard.id = 'cf-preview'; preview.append(previewCard); scroll.append(preview);
    const frontendPanel = buildFrontendUI(); scroll.append(frontendPanel);
    for (const panel of [briefPanel, editor, preview, frontendPanel]) {
        panel.id = `cf-panel-${panel.dataset.panel}`; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', `cf-tab-${panel.dataset.panel}`);
    }
    const confirm = el('div', 'cf-confirm'); confirm.id = 'cf-confirm'; confirm.hidden = true; confirm.setAttribute('role', 'group'); confirm.setAttribute('aria-label', '确认操作'); root.append(confirm);
    const footer = el('footer', 'cf-footer'); const state = el('div', 'cf-footer-state');
    const count = el('span', 'cf-hint'); count.id = 'cf-count';
    const message = el('p', 'cf-status', '写下设定，开始创作。'); message.id = 'cf-status'; message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite'); state.append(count, message);
    const exports = el('div', 'cf-export-actions'); exports.append(action('导出 JSON', () => exportCard('json')), action('导出 PNG', () => exportCard('png')), action('导入酒馆', importToTavern, 'cf-button cf-primary'));
    footer.append(state, exports); root.append(footer); document.body.append(dialog);
    dialog.addEventListener('close', () => { persist(); lastFocus?.focus?.(); });
    dialog.addEventListener('cancel', () => { /* Native Escape closes the dialog without dropping an ongoing result. */ });
    for (const [key, value] of Object.entries({ ...DEFAULT_BRIEF, ...settings.brief })) {
        const input = $(`[data-brief="${key}"]`); if (!input) continue;
        if (input.type === 'checkbox') input.checked = value; else input.value = value;
    }
    personaOptions();
    const persona = $('[data-brief="persona"]');
    if ([...persona.options].some(o => o.value === settings.brief?.persona)) persona.value = settings.brief.persona;
    try { loadCard(settings.card || emptyCard()); }
    catch { loadCard(emptyCard()); status('保存的草稿格式无法读取，已打开空白角色卡。', true); }
    if (savedFrontendDraft) {
        try { frontendDraft = normalizeFrontend(savedFrontendDraft); } catch { /* Preserve a valid attached frontend instead. */ }
    }
    renderFrontendDraft(); persist();
    updateDetailCounts(); syncGenerationOptions();
    for (const section of DETAIL_SECTIONS) {
        const filled = section.fields.some(f => $(`[data-brief="${f.key}"]`).value.trim());
        $(`[data-detail-section="${section.id}"]`).open = section.id === 'identity' || filled;
    }
    setTab('brief');
}

function open() {
    lastFocus = document.activeElement;
    if (!root) buildUI();
    if (!busy) refreshConnection();
    if (!dialog.open) dialog.showModal();
    $(`[data-tab="${activeTab}"]`).focus();
}
function initialize() {
    if (document.getElementById('cf-settings-entry')) return;
    const ctx = context();
    const mount = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!ctx?.extensionSettings || !mount) return false;
    settings = ctx.extensionSettings[KEY] ||= {};
    const section = el('div', 'cf-settings-entry'); section.id = 'cf-settings-entry';
    section.append(el('b', '', '✦ 角色卡工坊'), el('small', '', `v${VERSION} · 生成 / 编辑 / 导出`), action('打开角色卡工坊', open, 'menu_button cf-launch'));
    mount.append(section);
    const menu = document.getElementById('extensionsMenu');
    if (menu) menu.append(action('✦ 角色卡工坊', open, 'list-group-item flex-container flexGap5 cf-menu-entry'));
    if (ctx.eventSource?.on) {
        if (ctx.eventTypes?.GENERATION_STARTED) ctx.eventSource.on(ctx.eventTypes.GENERATION_STARTED, (_type, _options, dryRun) => { if (!dryRun) chatBusy = true; });
        for (const type of [ctx.eventTypes?.GENERATION_ENDED, ctx.eventTypes?.GENERATION_STOPPED].filter(Boolean)) ctx.eventSource.on(type, () => { chatBusy = false; });
    }
    installFrontendRuntime(context);
    return true;
}
// Support both deferred script loading and user-scoped extension mounts.
let attempts = 0;
function boot() {
    try {
        if (initialize()) return;
    } catch (error) { console.error('[Card Forge] Initialization failed:', error); }
    if (++attempts < 40) setTimeout(boot, 500);
    else console.error('[Card Forge] 找不到酒馆扩展设置容器或 getContext；请更新酒馆并刷新页面。');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
