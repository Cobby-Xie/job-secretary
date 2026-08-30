const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureEndpoint, extractContent, parseQuestionList, parseCompanySearch, providerKind, createProviderRequest } = require('../desktop/services/ai-advisor.cjs');

test('AI 接口只接受 HTTPS 或本机 HTTP', () => {
  assert.equal(ensureEndpoint('https://ark.example.com/v3/chat/completions'), 'https://ark.example.com/v3/chat/completions');
  assert.equal(ensureEndpoint('http://127.0.0.1:11434/v1/chat/completions'), 'http://127.0.0.1:11434/v1/chat/completions');
  assert.throws(() => ensureEndpoint('http://example.com/chat'), /HTTPS/);
});

test('解析兼容接口内容和三道题', () => {
  assert.equal(extractContent({ choices: [{ message: { content: '反馈内容' } }] }), '反馈内容');
  assert.deepEqual(parseQuestionList('```json\n["问题一", "问题二", "问题三"]\n```'), ['问题一', '问题二', '问题三']);
  assert.deepEqual(parseQuestionList('1. 问题一\n2. 问题二\n3. 问题三'), ['问题一', '问题二', '问题三']);
});

test('解析 OpenAI Responses、Claude 与 Gemini 的文本内容', () => {
  assert.equal(extractContent({ output: [{ content: [{ type: 'output_text', text: 'OpenAI 结果' }] }] }), 'OpenAI 结果');
  assert.equal(extractContent({ content: [{ type: 'server_tool_use' }, { type: 'text', text: 'Claude 结果' }] }), 'Claude 结果');
  assert.equal(extractContent({ candidates: [{ content: { parts: [{ text: 'Gemini 结果' }] } }] }), 'Gemini 结果');
});

test('按供应商生成对应协议与联网搜索工具', () => {
  const claude = createProviderRequest({ provider: 'Claude（Anthropic）', endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-test', apiKey: 'secret' }, 'company-search', '搜索企业');
  assert.equal(providerKind({ provider: 'Claude（Anthropic）' }), 'anthropic');
  assert.equal(claude.headers['x-api-key'], 'secret');
  assert.equal(claude.body.tools[0].type, 'web_search_20250305');

  const gemini = createProviderRequest({ provider: 'Gemini（Google AI）', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models', model: 'gemini-test', apiKey: 'secret' }, 'company-search', '搜索企业');
  assert.match(gemini.endpoint, /gemini-test:generateContent$/);
  assert.deepEqual(gemini.body.tools, [{ google_search: {} }]);

  const openai = createProviderRequest({ provider: 'ChatGPT / OpenAI API', endpoint: 'https://api.openai.com/v1/responses', model: 'gpt-test', apiKey: 'secret' }, 'company-search', '搜索企业');
  assert.deepEqual(openai.body.tools, [{ type: 'web_search' }]);

  const qwen = createProviderRequest({ provider: '通义千问（阿里云百炼）', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-test', apiKey: 'secret' }, 'company-search', '搜索企业');
  assert.equal(qwen.body.enable_search, true);
});

test('企业搜索只接受带 companies 的结构化结果', () => {
  const companies = parseCompanySearch('```json\n{"companies":[{"name":"示例企业","official_url":"https://jobs.example.com"}]}\n```');
  assert.equal(companies[0].name, '示例企业');
  assert.throws(() => parseCompanySearch('{"items":[]}'), /companies/);
  assert.equal(parseCompanySearch('搜索结果如下：\n{"companies":[]}\n请核验').length, 0);
});
