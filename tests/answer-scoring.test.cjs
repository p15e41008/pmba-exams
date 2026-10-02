const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const appScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('const EXCEL_SOURCES'));

function createApp(renderAnswers = false, saved = new Map()) {
  const elements = new Map();
  let keydown;
  const app = vm.createContext({
    window: { scrollTo() {}, addEventListener(type, handler) { if (type === 'keydown') keydown = handler; } },
    marked: { setOptions() {} },
    document: {
      getElementsByName() { return []; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementById(id) {
        if (!elements.has(id)) {
          const classes = new Set();
          const child = { className: '', classList: { add() {}, remove() {} } };
          elements.set(id, {
            innerText: '', value: '', checked: false, style: {},
            open: false, showModal() { this.open = true; }, close() { this.open = false; }, focus() {},
            classList: {
              contains: name => classes.has(name),
              add: (...names) => names.forEach(name => classes.add(name)),
              remove: (...names) => names.forEach(name => classes.delete(name)),
              toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }
            },
            setAttribute(name, value) { this[name] = value; },
            querySelector: () => child
          });
        }
        return elements.get(id);
      }
    },
    confirm: () => true,
    alert() {},
    localStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) }
  });
  vm.runInContext(appScript, app);
  // Enable feedback state checks when needed; visual layout still needs the
  // README's browser regression checklist.
  if (!renderAnswers) vm.runInContext('renderAnswerState = () => {};', app);
  const press = (key, options = {}) => {
    let prevented = 0;
    keydown({ key, code: '', preventDefault() { prevented++; }, ...options });
    return prevented;
  };
  return { app, elements, saved, press };
}

test('parses existing O/X and multiple-choice answers with common formatting', () => {
  const { app } = createApp();
  for (const [answer, expected] of [
    ['O', 'O'], ['X, 應選擇 Project B', 'X'], ['x，錯誤原因', 'X'],
    ['(A)', 'A'], ['(B)', 'B'], ['(C)', 'C'], ['(D)', 'D'],
    [' （ｃ） ', 'C'], ['a', 'A'], ['B. 補充說明', 'B'], ['( D )，補充說明', 'D']
  ]) {
    assert.equal(app.getCorrectLetter(answer), expected, answer);
  }
  for (const answer of [null, '', '無標準答案', 'Answer unknown', 'Discuss', 'Other', '(E)']) {
    assert.equal(app.getCorrectLetter(answer), null, String(answer));
  }
});

test('start uses page settings directly and repeat restores its original selected pool', () => {
  const { app, elements } = createApp();
  vm.runInContext(`allQuestions = [
    { question: '一', answer: 'O', count: 1 }, { question: '二', answer: 'X', count: 1 }
  ]; currentOrderMode = 'sequential'; showPracticeView = () => {};`, app);
  app.applyFilters();
  app.startPractice();
  assert.equal(elements.get('practiceSetupModal').open, false);
  assert.equal(vm.runInContext('practiceList.length', app), 2);
  app.document.getElementById('chkUnansweredOnly').checked = true;
  app.selectAnswer('X');
  assert.equal(vm.runInContext('selectedIndices.size', app), 1);
  app.restartSamePractice();
  assert.equal(vm.runInContext('practiceList.length', app), 2);
  assert.equal(vm.runInContext('currentOrderMode', app), 'sequential');
});

test('focused native controls retain Enter and Space while body keeps next shortcuts', () => {
  const { app, press } = createApp();
  vm.runInContext(`practiceList = [{ question: '一', answer: 'O' }, { question: '二', answer: 'X' }];
    loadQuestionCard = () => {};`, app);
  for (const tagName of ['BUTTON', 'A', 'SUMMARY']) {
    app.document.activeElement = { tagName };
    assert.equal(press('Enter'), 0);
    assert.equal(press(' '), 0);
    assert.equal(vm.runInContext('currentPracticePointer', app), 0);
  }
  app.document.activeElement = { tagName: 'BODY' };
  assert.equal(press('Enter'), 1);
  assert.equal(vm.runInContext('currentPracticePointer', app), 1);
});

test('open dialogs wrap Tab boundaries before hidden-practice shortcuts', () => {
  const { app, press } = createApp();
  const control = () => ({ tabIndex: 0, getClientRects: () => [1], focus() { app.document.activeElement = this; } });
  const first = control();
  const last = control();
  const hidden = { ...control(), getClientRects: () => [] };
  const disabled = { ...control(), disabled: true };
  app.document.querySelector = () => ({ querySelectorAll: () => [first, hidden, disabled, last] });
  app.document.getElementById('practiceViewSection').classList.add('hidden');
  app.document.activeElement = last;
  assert.equal(press('Tab'), 1);
  assert.equal(app.document.activeElement, first);
  assert.equal(press('Tab', { shiftKey: true }), 1);
  assert.equal(app.document.activeElement, last);
  app.document.activeElement = first;
  assert.equal(press('Tab'), 0);
  assert.equal(press('Escape'), 0);
});

