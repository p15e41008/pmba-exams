# /// script
# requires-python = ">=3.13"
# dependencies = ["playwright"]
# ///
"""Run with the local server: uv run --python 3.13 --script tests/browser-workflow.py."""
import json
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs' / 'evidence' / 'pr6'
PASSWORD = re.search(r"const GATE_PASSWORD = '([^']+)'", (ROOT / 'index.html').read_text(encoding='utf-8')).group(1)
IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhFcAAAAASUVORK5CYII='
QUESTIONS = [
    {'course': '財務管理', 'exam': '測試試卷', 'num': 1, 'question': f'是非練習題\n\n![測試圖]({IMAGE})', 'answer': 'O', 'explanation': '是非解析', 'count': 1},
    {'course': '財務管理', 'exam': '測試試卷', 'num': 2, 'question': '選擇練習題', 'answer': '(C)', 'explanation': '選擇解析', 'count': 1},
    {'course': '財務管理', 'exam': '測試試卷', 'num': 3, 'question': '跳過練習題', 'answer': 'X', 'explanation': '跳過解析', 'count': 1},
    {'course': '財務管理', 'exam': '測試試卷', 'num': 4, 'question': '未知答案練習題', 'answer': '無標準答案', 'explanation': '尚無答案', 'count': 1},
]


def enter(page):
    page.goto('http://localhost:8080/', wait_until='domcontentloaded')
    if page.locator('#gateInput').count():
        page.locator('#gateInput').fill(PASSWORD)
        page.locator('#gateOverlay button').click()
    page.wait_for_function("document.querySelector('#selectedCount').innerText !== '0'")


def assert_focus_inside(page, dialog_id):
    focus = page.evaluate('(id) => ({ inside: document.getElementById(id).contains(document.activeElement), tag: document.activeElement.tagName, id: document.activeElement.id, open: document.getElementById(id).open })', dialog_id)
    assert focus['inside'], focus


