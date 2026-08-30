const test = require('node:test');
const assert = require('node:assert/strict');

const { detectAccessBarrier, matchesAny, matchesAll } = require('../desktop/services/job-search.cjs');

test('登录或验证页面会被交给用户处理', () => {
  assert.equal(detectAccessBarrier('https://example.com/login', '<html>欢迎</html>'), '页面跳转到登录入口');
  assert.equal(detectAccessBarrier('https://example.com/jobs', '<main>安全验证，完成验证后继续</main>'), '页面要求登录或完成验证');
});

test('公开招聘页面不会被误标记为登录页面', () => {
  assert.equal(detectAccessBarrier('https://example.com/jobs', '<main>社会招聘 产品经理 上海</main>'), '');
});

test('岗位筛选支持岗位、地点和招聘类型', () => {
  const text = '产品经理 社会招聘 成都 本科及以上';
  assert.equal(matchesAny(text, ['产品经理']), true);
  assert.equal(matchesAll(text, ['成都']), true);
  assert.equal(matchesAny(text, ['实习']), false);
});