test('summary reconciles correct, wrong and unanswered using the same answered-only accuracy', () => {
  for (const [choices, expected, perfect] of [
    [[], [0, 0, 2, '0%'], false],
    [['O'], [1, 0, 1, '100%'], false],
    [['O', 'B'], [2, 0, 0, '100%'], true],
    [['X', 'B'], [1, 1, 0, '50%'], false]
  ]) {
    const { app, elements } = createApp(true);
    vm.runInContext(`practiceList = [
      { question: '是非', answer: 'O' }, { question: '選擇', answer: '(B)' }
    ];`, app);
    choices.forEach((choice, index) => {
      app.pointer = index;
      vm.runInContext('currentPracticePointer = pointer;', app);
      app.selectAnswer(choice);
    });
    app.updateSessionStats();
    app.openSessionSummaryModal();
    assert.equal(elements.get('summaryCorrectCount').innerText, expected[0]);
    assert.equal(elements.get('summaryWrongCount').innerText, expected[1]);
    assert.equal(elements.get('summaryUnansweredCount').innerText, expected[2]);
    assert.equal(elements.get('summaryAccuracy').innerText, expected[3]);
    assert.equal(elements.get('summaryAccuracy').innerText, `${elements.get('sessionAccuracy').innerText}%`);
    assert.equal(elements.get('summaryHeading').innerText.includes('滿分'), perfect);
  }
  const { app, elements } = createApp(true);
  vm.runInContext(`practiceList = [
    { question: '對', answer: 'O' }, { question: '錯', answer: '(B)' },
    { question: '跳過', answer: 'X' }, { question: '未知', answer: '無標準答案' }
  ]; showPracticeView = () => {};`, app);
  app.selectAnswer('O');
  vm.runInContext('currentPracticePointer = 1;', app);
  app.selectAnswer('A');
  vm.runInContext('currentPracticePointer = 3;', app);
  app.selectAnswer('O');
  app.openSessionSummaryModal();
  assert.equal(elements.get('summaryTotalCount').innerText, 4);
  assert.equal(elements.get('summaryWrongCount').innerText, 1);
  assert.equal(elements.get('summaryUnansweredCount').innerText, 2);
  assert.equal(elements.get('summaryAccuracy').innerText, '50%');
  vm.runInContext('currentPracticePointer = 1;', app);
  app.selectAnswer('B');
  app.openSessionSummaryModal();
  assert.equal(elements.get('summaryWrongCount').innerText, 0);
  assert.equal(elements.get('summaryUnansweredCount').innerText, 2);
  assert.equal(elements.get('summaryAccuracy').innerText, '100%');
  assert.equal(elements.get('summaryHeading').innerText.includes('滿分'), false);
  app.selectAnswer('A');
  app.retryMistakesOnly();
  app.selectAnswer('B');
  app.openSessionSummaryModal();
  assert.equal(elements.get('summaryHeading').innerText.includes('滿分'), true);
});

