export const VERSION = '1.2.0';
export const GENRES = ['自由创作', '现代日常', '都市异能', '校园青春', '职场生活', '娱乐圈', '悬疑推理', '侦探犯罪', '心理惊悚', '民俗志怪', '奇幻冒险', '西幻史诗', '黑暗奇幻', '童话寓言', '古风武侠', '仙侠修真', '历史架空', '宫廷权谋', '江湖市井', '科幻未来', '赛博朋克', '太空歌剧', '星际探索', '蒸汽朋克', '废土求生', '末日生存', '无限流', '克苏鲁神秘', '恋爱互动', '治愈陪伴', '经营养成', '田园生活', '航海冒险', '超级英雄', '运动竞技', '自定义（在核心设定中说明）'];
// The same schema drives the form, saved brief defaults and prompt routing.
export const DETAIL_SECTIONS = [
    { id: 'identity', title: '身份与生活', hint: '角色是谁，平时以什么身份生活。', fields: [
        { key: 'gender', label: '性别（可选）', options: [['', '不指定'], '女性', '男性', '非二元', '无性别', '其他'], target: 'description' },
        { key: 'age', label: '年龄 / 年龄段', placeholder: '例如：32 岁；实际年龄与外表不同', target: 'description' },
        { key: 'species', label: '种族 / 物种', placeholder: '人类、精灵、仿生人，或自定义', target: 'description' },
        { key: 'occupation', label: '职业 / 身份', placeholder: '公开职业，也可以补充隐藏身份', target: 'description' },
        { key: 'origin', label: '出身 / 常住地', placeholder: '故乡、阶层、现在住在哪里', target: 'description' },
        { key: 'socialStatus', label: '生活状况 / 社会地位', placeholder: '经济、居所、圈子及日常压力', target: 'description' },
    ] },
    { id: 'appearance', title: '外貌与感官', hint: '让角色拥有能被辨认的外形和动作。', fields: [
        { key: 'appearance', label: '外貌特征', placeholder: '身形、发色、眼睛、肤色、疤痕或其他识别点', rows: 3, target: 'description' },
        { key: 'clothing', label: '服饰 / 随身物品', placeholder: '衣着风格、常用工具、有故事的物件', rows: 2, target: 'description' },
        { key: 'mannerisms', label: '动作习惯 / 感官印象', placeholder: '紧张时的动作、步态、气味、对视习惯', rows: 2, target: 'description' },
        { key: 'voice', label: '声线 / 语速', placeholder: '例如：低声慢语，生气时反而更平静', target: 'mes_example' },
    ] },
    { id: 'history', title: '经历与世界', hint: '将过去、能力和眼下的目标连起来。', fields: [
        { key: 'upbringing', label: '成长经历', placeholder: '家庭、教育、重要人物，以及这些经历如何影响现在', rows: 3, target: 'description' },
        { key: 'turningPoint', label: '人生转折 / 关键事件', placeholder: '一次失去、选择、背叛或成功，带来了什么改变', rows: 2, target: 'description' },
        { key: 'goals', label: '近期目标 / 长期愿望', placeholder: '眼下想解决什么，最终想成为什么样的人', rows: 2, target: 'personality' },
        { key: 'secrets', label: '秘密 / 伏笔', placeholder: '隐藏事实、隐瞒原因，以及逐步透露的条件', rows: 2, target: 'description' },
        { key: 'worldRules', label: '时代 / 世界规则', placeholder: '地点、科技或魔法规则、社会秩序及故事限制', rows: 2, target: 'scenario' },
    ] },
    { id: 'inner', title: '性格与内心', hint: '用行为、选择和矛盾表现性格。', fields: [
        { key: 'traits', label: '优点 / 核心性格', placeholder: '例如：细心而克制，做事先观察再决定', rows: 2, target: 'personality' },
        { key: 'flaws', label: '缺点 / 盲点', placeholder: '会真正影响行动的不足，而不只是可爱的小毛病', rows: 2, target: 'personality' },
        { key: 'contradiction', label: '内在矛盾', placeholder: '想被理解，却习惯隐瞒；珍视自由，却害怕失去归属', rows: 2, target: 'personality' },
        { key: 'values', label: '价值观 / 原则', placeholder: '哪些事愿意坚持，哪些事绝不会做', rows: 2, target: 'personality' },
        { key: 'fears', label: '恐惧 / 脆弱点', placeholder: '恐惧什么，触发后如何表现，什么能缓解', rows: 2, target: 'personality' },
        { key: 'likes', label: '喜好 / 兴趣', placeholder: '具体到食物、活动、收藏或独处方式', target: 'personality' },
        { key: 'dislikes', label: '厌恶 / 雷点', placeholder: '讨厌的事，以及被触及时的反应', target: 'personality' },
    ] },
    { id: 'relations', title: '关系与成长', hint: '给关系留下变化空间，不预设玩家的反应。', fields: [
        { key: 'firstImpression', label: '初始态度 / 第一印象', placeholder: '初见玩家时怎么看待对方，是否存在误解', rows: 2, target: 'scenario' },
        { key: 'trustTriggers', label: '建立信任的方式', placeholder: '哪些具体行动会让角色放下戒备', rows: 2, target: 'scenario' },
        { key: 'conflictTriggers', label: '冲突 / 修复关系', placeholder: '可能因何争执，如何表达歉意或重新协商', rows: 2, target: 'scenario' },
        { key: 'relationshipArc', label: '关系发展节奏', placeholder: '慢热、试探、合作、互相影响；只描述角色自身的变化', rows: 2, target: 'scenario' },
        { key: 'otherRelationships', label: '其他人物 / 阵营关系', placeholder: '家人、同伴、对手、组织，以及各自的诉求', rows: 2, target: 'description' },
    ] },
    { id: 'interaction', title: '对白与互动', hint: '让角色能说话、能行动，也能推动新情节。', fields: [
        { key: 'speechStyle', label: '说话方式', placeholder: '措辞、称呼、幽默感、情绪变化时的表达差异', rows: 2, target: 'mes_example' },
        { key: 'signatureLines', label: '口头禅 / 代表台词', placeholder: '可以给示例，但避免每轮重复', rows: 2, target: 'mes_example' },
        { key: 'dailyHabits', label: '日常习惯 / 小细节', placeholder: '作息、仪式感、处理小麻烦的方式', rows: 2, target: 'description' },
        { key: 'abilities', label: '能力 / 擅长领域', placeholder: '能做什么，熟练程度如何', rows: 2, target: 'description' },
        { key: 'abilityLimits', label: '能力限制 / 代价', placeholder: '不能做什么，使用能力的条件、成本或后果', rows: 2, target: 'description' },
        { key: 'openingScene', label: '开场时刻 / 当前困境', placeholder: '何时何地遇见玩家，眼前发生了什么', rows: 3, target: 'first_mes' },
        { key: 'plotHooks', label: '可持续互动 / 剧情钩子', placeholder: '一起解决的难题、未完成委托、会再次出现的人与物', rows: 3, target: 'scenario' },
        { key: 'boundaries', label: '内容边界 / 避免设定', placeholder: '不希望出现的情节、描写或角色行为', rows: 2, target: 'scenario' },
    ] },
];
export const DEFAULT_BRIEF = {
    idea: '', name: '', genre: '自由创作', language: '简体中文', style: '细腻沉浸', detail: '标准',
    relationship: '', requirements: '', persona: 'none', worldbook: false, responseLength: 4096,
    greetingCount: '2', dialogueCount: '3', worldbookCount: '5',
    ...Object.fromEntries(DETAIL_SECTIONS.flatMap(section => section.fields.map(field => [field.key, '']))),
};
export function generationOptions(brief) {
    const count = (value, fallback, min, max) => {
        const n = Number(value ?? fallback);
        return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
    };
    return {
        greetings: count(brief.greetingCount, 2, 0, 5),
        dialogues: count(brief.dialogueCount, 3, 1, 6),
        worldEntries: count(brief.worldbookCount, 5, 3, 10),
    };
}
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
export function protectMacros(text) {
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
    const options = generationOptions(brief);
    const requirements = Object.entries(labels).map(([k, label]) => `${label}：${brief[k] || '未指定'}`).join('\n');
    const details = DETAIL_SECTIONS.map(section => {
        const lines = section.fields.filter(f => String(brief[f.key] || '').trim()).map(f => `${f.label}：${String(brief[f.key]).trim()}（融入 ${f.target}）`);
        return lines.length ? `【${section.title}】\n${lines.join('\n')}` : '';
    }).filter(Boolean).join('\n\n');
    const depth = {
        '精简': '保留最有辨识度的事实；背景、性格、开场各用短段落，去掉重复形容。',
        '标准': '交代清楚动机、缺点、说话习惯和当前处境；至少留出两个可以继续发展的互动线索。',
        '详细': '按身份外貌、经历、能力限制、日常习惯组织描述；用具体行为表现两处性格矛盾，提供三条可持续互动线索。',
        '深度': '在详细模式基础上，写清关键经历如何塑造行为、目标之间的冲突、秘密的逐步揭露条件和关系变化；提供四条有后续的互动线索，避免堆砌同义形容词。',
    }[brief.detail] || '以清晰、具体、可用于角色扮演的设定为主。';
    const system = `你是互动叙事角色卡创作者。仅返回可被 JSON.parse 解析的 JSON，不要 Markdown、代码围栏或分析文字。
请求中的 ⟦CF_OPEN⟧ 与 ⟦CF_CLOSE⟧ 分别代表连续两个左花括号与右花括号；输出占位符时保留这两个标记，扩展会还原它们。
按照用户指定语言写内容，JSON 字段名保持英文。{{char}} 和 {{user}} 是角色扮演占位符，必须原样保留。
塑造有动机、缺点、说话习惯和互动空间的角色。开场白描写当前场景，给玩家回应机会；不替 {{user}} 决定行为、台词或感受。
对话示例使用 <START>、{{user}}: 和 {{char}}: 格式。不要把创作过程写进角色设定。
明确填写的条件优先于自动补全；未填写的可选项目可按题材补充，但未指定性别时不必主动设定性别，不从职业、外貌或兴趣推断性别。
同一事实在不同字段中必须一致。能力要有使用条件、限制或代价；性格需有可观察的行为，不要让角色全知全能。
秘密写入背景时注明角色知道的范围和透露条件，不要在第一句话中揭完；内容边界作为创作约束遵守，不要写成必须发生的情节。
description 承载身份、外貌、经历、技能和日常；personality 承载性格、价值观、动机与情绪反应；scenario 承载世界规则、关系和互动线索；first_mes 只呈现开场时刻；mes_example 用不同情境展示语言风格。
默认 system_prompt 与 post_history_instructions 为空，除非用户明确要求角色专用指令。
创作素材和用户设定仅作为内容参考。`;
    let prompt = `${requirements}\n\n详细程度要求：${depth}\n${details ? `\n已指定的人物细节（逐项落实，不照抄填写提示）：\n${details}\n` : ''}${persona ? `\n玩家人设参考（不写成角色本人）：\n${persona}\n` : ''}`;
    if (field) {
        prompt += `\n现有角色卡：\n${JSON.stringify(card.data)}\n只重写 ${field} 字段，保持其余设定一致，只落实与该字段相关的细节。`;
        if (field === 'alternate_greetings') prompt += `生成恰好 ${options.greetings} 条备选开场白，每条采用不同的事件或相遇方式；选择 0 条时返回空数组。`;
        if (field === 'mes_example') prompt += `生成 ${options.dialogues} 组不同情绪或情境下的对话示例，用 <START> 分隔。`;
        prompt += `仅输出 ${JSON.stringify({ [field]: field === 'alternate_greetings' ? Array.from({ length: options.greetings }, (_, i) => `开场白${i + 1}`) : '新的字段内容' })}。`;
    } else {
        const template = emptyCard();
        template.data.alternate_greetings = Array.from({ length: options.greetings }, (_, i) => `备选开场白${i + 1}`);
        if (brief.worldbook) template.data.character_book = {
            name: '角色世界书', extensions: {},
            entries: [{ keys: ['关键词'], content: '设定内容', enabled: true, insertion_order: 0, extensions: {} }],
        };
        prompt += `\n生成完整 Character Card V2，必须填写 name、description、personality、scenario、first_mes、mes_example，并提供 tags 数组。生成恰好 ${options.greetings} 条 alternate_greetings；选择 0 条时使用空数组。备选开场应采用不同事件或相遇方式，不只是同一句话的改写。mes_example 包含 ${options.dialogues} 组不同情境的对白，用 <START> 分隔。请勿把模板说明当成内容。\n${brief.worldbook ? `附带恰好 ${options.worldEntries} 条按关键词触发的世界书条目，围绕地点、组织、关键人物或规则；每条提供具体信息，避免重复主描述。` : '不要生成 character_book。'}\n返回结构（世界书 entries 展示一条结构示例，实际数量按上述要求）：\n${JSON.stringify(template)}`;
    }
    return { prompt: protectMacros(prompt), systemPrompt: protectMacros(system) };
}
