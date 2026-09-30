const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const appScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('const EXCEL_SOURCES'));

function createApp() {
  const elements = new Map();
  const saved = new Map();
  const app = vm.createContext({
    window: { addEventListener() {} },
    marked: { setOptions() {} },
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { innerText: '', style: {} });
        return elements.get(id);
      }
    },
    localStorage: { setItem: (key, value) => saved.set(key, value) }
  });
  vm.runInContext(appScript, app);
  // These tests cover answer validation, persistence and scoring; DOM rendering
  // is checked in the browser using the README's manual regression checklist.
  vm.runInContext('renderAnswerState = () => {};', app);
  return { app, elements, saved };
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