test('wrong answers persist reviews through correction, retry, manual cancellation and reload', async () => {
  const { app, elements, saved } = createApp(true);
  vm.runInContext(`allQuestions = [
    { question: '是非', answer: 'X', count: 1 }, { question: '選擇', answer: '(B)', count: 1 }
  ]; practiceList = allQuestions; showPracticeView = () => {};`, app);
  app.applyFilters();
  app.toggleSelect(1);
  app.selectAnswer('O');
  app.selectAnswer('O');
  assert.deepEqual(JSON.parse(saved.get('fin_management_reviews_v1')), ['是非']);
  assert.equal(elements.get('reviewCountBadge').innerText, 1);
  assert.equal(elements.get('selectedCount').innerText, 1);
  assert.match(elements.get('btnCardReview').innerHTML, /已標記複習/);
  app.selectAnswer('X');
  assert.equal(vm.runInContext('sessionMistakes.length', app), 0);
  assert.deepEqual(JSON.parse(saved.get('fin_management_reviews_v1')), ['是非']);
  vm.runInContext('currentPracticePointer = 1;', app);
  app.selectAnswer('A');
  assert.deepEqual(JSON.parse(saved.get('fin_management_reviews_v1')), ['是非', '選擇']);
  app.retryMistakesOnly();
  app.selectAnswer('B');
  assert.equal(vm.runInContext('sessionMistakes.length', app), 0);
  assert.equal(elements.get('sessionCorrectCount').innerText, 1);
  assert.deepEqual(JSON.parse(saved.get('fin_management_reviews_v1')), ['是非', '選擇']);
  app.toggleCurrentCardReview();
  assert.deepEqual(JSON.parse(saved.get('fin_management_reviews_v1')), ['是非']);
  app.toggleCurrentCardReview();
  app.selectAnswer('B');
  assert.deepEqual(JSON.parse(saved.get('fin_management_reviews_v1')), ['是非', '選擇']);
  saved.set('fin_management_questions_v1_5', JSON.stringify(vm.runInContext('allQuestions', app)));
  const reload = createApp(false, saved);
  await reload.app.window.onload();
  assert.equal(vm.runInContext('reviewSet.size', reload.app), 2);
  reload.app.document.getElementById('chkUnansweredOnly').checked = true;
  reload.app.document.getElementById('chkReviewOnly').checked = true;
  reload.app.applyFilters();
  assert.equal(reload.app.document.getElementById('chkUnansweredOnly').checked, false);
  assert.equal(vm.runInContext('filteredQuestions.length', reload.app), 2);
  reload.app.document.getElementById('filterKeyword').value = '選擇';
  reload.app.applyFilters();
  assert.equal(vm.runInContext('filteredQuestions.length', reload.app), 1);
});

test('review changes preserve partial selection and remove only vanished candidates', () => {
  const { app, elements } = createApp();
  vm.runInContext(`allQuestions = [
    { question: '題一', answer: 'O', count: 1 }, { question: '題二', answer: 'X', count: 1 }
  ];`, app);
  app.applyFilters();
  app.toggleSelect(1);
  app.toggleReviewFlag('題一');
  assert.equal(elements.get('selectedCount').innerText, 1);
  assert.equal(elements.get('mobileSelectedCount').innerText, 1);
  app.toggleReviewFlag('題二');
  app.toggleReviewFlag('題二');
  assert.deepEqual(Array.from(vm.runInContext('[...selectedIndices]', app)), [0]);
  app.toggleReviewFlag('題二');
  app.document.getElementById('chkReviewOnly').checked = true;
  app.applyFilters();
  app.toggleSelect(1);
  app.toggleReviewFlag('題一');
  assert.deepEqual(Array.from(vm.runInContext('[...selectedIndices]', app)), []);
  assert.equal(elements.get('selectedCount').innerText, 0);
  app.toggleSelectAll(true);
  assert.deepEqual(Array.from(vm.runInContext('[...selectedIndices]', app)), [1]);
  app.toggleSelectAll(false);
  assert.equal(elements.get('selectedCount').innerText, 0);
  app.document.getElementById('chkReviewOnly').checked = false;
  app.applyFilters();
  app.document.getElementById('rangeFromInput').value = '2';
  app.document.getElementById('rangeToInput').value = '2';
  app.selectRange();
  assert.deepEqual(Array.from(vm.runInContext('[...selectedIndices]', app)), [1]);
});

test('clearing completed records persists across reload, preserves reviews and allows new answers', async () => {
  const { app, saved } = createApp();
  vm.runInContext(`allQuestions = [{ question: '題一', answer: 'O', count: 1 }];
    completedSet.add(normalizeKey('題一')); reviewSet.add(normalizeKey('題一'));
    saveCompleted(); saveReviews();`, app);
  app.confirm = () => false;
  app.clearAllCompletedFlags();
  assert.deepEqual(JSON.parse(saved.get('fin_management_completed_v1')), ['題一']);
  app.confirm = () => true;
  app.clearAllCompletedFlags();
  assert.equal(vm.runInContext('completedSet.size', app), 0);
  assert.deepEqual(JSON.parse(saved.get('fin_management_completed_v1')), []);
  saved.set('fin_management_questions_v1_5', JSON.stringify([{ question: '題一', answer: 'O', count: 1 }]));
  const reload = createApp(false, saved);
  vm.runInContext('loadDefaultExcel = async () => {};', reload.app);
  await reload.app.window.onload();
  assert.equal(vm.runInContext('completedSet.size', reload.app), 0);
  assert.equal(vm.runInContext('reviewSet.has(normalizeKey("題一"))', reload.app), true);
  vm.runInContext('practiceList = allQuestions;', app);
  app.selectAnswer('O');
  assert.deepEqual(JSON.parse(saved.get('fin_management_completed_v1')), ['題一']);
});

