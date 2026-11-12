"""Front-end generation, safe HTML export and live chat tests against the host fixture."""
import json
import os
import shutil
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright, expect
from browser_smoke import Handler, read_card, ROOT

SPEC = {
    'version': 1, 'theme': 'jade',
    'title': '雾灯面板 <img src=x onerror="window.frontXss=true">', 'subtitle': '开场参考',
    'modules': ['scene', 'stats', 'relationships', 'quests', 'inventory', 'choices'],
    'scene': {'time': '午夜', 'location': '旧书店', 'weather': '小雨'},
    'stats': [{'label': '专注', 'value': 70, 'max': 100}],
    'relationships': [{'name': '{{user}}', 'detail': '刚刚认识'}],
    'quests': [{'title': '调查地图', 'detail': '查明地图缺失的部分', 'state': '进行中'}, {'title': '寻找钥匙', 'detail': '检查柜台', 'state': '未开始'}],
    'inventory': [{'name': '旧书', 'quantity': 1, 'detail': '夹着一张地图'}],
    'choices': [{'label': '询问地图', 'text': '我询问地图的来历。</textarea><script>window.frontXss=true</script>'}, {'label': '观察柜台', 'text': '我观察柜台上的物件。'}],
}


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CARD_FORGE_CHROMIUM') or shutil.which('chromium'), args=['--no-sandbox', '--no-zygote', '--single-process', '--disable-dev-shm-usage'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1060}, accept_downloads=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/tests/host.html')
        page.evaluate('(spec)=>window.fixtureFrontend=spec', SPEC)
        page.get_by_role('button', name='打开角色卡工坊', exact=True).click()
        page.locator('[data-brief="idea"]').fill('午夜书店的失忆魔女')
        page.locator('#cf-generate').click()
        expect(page.locator('[data-field="name"]')).to_have_value('雾灯 · 书店')
        page.locator('[data-tab="frontend"]').click()
        page.locator('#cf-front-theme').select_option('parchment')
        page.locator('#cf-front-request').fill('展示地图调查与两个任务')
        page.locator('#cf-front-generate').click()
        expect(page.locator('#cf-status')).to_contain_text('前端已生成')
        assert page.locator('#cf-front-preview img').count() == 0
        assert page.evaluate('window.frontXss') is None
        prompt = page.evaluate('requests.at(-1).prompt')
        assert '展示地图调查' in prompt and '雾灯' in prompt and '{{' not in prompt
        page.locator('#cf-front-preview').get_by_role('button', name='询问地图', exact=True).click()
        expect(page.locator('#cf-front-action')).to_have_value(SPEC['choices'][0]['text'])
        page.locator('#cf-front-preview').get_by_role('checkbox', name='调查地图', exact=True).check()
        assert json.loads(page.locator('#cf-front-json').input_value())['quests'][0]['state'] == '已完成'
        assert page.evaluate('requests.length') == 2
        # Apply twice: portable snapshot is replaced rather than duplicated.
        for _ in range(2):
            page.get_by_role('button', name='写入角色卡', exact=True).click()
            page.locator('#cf-confirm').get_by_role('button', name='确认', exact=True).click()
            expect(page.locator('#cf-status')).to_contain_text('前端已写入')
        with page.expect_download() as event:
            page.get_by_role('button', name='导出 JSON', exact=True).click()
        data = json.loads(Path(event.value.path()).read_text())
        spec = data['data']['extensions']['st_card_forge_frontend']
        assert spec['theme'] == 'parchment' and spec['quests'][0]['state'] == '已完成'
        assert data['data']['extensions']['other']['preserve']
        assert data['data']['first_mes'].count('CF_FRONTEND_START') == 1
        with page.expect_download() as event:
            page.get_by_role('button', name='导出 PNG', exact=True).click()
        assert read_card(Path(event.value.path()).read_bytes()) == data
        # Standalone HTML executes only its fixed UI script. User/model text stays inert.
        with page.expect_download() as event:
            page.get_by_role('button', name='导出独立 HTML', exact=True).click()
        html = Path(event.value.path()).read_text()
        offline = page.context.new_page()
        offline.set_content(html)
        assert offline.locator('img').count() == 0 and offline.evaluate('window.frontXss') is None
        offline.get_by_role('button', name='询问地图', exact=True).click()
        expect(offline.locator('#cff-output')).to_have_value(SPEC['choices'][0]['text'])
        assert offline.evaluate('window.frontXss') is None
        offline.get_by_role('checkbox', name='调查地图', exact=True).uncheck()
        expect(offline.locator('[data-cff-module="quests"]')).to_contain_text('进行中')
        offline.close()
        # Malformed model output and invalid edits do not overwrite attached card data.
        page.evaluate('window.nextRaw = \'{"bad":true}\'')
        page.locator('#cf-front-generate').click()
        expect(page.locator('#cf-status')).to_contain_text('前端生成失败')
        assert json.loads(page.locator('#cf-front-json').input_value()) == spec
        page.locator('#cf-front-json').locator('..').locator('summary').click()
        page.locator('#cf-front-json').fill('{invalid')
        page.get_by_role('button', name='写入角色卡', exact=True).click()
        expect(page.locator('#cf-status')).to_contain_text('未找到有效 JSON')
        page.locator('#cf-front-json').fill(json.dumps(spec, ensure_ascii=False))
        page.get_by_role('button', name='刷新前端预览', exact=True).click()
        page.locator('[data-tab="preview"]').click()
        expect(page.locator('#cf-preview .cff-panel')).to_be_visible()
        assert 'CF_FRONTEND_START' not in page.locator('#cf-preview').inner_text()
        # Frontend drafts survive closing and a full reload.
        page.locator('#cf-close').click()
        page.reload()
        page.get_by_role('button', name='打开角色卡工坊', exact=True).click()
        page.locator('[data-tab="frontend"]').click()
        assert json.loads(page.locator('#cf-front-json').input_value()) == spec
        page.set_viewport_size({'width': 390, 'height': 844})
        assert page.evaluate('document.querySelector(".cf-scroll").scrollWidth <= document.querySelector(".cf-scroll").clientWidth + 1')
        page.locator('#cf-close').click()
        # Simulate SillyTavern loading the exported card into a single-character chat.
        page.evaluate('''data=>{
            ctx.characters=[{avatar:'forge-card.png',name:data.data.name,data:data.data}];ctx.characterId=0;
            ctx.chat=[{is_user:false,is_system:false,mes:data.data.first_mes}];
            document.querySelector('#chat .mes_text').innerHTML=data.data.first_mes;
            fire('CHAT_CHANGED');
        }''', data)
        expect(page.locator('#chat .cff-live')).to_be_visible()
        assert page.locator('#chat .cff-panel').count() == 2
        assert page.locator('#chat .cff-panel:not(.cff-live)').is_hidden()
        page.locator('#send_textarea').fill('已有草稿')
        page.locator('#chat .cff-live').get_by_role('button', name='询问地图', exact=True).click()
        expect(page.locator('#send_textarea')).to_have_value('已有草稿\n' + SPEC['choices'][0]['text'])
        assert page.evaluate('requests.length') == 0  # Reload reset fixture request log; choices never generate or send.
        page.locator('#chat .cff-live').get_by_role('checkbox', name='调查地图', exact=True).uncheck()
        expect(page.locator('#chat .cff-live').get_by_role('checkbox', name='调查地图', exact=True)).not_to_be_checked()
        page.wait_for_function("window.savedMetadata?.st_card_forge_frontend?.quests['0']==='进行中'")
        page.locator('#chat .cff-live').get_by_role('checkbox', name='寻找钥匙', exact=True).check()
        page.wait_for_function("window.savedMetadata?.st_card_forge_frontend?.quests['1']==='已完成'")
        assert page.evaluate("savedMetadata.st_card_forge_frontend.quests['0']") == '进行中'
        # Saving failure rolls back visible and stored quest state.
        page.evaluate('window.failMetadata=true')
        page.locator('#chat .cff-live').get_by_role('checkbox', name='调查地图', exact=True).click()
        expect(page.locator('#chat .cff-live')).to_contain_text('任务保存失败')
        expect(page.locator('#chat .cff-live').get_by_role('checkbox', name='调查地图', exact=True)).not_to_be_checked()
        page.evaluate("window.failMetadata=false;document.querySelector('#chat .mes_text').innerHTML='swiped reply';fire('MESSAGE_SWIPED')")
        expect(page.locator('#chat .cff-live')).to_be_visible()
        assert page.locator('#chat .cff-live').count() == 1
        page.evaluate("ctx.chatId='another-chat';ctx.chatMetadata={};fire('CHAT_CHANGED')")
        expect(page.locator('#chat .cff-live').get_by_role('checkbox', name='调查地图', exact=True)).to_be_checked()
        page.evaluate("ctx.groupId='group';fire('CHAT_CHANGED')")
        expect(page.locator('#chat .cff-live')).to_have_count(0)
        page.evaluate("ctx.groupId=undefined;delete ctx.characters[0].data.extensions.st_card_forge_frontend;fire('CHAT_CHANGED')")
        expect(page.locator('#chat .cff-live')).to_have_count(0)
        # Removing generated frontend restores the greeting and preserves unrelated card data.
        page.get_by_role('button', name='打开角色卡工坊', exact=True).click()
        page.get_by_role('button', name='移除卡内前端', exact=True).click()
        page.locator('#cf-confirm').get_by_role('button', name='确认', exact=True).click()
        with page.expect_download() as event:
            page.get_by_role('button', name='导出 JSON', exact=True).click()
        cleaned = json.loads(Path(event.value.path()).read_text())
        assert 'st_card_forge_frontend' not in cleaned['data']['extensions']
        assert 'CF_FRONTEND_START' not in cleaned['data']['first_mes']
        assert cleaned['data']['extensions']['other']['preserve']
        assert not errors, errors
        browser.close()
    server.shutdown()
    print('PASS: AI frontend, safe preview, JSON/PNG portability, standalone HTML, invalid output recovery, draft restore, mobile layout, choice input without auto-send, quest persistence/rollback, swipe and chat isolation, generated frontend removal.')


if __name__ == '__main__':
    main()
