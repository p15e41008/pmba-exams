const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const appScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('const EXCEL_SOURCES'));

function createApp(renderAnswers = false) {
  const elements = new Map();
  const saved = new Map();
  let keydown;
  const app = vm.createContext({
    window: { addEventListener(type, handler) { if (type === 'keydown') keydown = handler; } },
    marked: { setOptions() {} },
    document: {
      getElementById(id) {
        if (!elements.has(id)) {
          const classes = new Set();
          const child = { className: '', classList: { add() {}, remove() {} } };
          elements.set(id, {
            innerText: '', style: {},
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
    localStorage: { setItem: (key, value) => saved.set(key, value) }
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
