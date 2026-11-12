"""Browser integration against a small, explicit SillyTavern API fixture.

Requires Python 3.10+, Pillow, playwright and a Chromium install:
  pip install playwright pillow
  playwright install chromium
  python tests/browser_smoke.py
No model calls, API keys or real SillyTavern account are used.
"""
import base64
import io
import json
import os
import struct
import shutil
import threading
import zlib
from email.parser import BytesParser
from email.policy import default
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
uploads = []


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *args):
        pass

    def do_POST(self):
        if self.path != '/api/characters/import':
            self.send_error(404)
            return
        payload = self.rfile.read(int(self.headers['Content-Length']))
        message = BytesParser(policy=default).parsebytes(
            b'Content-Type: ' + self.headers['Content-Type'].encode() + b'\r\n\r\n' + payload)
        data = {p.get_param('name', header='content-disposition'): p.get_payload(decode=True) for p in message.iter_parts()}
        assert self.headers['X-CSRF-Token'] == 'fixture-token'
        assert data['file_type'] == b'png'
        assert data['user_name'].decode() == '旅人'
        uploads.append(data['avatar'])
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"file_name":"fixture-new-character"}')


def read_card(png):
    assert png[:8] == b'\x89PNG\r\n\x1a\n'
    offset, cards = 8, []
    while offset < len(png):
        length = struct.unpack('>I', png[offset:offset + 4])[0]
        kind = png[offset + 4:offset + 8]
        data = png[offset + 8:offset + 8 + length]
        checksum = struct.unpack('>I', png[offset + 8 + length:offset + 12 + length])[0]
        assert zlib.crc32(kind + data) & 0xffffffff == checksum, kind
        if kind == b'tEXt' and data.startswith(b'chara\0'):
            cards.append(json.loads(base64.b64decode(data[6:]).decode()))
        offset += length + 12
    assert len(cards) == 1
    with Image.open(io.BytesIO(png)) as image:
        image.load()
    return cards[0]


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}/tests/host.html'
    with TemporaryDirectory() as temp, sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CARD_FORGE_CHROMIUM') or shutil.which('chromium'), args=['--no-sandbox', '--no-zygote', '--single-process', '--disable-dev-shm-usage'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1060}, accept_downloads=True)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url)
        page.get_by_role('button', name='打开角色卡工坊').click()
        expect(page.locator('#cf-dialog')).to_be_visible()
        page.locator('[data-brief="idea"]').fill('午夜书店的失忆魔女')
        page.locator('[data-brief="persona"]').select_option('saved:traveler.png')
        page.locator('[data-brief="worldbook"]').check()
        page.locator('#cf-generate').click()
        expect(page.locator('[data-field="name"]')).to_have_value('雾灯 · 书店')
        assert '来自北方' in page.evaluate('requests[0].prompt')
        assert page.evaluate('requests[0].responseLength') == 4096
        expect(page.locator('#cf-completeness')).to_have_text('6/6 核心字段')
        page.locator('[data-tab="preview"]').click()
        expect(page.locator('#cf-preview')).to_contain_text('<img src=x')
        assert page.evaluate('window.injected') is None
        assert page.locator('#cf-preview img').count() == 0
        page.locator('[data-tab="edit"]').click()
        page.locator('[data-field="first_mes"]').locator('..').get_by_role('button', name='重写').click()
        page.locator('#cf-confirm').get_by_role('button', name='确认', exact=True).click()
        expect(page.locator('[data-field="first_mes"]')).to_have_value('“北方的旅人，请把地图放在灯下。”')
        with page.expect_download() as event:
            page.get_by_role('button', name='导出 JSON', exact=True).click()
        data = json.loads(Path(event.value.path()).read_text())
        assert data['spec'] == 'chara_card_v2' and data['data']['extensions']['other']['preserve']
        assert len(data['data']['alternate_greetings']) == 2
        with page.expect_download() as event:
            page.get_by_role('button', name='导出 PNG', exact=True).click()
        cover_png = Path(event.value.path()).read_bytes()
        assert read_card(cover_png) == data
        assert Image.open(io.BytesIO(cover_png)).size == (600, 900)
        portrait = io.BytesIO()
        Image.new('RGB', (80, 120), '#236548').save(portrait, format='PNG')
        page.locator('.cf-portrait input[type=file]').set_input_files({'name': 'portrait.png', 'mimeType': 'image/png', 'buffer': portrait.getvalue()})
        expect(page.locator('#cf-avatar-state')).to_contain_text('80×120')
        with page.expect_download() as event:
            page.get_by_role('button', name='导出 PNG', exact=True).click()
        portrait_png = Path(event.value.path()).read_bytes()
        assert Image.open(io.BytesIO(portrait_png)).size == (80, 120)
        assert read_card(portrait_png) == data
        page.get_by_role('button', name='导入酒馆', exact=True).click()
        page.locator('#cf-confirm').get_by_role('button', name='确认', exact=True).click()
        expect(page.locator('#cf-status')).to_contain_text('已添加新角色')
        assert read_card(uploads[0]) == data
        assert page.evaluate('window.refreshed')
        page.get_by_role('button', name='导入酒馆', exact=True).click()
        expect(page.locator('#cf-status')).to_contain_text('已导入')
        assert len(uploads) == 1
        # A successful server import followed by failed refresh must not create duplicates.
        page.locator('[data-field="name"]').fill('雾灯二号')
        page.evaluate('window.failRefresh = true')
        page.get_by_role('button', name='导入酒馆', exact=True).click()
        page.locator('#cf-confirm').get_by_role('button', name='确认', exact=True).click()
        expect(page.locator('#cf-status')).to_contain_text('列表刷新失败')
        page.get_by_role('button', name='导入酒馆', exact=True).click()
        expect(page.locator('#cf-status')).to_contain_text('已导入')
        assert len(uploads) == 2
        # Invalid lore JSON must block exports instead of exporting stale lore silently.
        page.locator('#cf-book').locator('..').locator('summary').click()
        page.locator('#cf-book').fill('{invalid')
        page.get_by_role('button', name='导出 JSON', exact=True).click()
        expect(page.locator('#cf-status')).to_contain_text('世界书 JSON 无效')
        page.locator('#cf-book').fill(json.dumps(data['data']['character_book'], ensure_ascii=False))
        # Model truncation leaves the original card editable and exposes recovery text.
        page.locator('[data-tab="brief"]').click()
        page.evaluate('window.nextRaw = \'{"name":"broken\'')
        page.locator('#cf-generate').click()
        page.locator('#cf-confirm').get_by_role('button', name='确认', exact=True).click()
        expect(page.locator('#cf-status')).to_contain_text('未找到有效 JSON')
        assert page.locator('[data-field="name"]').input_value() == '雾灯二号'
        assert page.locator('#cf-raw').input_value() == '{"name":"broken'
        # Discarding an in-flight result prevents a late response from replacing a draft.
        page.evaluate('window.deferRequest = true')
        page.locator('#cf-generate').click()
        page.locator('#cf-confirm').get_by_role('button', name='确认', exact=True).click()
        expect(page.locator('#cf-discard')).to_be_visible()
        page.locator('#cf-discard').click()
        page.evaluate('window.releaseRequest()')
        expect(page.locator('#cf-status')).to_contain_text('已放弃本次结果')
        assert page.locator('[data-field="name"]').input_value() == '雾灯二号'
        page.evaluate('window.deferRequest = false')
        # Save before close, restore the server-settings fixture after a full reload.
        page.locator('#cf-close').click()
        expect(page.locator('#cf-dialog')).not_to_be_visible()
        page.reload()
        page.get_by_role('button', name='打开角色卡工坊').click()
        page.locator('[data-tab="edit"]').click()
        expect(page.locator('[data-field="name"]')).to_have_value('雾灯二号')
        # A valid V2 PNG reload restores its content and image without unsafe HTML.
        page.locator('[data-tab="brief"]').click()
        page.locator('#cf-card-file').set_input_files({'name': 'card.png', 'mimeType': 'image/png', 'buffer': portrait_png})
        page.locator('#cf-confirm').get_by_role('button', name='确认', exact=True).click()
        expect(page.locator('[data-field="name"]')).to_have_value('雾灯 · 书店')
        page.locator('[data-tab="preview"]').click()
        expect(page.locator('#cf-preview img')).to_be_visible()
        # Visible layout checks at desktop and narrow Android widths.
        Path(ROOT.parent / 'qa').mkdir(exist_ok=True)
        page.screenshot(path=str(ROOT.parent / 'qa/desktop.png'))
        page.set_viewport_size({'width': 390, 'height': 844})
        page.locator('[data-tab="brief"]').click()
        page.screenshot(path=str(ROOT.parent / 'qa/mobile.png'))
        for tab in ['brief', 'edit', 'preview']:
            page.locator(f'[data-tab="{tab}"]').click()
            assert page.evaluate('document.querySelector(".cf-scroll").scrollWidth <= document.querySelector(".cf-scroll").clientWidth + 1')
            box = page.get_by_role('button', name='导入酒馆', exact=True).bounding_box()
            assert box['y'] + box['height'] <= 844
        page.keyboard.press('Escape')
        expect(page.locator('#cf-dialog')).not_to_be_visible()
        assert not errors, errors
        print('PASS: generation, persona reference, field rewrite, safe preview, JSON/PNG export, PNG CRC and image decoding, avatar, import and duplicate guard, refresh failure, invalid JSON, discarded late response, draft restore, PNG reload, desktop/mobile layout, keyboard close; no browser errors.')
        browser.close()
    server.shutdown()


if __name__ == '__main__':
    main()
