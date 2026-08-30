const test = require('node:test');
const assert = require('node:assert/strict');

const baseResume = {
  name: '测试用户', phone: '', email: '', city: '', targetRole: '数据分析师', importedFile: '',
  summary: '有数据分析项目经验', education: '本科',
  experience: '负责业务数据整理\n分析用户留存并推动改进，转化率提升 12%',
  projects: '使用 SQL 完成公开数据集分析', skills: 'Excel、SQL、沟通',
};

test('评分可以解释 JD 覆盖和缺口', async () => {
  const { evaluateResume } = await import('../src/lib/resume-analysis.js');
  const result = evaluateResume(baseResume, '需要 SQL、Python、数据分析、数据可视化和跨部门协作', '数据分析师');
  assert.ok(result.total > 0 && result.total <= 100);
  assert.ok(result.matchedKeywords.includes('SQL'));
  assert.ok(result.missingKeywords.includes('Python'));
  assert.ok(result.missingExperienceSuggestions.some((item) => item.keyword === 'Python'));
  assert.equal(result.components.reduce((sum, item) => sum + item.score, 0), result.total);
});

test('自动定制只重排已有事实，不补入缺失技能', async () => {
  const { tailorResume } = await import('../src/lib/resume-analysis.js');
  const tailored = tailorResume(baseResume, '需要 Python、SQL 和数据分析', '数据分析师');
  assert.match(tailored.summary, /SQL|数据分析/);
  assert.doesNotMatch(tailored.skills, /Python/);
  assert.match(tailored.skills, /SQL/);
});

test('岗位名称中的招聘类型不会被误判为能力缺口', async () => {
  const { extractKeywords } = await import('../src/lib/resume-analysis.js');
  const keywords = extractKeywords('', '产品经理（校招）');
  assert.deepEqual(keywords, ['产品经理']);
});