test('switching practice order requires confirmation before resetting any session state', () => {
  const { app, elements, saved } = createApp(true);
  vm.runInContext(`practiceList = [
    { question: '題二', answer: 'O', num: 2 }, { question: '題一', answer: 'X', num: 1 }
  ]; currentPracticePointer = 1; loadQuestionCard = () => updateSessionStats();`, app);
  app.selectAnswer('O');
  const before = vm.runInContext('JSON.stringify([currentOrderMode, practiceList, currentPracticePointer, sessionAnswers, sessionMistakes])', app);
  const persisted = [...saved];
  let prompt;
  app.confirm = text => { prompt = text; return false; };
  app.toggleOrderModeInPractice();
  assert.match(prompt, /切換順序.*重新開始/);
  assert.equal(vm.runInContext('JSON.stringify([currentOrderMode, practiceList, currentPracticePointer, sessionAnswers, sessionMistakes])', app), before);
  assert.equal(elements.get('sessionAnsweredCount').innerText, 1);
  assert.deepEqual([...saved], persisted);
  app.confirm = () => true;
  app.toggleOrderModeInPractice();
  assert.equal(vm.runInContext('currentOrderMode', app), 'sequential');
  assert.deepEqual(Array.from(vm.runInContext('practiceList.map(q => q.num)', app)), [1, 2]);
  assert.equal(vm.runInContext('currentPracticePointer', app), 0);
  assert.equal(elements.get('sessionAnsweredCount').innerText, 0);
  assert.equal(vm.runInContext('sessionMistakes.length', app), 0);
  assert.deepEqual([...saved], persisted);
  app.confirm = () => assert.fail('unanswered sessions must switch without a prompt');
  app.toggleOrderModeInPractice();
  assert.equal(vm.runInContext('currentOrderMode', app), 'random');
});

test('offers only O/X for true/false and exactly A-D for multiple choice', () => {
  const { app } = createApp();
  assert.deepEqual(Array.from(app.getAnswerChoices('O')), ['O', 'X']);
  assert.deepEqual(Array.from(app.getAnswerChoices('X, 原因')), ['O', 'X']);
  for (const answer of ['(A)', '(B)', '(C)', '(D)']) {
    assert.deepEqual(Array.from(app.getAnswerChoices(answer)), ['A', 'B', 'C', 'D']);
  }
  assert.deepEqual(Array.from(app.getAnswerChoices('無標準答案')), []);
});

test('mixed practice scores correct answers once and counts wrong answers as zero', () => {
  const { app, elements, saved } = createApp();
  vm.runInContext(`practiceList = [
    { question: '是非題', answer: 'X, 原因' },
    { question: '選擇題一', answer: '(A)' },
    { question: '選擇題二', answer: '(D)' }
  ];`, app);
  app.selectAnswer('X');
  vm.runInContext('currentPracticePointer = 1;', app);
  app.selectAnswer('A');
  app.selectAnswer('A');
  vm.runInContext('currentPracticePointer = 2;', app);
  app.selectAnswer('B');
  assert.equal(elements.get('sessionAnsweredCount').innerText, 3);
  assert.equal(elements.get('sessionCorrectCount').innerText, 2);
  assert.equal(elements.get('sessionAccuracy').innerText, 67);
  assert.equal(elements.get('sessionProgressBar').style.width, '100%');
  assert.equal(JSON.parse(saved.get('fin_management_completed_v1')).length, 3);
  // Preserve the existing ability to revise an answer without double counting.
  app.selectAnswer('D');
  assert.equal(elements.get('sessionAnsweredCount').innerText, 3);
  assert.equal(elements.get('sessionCorrectCount').innerText, 3);
  assert.equal(elements.get('sessionAccuracy').innerText, 100);
});

test('wrong-type and unknown answers cannot mark a question as completed', () => {
  const { app, saved } = createApp();
  vm.runInContext(`practiceList = [
    { question: '選擇題', answer: '(B)' },
    { question: '是非題', answer: 'O' },
    { question: '無答案', answer: '' }
  ];`, app);
  app.selectAnswer('O');
  app.selectAnswer('X');
  app.selectAnswer('E');
  vm.runInContext('currentPracticePointer = 1;', app);
  app.selectAnswer('A');
  vm.runInContext('currentPracticePointer = 2;', app);
  app.selectAnswer('O');
  app.selectAnswer('A');
  assert.equal(vm.runInContext('Object.keys(sessionAnswers).length', app), 0);
  assert.equal(vm.runInContext('completedSet.size', app), 0);
  assert.equal(saved.size, 0);
});

