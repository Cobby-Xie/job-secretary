const KEYWORDS = [
  '用户研究', '用户访谈', '需求分析', '竞品分析', '产品设计', '产品规划', '原型设计', 'Axure', 'Figma',
  '数据分析', '数据可视化', 'SQL', 'Python', 'Excel', 'Tableau', 'Power BI', '统计分析', 'A/B测试',
  '项目管理', '项目推进', '跨部门协作', '沟通', '协调', '策略', '增长', '运营', '内容运营', '活动运营',
  'React', 'Vue', 'TypeScript', 'JavaScript', 'Java', 'Go', 'C++', '前端', '后端', '测试', '算法', '机器学习',
  '供应链', '市场分析', '品牌传播', '客户服务', '销售', '财务分析', '英语', '团队管理', '商业分析',
];

const EXPERIENCE_GUIDES = {
  用户研究: '完成一次真实用户研究：明确问题、招募或触达用户、记录访谈、归纳洞察，并保留研究文档。',
  用户访谈: '参与真实访谈或可用性测试，保留访谈提纲、原始记录和由证据支持的结论。',
  数据分析: '使用公开或真实业务数据完成一次分析，展示数据清洗、指标定义、洞察和实际验证。',
  SQL: '用可公开展示的数据集完成查询项目，保留表结构、核心 SQL、结果解释和可复现说明。',
  Python: '完成一个能运行的 Python 项目或自动化工具，记录问题、实现过程、测试和真实效果。',
  项目管理: '主动负责一个小型真实项目，记录目标、拆解、时间安排、风险处理和复盘结果。',
  跨部门协作: '寻找需要两类角色共同完成的真实任务，记录你的协调动作、分歧处理和最终交付。',
  增长: '完成一次真实增长实验，提前定义指标、假设和对照方式，并如实记录成功或失败结果。',
  运营: '负责一次可验证的内容、活动或用户运营任务，保留过程数据和复盘。',
  React: '完成一个可运行的 React 作品，包含真实交互、状态处理、测试或部署链接。',
  TypeScript: '在真实项目中使用 TypeScript 建模并处理错误边界，准备可解释的代码或作品证据。',
  商业分析: '选择真实企业或公开案例，完成市场、用户、竞争和财务逻辑分析并说明信息来源。',
};