def exercise(page, width, suffix):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    enter(page)
    expect(page.locator('#advancedFilters')).not_to_have_attribute('open', '')
    expect(page.locator('dialog[open]')).to_have_count(0)
    page.screenshot(path=str(OUTPUT / f'after-{suffix}.png'))
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'horizontal overflow'

    # Settings remain secondary; native modal keeps focus inside and returns it.
    settings = page.locator('#btnPracticeSettings')
    settings.click()
    expect(page.locator('#practiceSetupModal')).to_have_attribute('open', '')
    expect(page.get_by_role('dialog', name='練習模式與抽題設定', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='關閉練習設定', exact=True)).to_be_visible()
    assert_focus_inside(page, 'practiceSetupModal')
    for key in ['Tab'] * 18 + ['Shift+Tab'] * 18:
        page.keyboard.press(key)
        assert_focus_inside(page, 'practiceSetupModal')
    page.locator('#labelOrderSequential').click()
    expect(page.locator('input[name="practiceOrderMode"][value="sequential"]')).to_be_checked()
    page.locator('#practiceSetupModal button[data-limit="all"]').click()
    page.keyboard.press('Escape')
    expect(settings).to_be_focused()
    expect(page.locator('dialog[open]')).to_have_count(0)

    # Deselecting stays deselected when another row's review flag changes.
    advanced = page.locator('#advancedFilters > summary')
    advanced.focus()
    page.keyboard.press('Enter')
    expect(page.locator('#advancedFilters')).to_have_attribute('open', '')
    first_row = page.locator('#questionTableBody tr').first
    first_row.locator('input[type="checkbox"]').uncheck()
    page.locator('#questionTableBody tr').nth(1).locator('button[onclick^="toggleReviewFlag"]').click()
    expect(page.locator('#selectedCount')).to_have_text('3')
    expect(page.locator('#mobileSelectedCount')).to_have_text('3')
    page.locator('#advancedFilters button[onclick="toggleSelectAll(true)"]').click()
    page.locator('#advancedFilters > summary').click()

    # A single start action enters practice; Enter and Space activate focused buttons.
    start = page.locator('#mobileBottomBar button[onclick="startPractice()"]') if width < 768 else page.locator('#btnStartPractice')
    start.click()
    expect(page.locator('#practiceViewSection')).to_be_visible()
    expect(page.locator('dialog[open]')).to_have_count(0)
    page.locator('#btnAnswerX').focus()
    page.keyboard.press('Enter')
    expect(page.locator('#currentQuestionIndex')).to_have_text('1')
    expect(page.locator('#sessionAnsweredCount')).to_have_text('1')
    expect(page.locator('#btnCardReview')).to_contain_text('已標記複習')
    page.locator('#btnAnswerO').focus()
    page.keyboard.press('Space')
    expect(page.locator('#currentQuestionIndex')).to_have_text('1')
    expect(page.locator('#sessionCorrectCount')).to_have_text('1')
    expect(page.locator('#btnCardReview')).to_contain_text('已標記複習')

    # Keyboard image enlargement is a named modal, with focus return on Escape.
    picture = page.locator('#cardQuestionText button').first
    picture.focus()
    page.keyboard.press('Enter')
    expect(page.locator('#lightboxModal')).to_have_attribute('open', '')
    expect(page.get_by_role('dialog', name='圖片放大', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='關閉圖片放大', exact=True)).to_be_visible()
    assert_focus_inside(page, 'lightboxModal')
    page.keyboard.press('Tab')
    assert_focus_inside(page, 'lightboxModal')
    page.keyboard.press('Escape')
    expect(picture).to_be_focused()

    # Cancelled order change preserves the answered round.
    page.once('dialog', lambda dialog: dialog.dismiss())
    page.locator('#badgePracticeMode').click()
    expect(page.locator('#sessionAnsweredCount')).to_have_text('1')
    expect(page.locator('#currentQuestionIndex')).to_have_text('1')

    # Body shortcuts and both choice-key groups still work.
    page.locator('body').click(position={'x': 1, 'y': 1})
    page.keyboard.press('0')
    expect(page.locator('#currentQuestionIndex')).to_have_text('2')
    if width < 768:
        a, b, c = [page.locator(f'#btnAnswer{letter}').bounding_box() for letter in 'ABC']
        assert abs(a['y'] - b['y']) < 1 and c['y'] > a['y'], 'mobile choices must use two columns'
    page.keyboard.press('z')
    expect(page.locator('#sessionCorrectCount')).to_have_text('1')
    page.keyboard.press('C')
    expect(page.locator('#sessionCorrectCount')).to_have_text('2')
    expect(page.locator('#btnCardReview')).to_contain_text('已標記複習')
    page.keyboard.press('0')
    page.keyboard.press('0')
    next_button = page.locator('button[onclick="nextQuestion()"]').last
    next_button.focus()
    page.keyboard.press('Enter')
    expect(page.locator('#sessionSummaryModal')).to_have_attribute('open', '')
    expect(page.locator('#summaryHeading')).not_to_contain_text('滿分')
    expect(page.locator('#summaryCorrectCount')).to_have_text('2')
    expect(page.locator('#summaryWrongCount')).to_have_text('0')
    expect(page.locator('#summaryUnansweredCount')).to_have_text('2')
    expect(page.locator('#summaryAccuracy')).to_have_text('100%')
    expect(page.get_by_role('dialog', name='本輪練習結束！', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='關閉練習結算', exact=True)).to_be_visible()
    assert_focus_inside(page, 'sessionSummaryModal')
    for key in ['Tab'] * 8 + ['Shift+Tab'] * 8:
        page.keyboard.press(key)
        assert_focus_inside(page, 'sessionSummaryModal')
    page.screenshot(path=str(OUTPUT / f'after-summary-{suffix}.png'))
    page.keyboard.press('Escape')
    expect(page.locator('dialog[open]')).to_have_count(0)
    expect(next_button).to_be_focused()
    page.keyboard.press('Enter')
    page.locator('button[onclick="backToListFromSummary()"]').click()

    # Review entry exposes previously answered questions and survives reload.
    page.locator('#chkReviewOnly').locator('..').click()
    expect(page.locator('#chkReviewOnly')).to_be_checked()
    expect(page.locator('#chkUnansweredOnly')).not_to_be_checked()
    expect(page.locator('#selectedCount')).to_have_text('2')
    start.click()
    expect(page.locator('#totalPracticeCount')).to_have_text('2')
    page.locator('#btnAnswerX').focus()
    page.keyboard.press('Enter')
    page.locator('body').click(position={'x': 1, 'y': 1})
    page.keyboard.press('0')
    page.keyboard.press('0')
    expect(page.locator('#summaryWrongCount')).to_have_text('1')
    page.locator('#btnRetryMistakes').click()
    expect(page.locator('#totalPracticeCount')).to_have_text('1')
    page.locator('#btnAnswerO').focus()
    page.keyboard.press('Space')
    expect(page.locator('#sessionCorrectCount')).to_have_text('1')
    expect(page.locator('#btnCardReview')).to_contain_text('已標記複習')
    page.locator('body').click(position={'x': 1, 'y': 1})
    page.keyboard.press('0')
    expect(page.locator('#summaryHeading')).to_contain_text('滿分')
    page.locator('button[onclick="backToListFromSummary()"]').click()
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('#reviewCountBadge')).to_have_text('2')
    page.locator('#chkReviewOnly').locator('..').click()
    expect(page.locator('#chkReviewOnly')).to_be_checked()
    expect(page.locator('#selectedCount')).to_have_text('2')

    # Clear confirmed completed history persists across reload, keeping reviews.
    page.locator('#advancedFilters > summary').click()
    page.once('dialog', lambda dialog: dialog.accept())
    page.locator('button[onclick="clearAllCompletedFlags()"]').click()
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('#selectedCount')).to_have_text('4')
    expect(page.locator('#reviewCountBadge')).to_have_text('2')
    settings.click()
    page.locator('#labelOrderSequential').click()
    page.locator('#customLimitInput').fill('2')
    page.locator('#practiceSetupModal').get_by_role('button', name=re.compile('套用設定')).click()
    start.click()
    expect(page.locator('#totalPracticeCount')).to_have_text('2')
    page.locator('#btnAnswerO').focus()
    page.keyboard.press('Enter')
    expect(page.locator('#sessionCorrectCount')).to_have_text('1')
    assert not errors, errors
    print(f'{suffix}: settings, selection, focused answers, lightbox, order cancel, shortcuts, summary, review persistence and clear persistence passed')