test('both shortcut groups share scoring, feedback and mistake retry, once per keypress', () => {
  for (const [key, choice] of [
    ['a', 'A'], ['z', 'A'], ['b', 'B'], ['x', 'B'], ['c', 'C'], ['d', 'D'], ['v', 'D']
  ]) {
    for (const letter of [key, key.toUpperCase()]) {
      const { app, elements, press } = createApp(true);
      vm.runInContext(`practiceList = [{ question: '選擇題', answer: '(C)' }];
        let answerCalls = 0;
        const originalSelectAnswer = selectAnswer;
        selectAnswer = choice => { answerCalls++; originalSelectAnswer(choice); };
        showPracticeView = () => {};`, app);
      assert.equal(press(letter), 1);
      assert.equal(vm.runInContext('answerCalls', app), 1);
      assert.equal(vm.runInContext('sessionAnswers[0]', app), choice);
      assert.equal(elements.get('sessionAnsweredCount').innerText, 1);
      assert.equal(elements.get('sessionCorrectCount').innerText, choice === 'C' ? 1 : 0);
      assert.equal(elements.get('feedbackTitle').innerText, choice === 'C' ? '答對了！' : '答錯了，正確答案是 C');
      assert.equal(press(letter, { repeat: true }), 1);
      assert.equal(vm.runInContext('answerCalls', app), 1);
      if (choice !== 'C') {
        assert.equal(vm.runInContext('sessionMistakes[0].userChoice', app), choice);
        app.retryMistakesOnly();
        assert.equal(vm.runInContext('practiceList[0].answer', app), '(C)');
        press('C');
        assert.equal(elements.get('sessionCorrectCount').innerText, 1);
        assert.equal(vm.runInContext('sessionMistakes.length', app), 0);
      }
    }
  }
});

test('shortcuts ignore editable fields, modals, modifiers and the hidden practice view', () => {
  const { app, saved, press } = createApp();
  vm.runInContext("practiceList = [{ question: '選擇題', answer: '(A)' }];", app);
  for (const activeElement of [
    { tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' },
    { tagName: 'DIV', isContentEditable: true }
  ]) {
    app.document.activeElement = activeElement;
    for (const key of ['a', 'z', 'b', 'x', 'c', 'd', 'v']) assert.equal(press(key), 0);
  }
  app.document.activeElement = null;
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
    for (const key of ['a', 'z', 'b', 'x', 'c', 'd', 'v']) assert.equal(press(key, { [modifier]: true }), 0);
  }
  for (const id of ['practiceSetupModal', 'sessionSummaryModal', 'lightboxModal', 'practiceViewSection']) {
    const element = app.document.getElementById(id);
    const blockClass = id === 'practiceViewSection' ? 'hidden' : 'opacity-100';
    element.classList.add(blockClass);
    for (const key of ['a', 'z', 'b', 'x', 'c', 'd', 'v']) assert.equal(press(key), 0);
    element.classList.remove(blockClass);
  }
  assert.equal(saved.size, 0);
  assert.equal(vm.runInContext('Object.keys(sessionAnswers).length', app), 0);
});

test('choice aliases cannot answer true/false or unknown questions; other shortcuts still work', () => {
  const { app, press } = createApp();
  for (const answer of ['O', 'X', '無標準答案']) {
    app.answer = answer;
    vm.runInContext("practiceList = [{ question: '題目', answer }]; sessionAnswers = {};", app);
    for (const key of ['a', 'z', 'b', 'x', 'c', 'd', 'v', 'A', 'Z', 'B', 'X', 'C', 'D', 'V']) {
      assert.equal(press(key), 0);
    }
    assert.equal(vm.runInContext('Object.keys(sessionAnswers).length', app), 0);
    if (answer !== '無標準答案') {
      press('1');
      assert.equal(vm.runInContext('sessionAnswers[0]', app), 'O');
      press('2');
      assert.equal(vm.runInContext('sessionAnswers[0]', app), 'X');
    }
  }
  vm.runInContext(`let actions = [];
    toggleExplanation = () => actions.push('explanation');
    toggleCurrentCardReview = () => actions.push('review');
    nextQuestion = () => actions.push('next');
    prevQuestion = () => actions.push('previous');`, app);
  for (const key of ['3', '4', '0', 'Enter', ' ', 'Backspace']) assert.equal(press(key), 1);
  assert.deepEqual(Array.from(vm.runInContext('actions', app)), ['explanation', 'review', 'next', 'next', 'next', 'previous']);
});