function clean(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function resumeText(resume) {
  return [resume.summary, resume.education, resume.experience, resume.projects, resume.skills].map(clean).join(' ');
}

function extractKeywords(jd = '', role = '') {
  const text = `${jd} ${role}`.toLowerCase();
  const found = KEYWORDS.filter((word) => text.includes(word.toLowerCase()));
  const recruitmentLabels = new Set(['校招', '社招', '实习', '应届', '全职', '兼职']);
  const roleParts = String(role)
    .split(/[（()）\/·|\s]+/)
    .map(clean)
    .filter((word) => word.length >= 2 && word.length <= 12 && !recruitmentLabels.has(word));
  return [...new Set([...found, ...roleParts])].slice(0, 18);
}

function scoreComponent(label, score, max, reason) {
  return { label, score: Math.max(0, Math.min(max, Math.round(score))), max, reason };
}

function evaluateResume(resume, jd = '', role = '') {
  const text = resumeText(resume);
  const lower = text.toLowerCase();
  const jdKeywords = extractKeywords(jd, role);
  const matchedKeywords = jdKeywords.filter((word) => lower.includes(word.toLowerCase()));
  const missingKeywords = jdKeywords.filter((word) => !lower.includes(word.toLowerCase()));
  const coverageRatio = jdKeywords.length ? matchedKeywords.length / jdKeywords.length : 0;
  const coverage = scoreComponent('JD 覆盖', jdKeywords.length ? coverageRatio * 35 : 0, 35, jdKeywords.length ? `已找到 ${matchedKeywords.length}/${jdKeywords.length} 个岗位关键词的简历证据` : 'JD 信息不足，暂不能判断覆盖度');

  const evidenceText = `${resume.experience || ''}\n${resume.projects || ''}`;
  const hasNumbers = /(?:\d+(?:\.\d+)?\s*(?:%|万|千|人|个|次|天|周|月|年|元|条|家))/.test(evidenceText);
  const hasActions = /(负责|主导|推动|设计|分析|搭建|协调|优化|完成|开发|研究|制定|落地)/.test(evidenceText);
  const hasResults = /(提升|降低|增长|节省|达成|交付|结果|上线|转化|留存|效率|准确率)/.test(evidenceText);
  const evidenceScore = (hasActions ? 8 : 0) + (hasResults ? 8 : 0) + (hasNumbers ? 9 : 0);
  const evidence = scoreComponent('经历证据', evidenceScore, 25, `${hasActions ? '有个人行动' : '缺少个人行动'}；${hasResults ? '有结果表达' : '缺少结果表达'}；${hasNumbers ? '有可核实数字' : '缺少可核实数字'}`);

  const sections = [resume.summary, resume.education, resume.experience, resume.projects, resume.skills];
  const completed = sections.filter((value) => clean(value)).length;
  const completeness = scoreComponent('信息完整度', completed * 4, 20, `5 个核心栏目中已填写 ${completed} 个`);

  const lineCount = [resume.experience, resume.projects].join('\n').split(/\r?\n/).map(clean).filter(Boolean).length;
  const reasonableLength = text.length >= 120 && text.length <= 3500;
  const structureScore = (lineCount >= 3 ? 5 : lineCount ? 3 : 0) + (reasonableLength ? 5 : text.length ? 2 : 0);
  const structure = scoreComponent('结构可读性', structureScore, 10, `${lineCount >= 3 ? '经历已分段' : '建议把经历拆成多行要点'}；${reasonableLength ? '正文长度适中' : '正文可能过短或过长'}`);

  const safeScore = /待填写|编造|虚构|TODO|xxx/i.test(text) ? 3 : 10;
  const safety = scoreComponent('真实性检查', safeScore, 10, safeScore === 10 ? '未发现明显占位词，仍需本人逐项核实' : '发现占位或风险词，提交前必须核实');
  const components = [coverage, evidence, completeness, structure, safety];
  const total = components.reduce((sum, item) => sum + item.score, 0);
  const missingExperienceSuggestions = missingKeywords.slice(0, 6).map((keyword) => ({
    keyword,
    suggestion: EXPERIENCE_GUIDES[keyword] || `准备一个能够真实证明“${keyword}”的项目、作品、课程成果或实践记录；没有证据前不要写成已掌握。`,
  }));
  const suggestions = [];
  if (!hasActions) suggestions.push('经历中补充“你具体做了什么”，避免只写团队职责。');
  if (!hasResults) suggestions.push('补充真实结果或复盘结论，即使项目结果不理想也应如实说明。');
  if (!hasNumbers) suggestions.push('在有记录可核实的前提下补充规模、时间、效率或业务指标。');
  if (missingKeywords.length) suggestions.push(`优先核实这些岗位要求是否有真实证据：${missingKeywords.slice(0, 6).join('、')}。`);
  if (!suggestions.length) suggestions.push('基础证据较完整，下一步重点核对完整 JD 与表述准确性。');
  return { total, components, jdKeywords, matchedKeywords, missingKeywords, missingExperienceSuggestions, suggestions };
}

function splitItems(value = '') {
  return String(value).split(/\r?\n|[；;]/).map(clean).filter(Boolean);
}

function rankByKeywords(items, jdKeywords) {
  return [...items].sort((a, b) => {
    const score = (value) => jdKeywords.filter((word) => value.toLowerCase().includes(word.toLowerCase())).length;
    return score(b) - score(a);
  });
}

function tailorResume(resume, jd = '', role = '') {
  const evaluation = evaluateResume(resume, jd, role);
  const matched = evaluation.matchedKeywords;
  const summaryPrefix = matched.length ? `岗位相关证据：${matched.slice(0, 6).join('、')}。` : '';
  const summary = clean(resume.summary);
  const skills = String(resume.skills || '').split(/[，,、\n]/).map(clean).filter(Boolean);
  return {
    ...resume,
    summary: summaryPrefix && !summary.startsWith('岗位相关证据：') ? `${summaryPrefix}\n${summary}`.trim() : summary,
    experience: rankByKeywords(splitItems(resume.experience), evaluation.jdKeywords).join('\n'),
    projects: rankByKeywords(splitItems(resume.projects), evaluation.jdKeywords).join('\n'),
    skills: rankByKeywords(skills, evaluation.jdKeywords).join('、'),
  };
}

export { evaluateResume, extractKeywords, tailorResume };
