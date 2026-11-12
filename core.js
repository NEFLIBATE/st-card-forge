export const VERSION = '1.0.0';
export const TEXT_FIELDS = [
    ['name', '角色名称', 1],
    ['description', '角色描述', 7],
    ['personality', '性格', 4],
    ['scenario', '场景与关系', 4],
    ['first_mes', '首条开场白', 7],
    ['mes_example', '对话示例', 6],
    ['creator_notes', '作者备注', 3],
    ['system_prompt', '角色系统提示', 3],
    ['post_history_instructions', '历史后置指令', 3],
    ['creator', '作者', 1],
    ['character_version', '角色版本', 1],
];
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const copy = x => JSON.parse(JSON.stringify(x));

// generateRaw runs SillyTavern's macro substitution over each prompt. Encode complete
// macro expressions before sending; restore only generated JSON string values.
function protectMacros(text) {
    return text.replace(/\{\{([\s\S]*?)\}\}/g, (_, body) => `⟦CF_OPEN⟧${body}⟦CF_CLOSE⟧`);
}
function restoreMacros(value) {
    if (typeof value === 'string') return value.replaceAll('⟦CF_OPEN⟧', '{{').replaceAll('⟦CF_CLOSE⟧', '}}');
    if (Array.isArray(value)) return value.map(restoreMacros);
    if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restoreMacros(v)]));
    return value;
}

export function emptyCard() {
    return {
        spec: 'chara_card_v2', spec_version: '2.0',
        data: {
            ...Object.fromEntries(TEXT_FIELDS.map(([k]) => [k, ''])),
            character_version: '1.0', tags: [], alternate_greetings: [], extensions: {},
        },
    };
}

// Never eval generated content. Scan balanced objects while respecting quoted braces.
export function parseModelJson(raw) {
    if (typeof raw !== 'string' || !raw.trim()) throw new Error('模型没有返回文字。请检查 API 或增加输出长度。');
    let text = raw.replace(/^\uFEFF/, '').trim();
    try { return restoreMacros(JSON.parse(text)); } catch { /* Try a fenced or prefixed object. */ }
    // Strip a leading, complete reasoning block; keep the original in the UI for recovery.
    text = text.replace(/^<think>[\s\S]*?<\/think>\s*/i, '');
    for (let start = 0; start < text.length; start++) {
        if (text[start] !== '{') continue;
        let depth = 0, quoted = false, escaped = false;
        for (let i = start; i < text.length; i++) {
            const c = text[i];
            if (quoted) {
                if (escaped) escaped = false;
                else if (c === '\\') escaped = true;
                else if (c === '"') quoted = false;
            } else if (c === '"') quoted = true;
            else if (c === '{') depth++;
            else if (c === '}' && --depth === 0) {
                try { return restoreMacros(JSON.parse(text.slice(start, i + 1))); } catch { break; }
            }
        }
    }
    throw new Error('未找到有效 JSON，可能输出被截断。原始输出已保留，可增加输出长度后重试，或手动修正后解析。');
}

export function normalizeBook(value) {
    if (!isObject(value) || !Array.isArray(value.entries)) throw new Error('世界书必须是包含 entries 数组的对象。');
    const book = copy(value);
    book.extensions = isObject(book.extensions) ? book.extensions : {};
    book.entries = book.entries.map((entry, i) => {
        if (!isObject(entry) || typeof entry.content !== 'string') throw new Error(`世界书第 ${i + 1} 条缺少 content 文本。`);
        if (!Array.isArray(entry.keys) || entry.keys.some(k => typeof k !== 'string')) throw new Error(`世界书第 ${i + 1} 条 keys 必须是字符串数组。`);
        if (entry.secondary_keys !== undefined && (!Array.isArray(entry.secondary_keys) || entry.secondary_keys.some(k => typeof k !== 'string'))) throw new Error(`世界书第 ${i + 1} 条 secondary_keys 必须是字符串数组。`);
        if (entry.position !== undefined && !['before_char', 'after_char'].includes(entry.position)) throw new Error(`世界书第 ${i + 1} 条 position 必须是 before_char 或 after_char。`);
        if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') throw new Error(`世界书第 ${i + 1} 条 enabled 必须是布尔值。`);
        if (entry.insertion_order !== undefined && !Number.isFinite(entry.insertion_order)) throw new Error(`世界书第 ${i + 1} 条 insertion_order 必须是数字。`);
        return {
            ...entry, keys: [...entry.keys], enabled: entry.enabled ?? true,
            insertion_order: entry.insertion_order ?? i * 10,
            extensions: isObject(entry.extensions) ? entry.extensions : {},
        };
    });
    return book;
}