with sync_playwright() as p:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    browser = p.chromium.launch(channel='chrome', headless=True)
    # First load really reads the repository's official Excel sources.
    fresh = browser.new_page(viewport={'width': 1280, 'height': 900})
    enter(fresh)
    expect(fresh.locator('#subjectSwitcher option')).to_have_count(3, timeout=60000)
    assert fresh.locator('#advancedFilters').count() == 1, 'advanced controls must be collapsed by default'
    expect(fresh.locator('#advancedFilters')).not_to_have_attribute('open', '')
    fresh.screenshot(path=str(OUTPUT / 'after-first-load.png'))
    fresh.set_viewport_size({'width': 390, 'height': 844})
    fresh.screenshot(path=str(OUTPUT / 'after-first-load-mobile.png'))
    print('fresh official question-bank load: passed')
    fresh.close()
    for width, height, suffix in [(1280, 900, 'desktop'), (390, 844, 'mobile')]:
        context = browser.new_context(viewport={'width': width, 'height': height})
        context.add_init_script(f'''
          if (!localStorage.getItem('fin_management_questions_v1_5')) {{
            localStorage.setItem('fin_management_questions_v1_5', JSON.stringify({json.dumps(QUESTIONS, ensure_ascii=False)}));
            localStorage.setItem('fin_management_questions_source', 'custom');
          }}
        ''')
        exercise(context.new_page(), width, suffix)
        context.close()
    browser.close()
