const fs = require('node:fs');
const { parse } = require('node-html-parser');

const JOB_WORDS = ['招聘', '职位', '岗位', '工程师', '经理', '专员', '实习', '校招', '社招', 'analyst', 'engineer', 'manager', 'intern'];

function cleanText(value = '') {
  return value.replace(/[|｜]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function hashNumber(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function matchesAny(text, words) {
  if (!words?.length) return true;
  const lower = text.toLowerCase();
  return words.some((word) => word && (word === '全国' || lower.includes(word.toLowerCase())));
}

function matchesAll(text, words) {
  if (!words?.length) return true;
  const lower = text.toLowerCase();
  return words.every((word) => word && lower.includes(word.toLowerCase()));
}

function absoluteUrl(base, href) {
  try {
    const url = new URL(href, base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function detectAccessBarrier(url, html) {
  const location = String(url || '').toLowerCase();
  if (/\/(login|signin|passport|auth)(\/|\?|$)/.test(location)) return '页面跳转到登录入口';
  const visible = cleanText(String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')).slice(0, 8000);
  if (/请先登录|登录后查看|账号登录|安全验证|访问验证|人机验证|请输入验证码|完成验证后继续|captcha/i.test(visible)) return '页面要求登录或完成验证';
  return '';
}

async function scanHtmlSource(source, request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(source.url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'JobSecretary/0.1 (+local official careers reader)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const barrier = detectAccessBarrier(response.url, html);
    if (barrier) throw new Error(barrier);
    const root = parse(html);
    const roles = (request.roles || []).filter(Boolean);
    const locations = (request.locations || []).filter((item) => item && item !== '全国' && !item.startsWith('全部'));
    const recruitmentTypes = (request.recruitmentTypes || []).filter((item) => item && !item.startsWith('全部'));
    const jobs = [];

    for (const anchor of root.querySelectorAll('a')) {
      const title = cleanText(anchor.textContent);
      if (title.length < 3 || title.length > 90) continue;
      const parentText = anchor.parentNode?.tagName ? anchor.parentNode.textContent : title;
      const context = cleanText(parentText || title).slice(0, 1200);
      const searchable = `${title} ${context}`;
      const looksLikeJob = matchesAny(searchable, roles.length ? roles : JOB_WORDS);
      if (!looksLikeJob || !matchesAll(searchable, locations) || !matchesAny(searchable, recruitmentTypes)) continue;
      const officialUrl = absoluteUrl(source.url, anchor.getAttribute('href'));
      if (!officialUrl) continue;
      jobs.push({
        id: hashNumber(`${source.company}|${title}|${officialUrl}`),
        company: source.company,
        logo: source.shortName || source.company.slice(0, 1),
        role: title,
        location: locations.find((item) => searchable.includes(item)) || '地点见官网',
        province: '', city: '', district: '',
        type: recruitmentTypes.find((item) => searchable.includes(item)) || '官网岗位',
        field: roles[0] || '待分析',
        education: '要求见 JD',
        tags: roles.length ? roles.slice(0, 3) : ['官网来源'],
        date: '刚刚扫描',
        accent: source.accent || '#1769ea',
        officialUrl,
        jd: context,
        source: source.name,
        foundAt: new Date().toISOString(),
        isDemo: false,
      });
      if (jobs.length >= 40) break;
    }
    return { jobs, report: { source: source.name, company: source.company, url: source.url, status: 'ok', access: 'public', count: jobs.length } };
  } finally {
    clearTimeout(timer);
  }
}

async function searchOfficialJobs(request, sourcesPath, customSources = []) {
  const registry = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
  const reports = [];
  const batches = [];
  for (const source of [...registry.sources, ...customSources].filter((item) => item.enabled !== false)) {
    try {
      const result = await scanHtmlSource(source, request);
      batches.push(...result.jobs); reports.push(result.report);
    } catch (error) {
      const message = error?.message || String(error);
      const needsUser = /401|403|429|captcha|cloudflare|login|sign.?in|aborted/i.test(message);
      reports.push({ source: source.name, company: source.company, url: source.url, status: needsUser ? 'needs-user' : 'error', access: needsUser ? 'login-or-verification' : 'unavailable', count: 0, message });
    }
  }
  const seen = new Set();
  const jobs = batches.filter((job) => {
    const key = `${job.company}|${job.role}|${job.officialUrl}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  return { jobs, reports, searchedAt: new Date().toISOString() };
}

module.exports = { searchOfficialJobs, cleanText, hashNumber, matchesAny, matchesAll, detectAccessBarrier };
