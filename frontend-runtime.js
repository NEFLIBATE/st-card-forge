import { FRONTEND_KEY, normalizeFrontend, resolveFrontendNames, renderFrontend } from './frontend.js';

// Single-character chat enhancement. No model calls, global regex or auto-send hooks.
export function installFrontendRuntime(getContext) {
    let timer, mounted, signature = '', hidden = [], saveQueue = Promise.resolve();
    const cleanup = () => {
        mounted?.remove(); mounted = null;
        for (const node of hidden) node.hidden = false;
        hidden = []; signature = '';
    };
    const render = () => {
        const ctx = getContext();
        const character = ctx?.characters?.[ctx.characterId];
        if (!character || ctx.groupId != null) { cleanup(); return; }
        let base;
        try { base = normalizeFrontend(character.data?.extensions?.[FRONTEND_KEY]); }
        catch { cleanup(); return; }
        const messages = ctx.chat || [];
        let index = messages.length - 1;
        while (index >= 0 && (messages[index].is_user || messages[index].is_system)) index--;
        const target = document.querySelector(`#chat .mes[mesid="${index}"] .mes_text`);
        if (!target) { cleanup(); return; }
        const cardId = character.avatar || character.name || String(ctx.characterId);
        const chatId = ctx.chatId, characterId = ctx.characterId, metadata = ctx.chatMetadata;
        const baseSignature = JSON.stringify(base);
        const saved = ctx.chatMetadata?.[FRONTEND_KEY];
        const states = saved?.card === cardId && saved?.signature === baseSignature && saved.quests && typeof saved.quests === 'object' ? saved.quests : {};
        const currentSignature = JSON.stringify([ctx.chatId, index, cardId, baseSignature, states]);
        if (mounted?.isConnected && signature === currentSignature) return;
        cleanup();
        const spec = resolveFrontendNames(base, character.name || '角色', ctx.name1 || '玩家');
        spec.quests.forEach((quest, i) => { if (['未开始', '进行中', '已完成'].includes(states[i])) quest.state = states[i]; });
        mounted = renderFrontend(spec, {
            onChoice: text => {
                const current = getContext();
                if (current.chatId !== chatId || current.characterId !== characterId || current.groupId != null) throw new Error('聊天已切换，请在当前面板选择行动。');
                const input = document.getElementById('send_textarea');
                if (!input || input.disabled) throw new Error('聊天输入框暂不可用。');
                input.value = input.value.trim() ? `${input.value}\n${text}` : text;
                input.dispatchEvent(new Event('input', { bubbles: true })); input.focus();
            },
            onQuestChange: (i, value) => {
                saveQueue = saveQueue.catch(() => {}).then(async () => {
                    const current = getContext();
                    if (current.chatMetadata !== metadata || current.chatId !== chatId || current.characterId !== characterId || current.groupId != null) throw new Error('聊天已切换，请在当前面板操作。');
                    if (!ctx.chatMetadata || typeof ctx.saveMetadata !== 'function') throw new Error('当前酒馆不支持保存面板状态。');
                    const previous = ctx.chatMetadata[FRONTEND_KEY];
                    const previousQuests = previous?.card === cardId && previous?.signature === baseSignature ? previous.quests : {};
                    const next = { card: cardId, signature: baseSignature, quests: { ...previousQuests, [i]: value } };
                    ctx.chatMetadata[FRONTEND_KEY] = next;
                    try { await ctx.saveMetadata(); }
                    catch (error) { if (ctx.chatMetadata[FRONTEND_KEY] === next) ctx.chatMetadata[FRONTEND_KEY] = previous; throw error; }
                    signature = ''; schedule();
                }); return saveQueue;
            },
        });
        mounted.classList.add('cff-live');
        for (const node of target.querySelectorAll('.cff-panel:not(.cff-live)')) { node.hidden = true; hidden.push(node); }
        target.append(mounted); signature = currentSignature;
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(render, 40); };
    const ctx = getContext();
    for (const key of ['CHAT_CHANGED', 'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'GENERATION_ENDED']) {
        const type = ctx?.eventTypes?.[key];
        if (type && ctx.eventSource?.on) ctx.eventSource.on(type, schedule);
    }
    schedule(); return schedule;
}