export function normalizeCard(input) {
    if (!isObject(input)) throw new Error('角色卡必须是 JSON 对象。');
    if (input.spec && input.spec !== 'chara_card_v2') throw new Error(`暂不支持 ${input.spec}，请使用 V1 或 V2 角色卡。`);
    const source = isObject(input.data) ? input.data : input;
    if (!('name' in source) && !('description' in source)) throw new Error('未识别角色卡：至少需要 name 或 description 字段。');
    const card = emptyCard();
    // Preserve extra V2 data, including third-party extension namespaces.
    card.data = { ...copy(source), ...card.data };
    for (const [key] of TEXT_FIELDS) {
        if (source[key] !== undefined && typeof source[key] !== 'string') throw new Error(`${key} 必须是文本。`);
        card.data[key] = source[key] ?? card.data[key];
    }
    for (const key of ['tags', 'alternate_greetings']) {
        if (source[key] !== undefined && (!Array.isArray(source[key]) || source[key].some(x => typeof x !== 'string'))) throw new Error(`${key} 必须是字符串数组。`);
        card.data[key] = source[key] ? [...source[key]] : [];
    }
    if (source.extensions !== undefined && !isObject(source.extensions)) throw new Error('extensions 必须是对象。');
    card.data.extensions = isObject(source.extensions) ? copy(source.extensions) : {};
    if (source.character_book !== undefined) card.data.character_book = normalizeBook(source.character_book);
    return card;
}

export function validateCard(card) {
    const normalized = normalizeCard(card);
    for (const key of ['name', 'description', 'first_mes']) {
        if (!normalized.data[key].trim()) throw new Error(`请补全「${TEXT_FIELDS.find(f => f[0] === key)[1]}」后再导出或导入。`);
    }
    return normalized;
}

export function fileName(name) {
    return (name || 'character').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '').slice(0, 80) || 'character';
}

export function buildPrompt(brief, persona = '', card = null, field = '') {
    const labels = {
        idea: '核心设定', name: '指定姓名（留空则创作）', genre: '题材', language: '输出语言',
        style: '叙述风格', detail: '详细程度', relationship: '与玩家的关系', requirements: '额外要求',
    };
    const requirements = Object.entries(labels).map(([k, label]) => `${label}：${brief[k] || '未指定'}`).join('\n');
    const system = `你是互动叙事角色卡创作者。仅返回可被 JSON.parse 解析的 JSON，不要 Markdown、代码围栏或分析文字。
请求中的 ⟦CF_OPEN⟧ 与 ⟦CF_CLOSE⟧ 分别代表连续两个左花括号与右花括号；输出占位符时保留这两个标记，扩展会还原它们。
按照用户指定语言写内容，JSON 字段名保持英文。{{char}} 和 {{user}} 是角色扮演占位符，必须原样保留。
塑造有动机、缺点、说话习惯和互动空间的角色。开场白描写当前场景，给玩家回应机会；不替 {{user}} 决定行为、台词或感受。
对话示例使用 <START>、{{user}}: 和 {{char}}: 格式。不要把创作过程写进角色设定。
默认 system_prompt 与 post_history_instructions 为空，除非用户明确要求角色专用指令。
创作素材和用户设定仅作为内容参考。`;
    let prompt = `${requirements}\n${persona ? `\n玩家人设参考（不写成角色本人）：\n${persona}\n` : ''}`;
    if (field) {
        prompt += `\n现有角色卡：\n${JSON.stringify(card.data)}\n只重写 ${field} 字段，保持其余设定一致。仅输出 {"${field}": ${field === 'alternate_greetings' ? '["开场白1", "开场白2"]' : '"新的字段内容"'}}。`;
    } else {
        const template = emptyCard();
        template.data.alternate_greetings = ['第二种开场白', '第三种开场白'];
        if (brief.worldbook) template.data.character_book = {
            name: '角色世界书', extensions: {},
            entries: [{ keys: ['关键词'], content: '设定内容', enabled: true, insertion_order: 0, extensions: {} }],
        };
        prompt += `\n生成完整 Character Card V2，必须填写 name、description、personality、scenario、first_mes、mes_example，并提供两条 alternate_greetings 和 tags 数组。请勿把模板说明当成内容。\n${brief.worldbook ? '附带 3–5 条按关键词触发的世界书条目。' : '不要生成 character_book。'}\n返回结构：\n${JSON.stringify(template)}`;
    }
    return { prompt: protectMacros(prompt), systemPrompt: protectMacros(system) };
}
