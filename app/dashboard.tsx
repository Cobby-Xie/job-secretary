'use client';

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import { evaluateResume, tailorResume, type ResumeEvaluation } from '../src/lib/resume-analysis.js';
import { ALL_CHINA_CITIES, CHINA_PROVINCES, CITIES_BY_PROVINCE } from '../src/data/china-cities.js';

type Section = 'resume' | 'jobs' | 'companies' | 'records' | 'advisor';
type ResumeTemplate = 'english_black' | 'marketing_table' | 'marketing_intern' | 'minimal';
type Resume = {
  name: string; phone: string; email: string; city: string; targetRole: string;
  summary: string; education: string; experience: string; projects: string; skills: string; importedFile: string;
  template: ResumeTemplate; photoDataUrl: string; photoName: string;
};
type RecordItem = { id: number; company: string; role: string; status: string; date: string; officialUrl: string; reminderDate?: string; notes?: string; updatedAt?: string };
type Settings = {
  provider: string; endpoint: string; model: string; apiKey: string; rememberKey: boolean;
  companySearchMode: 'external' | 'api'; webSearchConfirmed: boolean;
};
type Job = {
  id: number; company: string; logo: string; role: string; location: string; province: string; city: string; district: string;
  type: string; field: string; education: string; tags: string[]; date: string; accent: string; officialUrl: string;
  jd?: string; source?: string; foundAt?: string; isDemo?: boolean; isNew?: boolean;
};
type CompanyDirectoryItem = {
  name: string; logo: string; accent: string; industry: string; size: string; location: string; funding: string;
  business: string; roles: string[]; recruitmentTypes: string[]; officialUrl: string; jobs?: CompanyLeadJob[]; liveResult?: boolean;
};
type CompanyLeadJob = { title: string; city: string; recruitmentType: string; url: string; publishedAt: string; summary: string };
type CompanyLead = {
  id: number; name: string; province: string; city: string; role: string; recruitmentType: string;
  officialUrl: string; discoveryUrl: string; access: '待核验' | '官网可直接查看' | '需要登录或验证';
  notes: string; foundAt: string; jobs?: CompanyLeadJob[];
};
type AgentCompanyJobResult = { title?: string; city?: string; recruitment_type?: string; recruitmentType?: string; url?: string; published_at?: string; publishedAt?: string; summary?: string };
type AgentCompanyResult = {
  name?: string; city?: string; role?: string; recruitment_type?: string; recruitmentType?: string;
  official_url?: string; officialUrl?: string; source_url?: string; sourceUrl?: string;
  access?: string; notes?: string; jobs?: AgentCompanyJobResult[];
};
type AgentSearchRequest = {
  requestId: string; province: string; city: string; role: string; recruitmentType: string; createdAt: string;
};
type SearchPlanItem = { title: string; description: string; query: string; url: string; source: string };
type SourceReport = { source: string; company: string; status: string; count: number; url?: string; message?: string; access?: string };
type ResumeVersion = {
  id: number; jobId: number; company: string; role: string; officialUrl: string; createdAt: string;
  resume: Resume; before: ResumeEvaluation; after: ResumeEvaluation; approvedAt?: string;
};
type RadarContext = { province: string; city: string; role: string; recruitmentType: string; searchedAt: string };
type AiProviderPreset = { endpoint: string; modelHint: string; search: 'native' | 'optional'; protocol: string };

const RECORD_STATUSES = ['已收藏', '准备投递', '已投递', '待测评', '待笔试', '待面试', '面试中', '等待结果', '已录用', '已结束'];
const PROVINCES = ['全国', ...CHINA_PROVINCES];
const CITY_SUGGESTIONS = ALL_CHINA_CITIES;

const AI_PROVIDER_PRESETS: Record<string, AiProviderPreset> = {
  '豆包（火山方舟）': { endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', modelHint: '接入点 ID 或豆包模型 ID', search: 'optional', protocol: 'OpenAI Chat Completions' },
  '通义千问（阿里云百炼）': { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', modelHint: '例如：qwen-plus', search: 'native', protocol: 'OpenAI 兼容接口' },
  'ChatGPT / OpenAI API': { endpoint: 'https://api.openai.com/v1/responses', modelHint: '例如：gpt-5.4-mini', search: 'native', protocol: 'Responses API' },
  'Claude（Anthropic）': { endpoint: 'https://api.anthropic.com/v1/messages', modelHint: '填写 Claude Console 中可用的模型 ID', search: 'native', protocol: 'Messages API' },
  'Gemini（Google AI）': { endpoint: 'https://generativelanguage.googleapis.com/v1beta/models', modelHint: '例如：gemini-2.5-flash', search: 'native', protocol: 'GenerateContent API' },
  'DeepSeek': { endpoint: 'https://api.deepseek.com/chat/completions', modelHint: '例如：deepseek-chat', search: 'optional', protocol: 'OpenAI 兼容接口' },
  'Kimi（月之暗面）': { endpoint: 'https://api.moonshot.cn/v1/chat/completions', modelHint: '填写 Moonshot 平台模型 ID', search: 'optional', protocol: 'OpenAI 兼容接口' },
  '智谱 GLM': { endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', modelHint: '填写智谱开放平台模型 ID', search: 'optional', protocol: 'OpenAI 兼容接口' },
  'Ollama（本地模型）': { endpoint: 'http://127.0.0.1:11434/v1/chat/completions', modelHint: '例如：qwen3:8b', search: 'optional', protocol: '本地 OpenAI 兼容接口' },
  '自定义 OpenAI 兼容接口': { endpoint: '', modelHint: '填写服务商要求的模型 ID', search: 'optional', protocol: '自定义协议' },
};

function aiProviderPreset(provider: string) { return AI_PROVIDER_PRESETS[provider] || AI_PROVIDER_PRESETS['自定义 OpenAI 兼容接口']; }

const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: 'resume', label: '自我简历', icon: '文' },
  { id: 'jobs', label: '岗位雷达', icon: '岗' },
  { id: 'companies', label: '企业介绍', icon: '企' },
  { id: 'records', label: '求职记录', icon: '录' },
  { id: 'advisor', label: 'AI 顾问', icon: 'AI' },
];

const SECTION_META: Record<Section, { title: string; subtitle: string }> = {
  resume: { title: '自我简历', subtitle: '把你的经历整理成更有说服力的故事' },
  jobs: { title: '岗位雷达', subtitle: '按城市找到企业，并直达官方最新招聘渠道' },
  companies: { title: '企业介绍', subtitle: '了解目标企业，再决定是否投递' },
  records: { title: '求职记录', subtitle: '把每一次投递和进展放在一个地方' },
  advisor: { title: 'AI 顾问', subtitle: '匹配岗位、优化表达并练习每日面试题' },
};

const JOBS: Job[] = [
  { id: 1, company: '字节跳动', logo: '字', role: '产品经理（校招）', location: '北京 · 海淀区', province: '北京', city: '北京', district: '海淀区', type: '校招', field: '产品', education: '本科及以上', tags: ['用户研究', '数据分析', '增长策略'], date: '示例数据', accent: '#1868f2', officialUrl: 'https://jobs.bytedance.com/' },
  { id: 2, company: '腾讯', logo: 'T', role: '前端开发工程师', location: '广东 · 深圳 · 南山区', province: '广东', city: '深圳', district: '南山区', type: '社招', field: '技术', education: '本科及以上', tags: ['React', 'TypeScript', '工程化'], date: '示例数据', accent: '#08a8ea', officialUrl: 'https://careers.tencent.com/' },
  { id: 3, company: '小米集团', logo: 'mi', role: '品牌运营实习生', location: '北京 · 海淀区', province: '北京', city: '北京', district: '海淀区', type: '实习', field: '运营', education: '本科在读', tags: ['内容策划', '品牌传播', '活动运营'], date: '示例数据', accent: '#ff6900', officialUrl: 'https://hr.xiaomi.com/' },
  { id: 4, company: '美团', logo: 'M', role: '数据分析师', location: '上海 · 长宁区', province: '上海', city: '上海', district: '长宁区', type: '社招', field: '数据', education: '本科及以上', tags: ['SQL', '业务分析', '可视化'], date: '示例数据', accent: '#e9b900', officialUrl: 'https://zhaopin.meituan.com/' },
  { id: 5, company: '京东', logo: 'JD', role: '供应链运营（校招）', location: '江苏 · 南京 · 雨花台区', province: '江苏', city: '南京', district: '雨花台区', type: '校招', field: '运营', education: '本科及以上', tags: ['供应链', '项目管理', '数据运营'], date: '示例数据', accent: '#e1251b', officialUrl: 'https://zhaopin.jd.com/' },
];

const COMPANIES: CompanyDirectoryItem[] = [
  { name: '字节跳动', logo: '字', accent: '#1769ea', industry: '互联网 · 内容与科技', size: '10,000 人以上', location: '北京（全国多地）', funding: '未上市', business: '信息平台、企业服务、内容与电商', roles: ['产品', '技术', '运营'], recruitmentTypes: ['校招', '社招', '实习'], officialUrl: 'https://jobs.bytedance.com/' },
  { name: '腾讯', logo: 'T', accent: '#08a8ea', industry: '互联网 · 社交与云服务', size: '10,000 人以上', location: '深圳（全国多地）', funding: '已上市', business: '社交、游戏、金融科技与云服务', roles: ['产品', '技术', '数据'], recruitmentTypes: ['校招', '社招', '实习'], officialUrl: 'https://careers.tencent.com/' },
  { name: '小米集团', logo: 'mi', accent: '#ff6900', industry: '智能硬件 · 消费电子', size: '10,000 人以上', location: '北京（全国多地）', funding: '已上市', business: '智能手机、汽车与 AIoT 生态', roles: ['运营', '产品', '技术'], recruitmentTypes: ['校招', '社招', '实习'], officialUrl: 'https://hr.xiaomi.com/' },
  { name: '美团', logo: 'M', accent: '#e9b900', industry: '互联网 · 本地生活', size: '10,000 人以上', location: '北京（全国多地）', funding: '已上市', business: '本地生活服务与即时零售', roles: ['数据', '产品', '运营'], recruitmentTypes: ['校招', '社招', '实习'], officialUrl: 'https://zhaopin.meituan.com/' },
  { name: '京东', logo: 'JD', accent: '#e1251b', industry: '互联网 · 零售与供应链', size: '10,000 人以上', location: '北京（全国多地）', funding: '已上市', business: '零售、物流、科技与健康服务', roles: ['运营', '技术', '产品'], recruitmentTypes: ['校招', '社招', '实习'], officialUrl: 'https://zhaopin.jd.com/' },
];

function createSearchPlan(city: string, role: string, recruitmentType: string): SearchPlanItem[] {
  const targetRole = role.trim() || '招聘岗位';
  const targetType = recruitmentType === '全部类型' ? '' : recruitmentType;
  const year = new Date().getFullYear();
  const items = [
    { title: '优先寻找企业官网', description: '从公开搜索结果中发现公司，再进入企业自己的招聘网站核验。', query: `${city} ${targetRole} ${targetType} 招聘 官网`, source: '必应' },
    { title: '交叉核对最新招聘', description: '用另一搜索入口检查发布时间、招聘批次与岗位是否仍然开放。', query: `${city} ${targetRole} ${targetType} ${year} 最新招聘`, source: '百度' },
    { title: '补充校园与实习入口', description: '适合寻找单独建设的校园招聘、实习生招聘专题页。', query: `${city} ${targetRole} 校园招聘 实习 招聘官网`, source: '必应' },
    { title: '检查公共就业来源', description: '补充政府公共就业服务网站公开发布的企业招聘线索。', query: `site:gov.cn ${city} ${targetRole} 招聘`, source: '必应' },
  ];
  return items.map((item) => ({ ...item, url: item.source === '百度' ? `https://www.baidu.com/s?wd=${encodeURIComponent(item.query)}` : `https://cn.bing.com/search?q=${encodeURIComponent(item.query)}` }));
}

function leadAsCompany(lead: CompanyLead): CompanyDirectoryItem {
  return {
    name: lead.name,
    logo: lead.name.slice(0, 2),
    accent: '#5279b6',
    industry: '即时搜索发现 · 信息待核验',
    size: '待核验',
    location: lead.city,
    funding: '待核验',
    business: lead.notes || '请通过企业官网、公告或年报补充企业介绍。',
    roles: [lead.role || '待分析'],
    recruitmentTypes: [lead.recruitmentType],
    officialUrl: lead.officialUrl,
    jobs: lead.jobs || [],
    liveResult: true,
  };
}

const DEFAULT_RESUME: Resume = { name: '', phone: '', email: '', city: '', targetRole: '产品经理', summary: '', education: '', experience: '', projects: '', skills: '', importedFile: '', template: 'marketing_table', photoDataUrl: '', photoName: '' };
const DEFAULT_RECORDS: RecordItem[] = [];

function useStoredState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const saved = window.jobSecretary ? await window.jobSecretary.storage.get<T>(key) : JSON.parse(localStorage.getItem(key) || 'null');
        if (active && saved !== null) {
          if (key === 'qs-resume' && typeof saved === 'object') setValue({ ...(initial as Record<string, unknown>), ...(saved as Record<string, unknown>) } as T);
          else if (!window.jobSecretary && key === 'qs-ai-settings') setValue({ ...saved, apiKey: '', rememberKey: false });
          else setValue(saved);
        }
      } catch { /* keep defaults */ }
      if (active) setReady(true);
    }
    load();
    return () => { active = false; };
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    if (window.jobSecretary) window.jobSecretary.storage.set(key, value).catch(() => undefined);
    else if (key === 'qs-ai-settings') localStorage.setItem(key, JSON.stringify({ ...value, apiKey: '', rememberKey: false }));
    else localStorage.setItem(key, JSON.stringify(value));
  }, [key, ready, value]);
  return [value, setValue];
}

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

function todayKey() { return new Date().toLocaleDateString('sv-SE'); }

export default function Dashboard() {
  const [active, setActive] = useStoredState<Section>('qs-active-section', 'jobs');
  const [resume, setResume] = useStoredState<Resume>('qs-resume', DEFAULT_RESUME);
  const [records, setRecords] = useStoredState<RecordItem[]>('qs-records', DEFAULT_RECORDS);
  const [savedJobs, setSavedJobs] = useStoredState<number[]>('qs-saved-jobs', []);
  const [jobPool, setJobPool] = useStoredState<Job[]>('qs-job-pool', JOBS);
  const [selectedJobId, setSelectedJobId] = useStoredState<number | null>('qs-selected-job', null);
  const [settings, setSettings] = useStoredState<Settings>('qs-ai-settings', { provider: '豆包（火山方舟）', endpoint: AI_PROVIDER_PRESETS['豆包（火山方舟）'].endpoint, model: '', apiKey: '', rememberKey: false, companySearchMode: 'external', webSearchConfirmed: false });
  const [companyLeads, setCompanyLeads] = useStoredState<CompanyLead[]>('qs-company-leads', []);
  const [lastCompanySearch, setLastCompanySearch] = useStoredState<RadarContext | null>('qs-last-company-search', null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [toast, setToast] = useState('');
  const desktopMode = Boolean(window.jobSecretary);

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(''), 2600); }
  const completeCount = records.filter((item) => item.status === '已录用').length;
  const selectedJob = jobPool.find((job) => job.id === selectedJobId) || null;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand brand-button" onClick={() => setActive('jobs')}>
          <span className="brand-mark"><img src="./求职秘书-icon.png" alt="" /></span><span><strong>求职秘书</strong><small>让每次投递都有回音</small></span>
        </button>
        <nav className="main-nav" aria-label="主要功能">
          <p className="nav-heading">工作台</p>
          {NAV_ITEMS.map((item) => (
            <button data-guide-nav={item.id} className={`nav-item ${active === item.id ? 'active' : ''} ${guideOpen && NAV_ITEMS[guideStep]?.id === item.id ? 'guide-focus' : ''}`} key={item.id} onClick={() => setActive(item.id)}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
              {item.id === 'advisor' && <em>3</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-summary">
          <div><span>本地求职档案</span><strong>{records.length}</strong><small>条求职记录</small></div>
          <div className="mini-progress"><i style={{ width: `${Math.min(100, records.length * 18)}%` }} /></div>
          <p>已有 {completeCount} 份录用结果，所有个人数据默认仅保存在{desktopMode ? '本机' : '当前浏览器'}。</p>
        </div>
        <div className="sidebar-bottom">
          <button className="guide-card" onClick={() => { setGuideStep(0); setGuideOpen(true); }}><span className="guide-symbol">?</span><span><b>新手指引</b><small>2 分钟了解所有功能</small></span><i>›</i></button>
          <button className="nav-item quiet" onClick={() => setSettingsOpen(true)}><span className="nav-icon">设</span><span>设置与数据</span></button>
          <button className="nav-item quiet" onClick={() => setSubmitOpen(true)}><span className="nav-icon">源</span><span>添加企业招聘官网</span></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>求职秘书</span><b>/</b><strong>{SECTION_META[active].title}</strong></div>
          <div className="top-actions"><span className="sync-pill"><i /> {desktopMode ? '桌面本地数据' : '在线体验 · 浏览器本地数据'}</span><button className="round-button" aria-label="帮助" onClick={() => setGuideOpen(true)}>?</button><div className="avatar">你</div></div>
        </header>
        {!desktopMode && <div className="online-preview-note"><b>在线体验版</b><span>简历与记录仅保存在当前浏览器；官网自动扫描、DOCX 导入和私有 AI 接口将在桌面版或安全后端中启用。</span></div>}
        {active === 'jobs' && <CompanyRadarSection settings={settings} openSettings={() => setSettingsOpen(true)} setJobs={setJobPool} companyLeads={companyLeads} setCompanyLeads={setCompanyLeads} setLastCompanySearch={setLastCompanySearch} openCompanies={() => setActive('companies')} notify={notify} analyze={(job) => { setSelectedJobId(job.id); setActive('advisor'); }} />}
        {active === 'resume' && <ResumeSection resume={resume} setResume={setResume} notify={notify} />}
        {active === 'companies' && <CompaniesSection targetRole={resume.targetRole} companyLeads={companyLeads} searchContext={lastCompanySearch} openSubmit={() => setSubmitOpen(true)} />}
        {active === 'records' && <RecordsSection records={records} setRecords={setRecords} notify={notify} />}
        {active === 'advisor' && <AdvisorSection resume={resume} records={records} setRecords={setRecords} selectedJob={selectedJob} settings={settings} openSettings={() => setSettingsOpen(true)} notify={notify} />}
      </section>

      {settingsOpen && <SettingsModal settings={settings} setSettings={setSettings} resume={resume} setResume={setResume} records={records} setRecords={setRecords} close={() => setSettingsOpen(false)} notify={notify} />}
      {submitOpen && <SubmissionModal close={() => setSubmitOpen(false)} notify={notify} />}
      {guideOpen && <GuideOverlay step={guideStep} setStep={setGuideStep} close={() => setGuideOpen(false)} setActive={setActive} />}
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}

function PageIntro({ section, action }: { section: Section; action?: React.ReactNode }) {
  return <div className="page-intro"><div><span className="eyebrow dark">JOB SECRETARY</span><h1>{SECTION_META[section].title}</h1><p>{SECTION_META[section].subtitle}</p></div>{action}</div>;
}

function JobsSection({ jobs, setJobs, records, setRecords, saved, setSaved, notify, analyze }: { jobs: Job[]; setJobs: Dispatch<SetStateAction<Job[]>>; records: RecordItem[]; setRecords: Dispatch<SetStateAction<RecordItem[]>>; saved: number[]; setSaved: Dispatch<SetStateAction<number[]>>; notify: (m: string) => void; analyze: (job: Job) => void }) {
  const [query, setQuery] = useState(''); const [province, setProvince] = useState('全国'); const [city, setCity] = useState(''); const [district, setDistrict] = useState(''); const [type, setType] = useState('全部类型'); const [field, setField] = useState('全部方向'); const [advanced, setAdvanced] = useState(false);
  const [scanning, setScanning] = useState(false); const [scanSummary, setScanSummary] = useState('');
  const [refreshTimes, setRefreshTimes] = useStoredState<Record<string, string>>('qs-job-refresh-times', {});
  const cityKey = `${province}|${city.trim()}`; const lastRefresh = refreshTimes[cityKey] || ''; const canSearch = Boolean(city.trim());
  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const q = query.trim().toLowerCase();
    const locationText = `${job.province}${job.city}${job.district}${job.location}${job.jd || ''}`;
    return (!q || `${job.company}${job.role}${job.tags.join('')}`.toLowerCase().includes(q)) && (province === '全国' || locationText.includes(province)) && (!city.trim() || locationText.includes(city.trim())) && (!district.trim() || locationText.includes(district.trim())) && (type === '全部类型' || job.type === type) && (field === '全部方向' || job.field === field);
  }), [city, district, field, jobs, province, query, type]);
  const companyCount = new Set(filteredJobs.map((job) => job.company)).size;
  async function runOfficialScan(refresh = false) {
    if (!canSearch) { notify('请先填写要搜索的城市'); return; }
    setScanning(true); setScanSummary(refresh ? `正在刷新${city.trim()}的岗位快照……` : `正在搜索${city.trim()}的企业与岗位……`);
    if (!window.jobSecretary) {
      const refreshedAt = new Date().toLocaleString('zh-CN', { hour12: false });
      setRefreshTimes((items) => ({ ...items, [cityKey]: refreshedAt }));
      setScanSummary(`在线体验版已从浏览器示例岗位池筛选出 ${companyCount} 家公司、${filteredJobs.length} 个岗位。真实官网刷新将在桌面版或全国岗位服务中运行。`);
      notify(`已筛选${city.trim()}的示例岗位`); setScanning(false); return;
    }
    try {
      const result = await window.jobSecretary.jobs.search({ roles: query ? [query] : field === '全部方向' ? [] : [field], locations: [province, city.trim(), district.trim()], recruitmentTypes: type === '全部类型' ? [] : [type] });
      const existingKeys = new Set(jobs.filter((job) => !job.isDemo).map((job) => `${job.company}|${job.role}|${job.officialUrl}`.toLowerCase()));
      const found = (result.jobs as Job[]).map((job) => ({ ...job, isNew: !existingKeys.has(`${job.company}|${job.role}|${job.officialUrl}`.toLowerCase()) }));
      const newCount = found.filter((job) => job.isNew).length;
      setJobs((existing) => {
        const realExisting = existing.filter((job) => !job.isDemo).map((job) => ({ ...job, isNew: false }));
        const byKey = new Map([...realExisting, ...found].map((job) => [`${job.company}|${job.role}|${job.officialUrl}`, job]));
        return found.length ? Array.from(byKey.values()) : existing;
      });
      const ok = result.reports.filter((item) => (item as { status: string }).status === 'ok').length;
      const failed = result.reports.length - ok;
      const refreshedAt = new Date().toLocaleString('zh-CN', { hour12: false }); setRefreshTimes((items) => ({ ...items, [cityKey]: refreshedAt }));
      setScanSummary(`刷新完成：${ok} 个来源可访问，${failed} 个需要更新适配器；${city.trim()}共有 ${found.length} 条候选岗位，本次新增 ${newCount} 条。`);
      notify(found.length ? `找到 ${found.length} 条岗位，其中 ${newCount} 条为新增` : '本次没有发现匹配岗位，请调整关键词或官网源');
    } catch (error) { setScanSummary('扫描未完成，请检查网络或官网源配置。'); notify(error instanceof Error ? error.message : '官网扫描失败'); }
    finally { setScanning(false); }
  }
  function addRecord(job: Job) {
    if (records.some((item) => item.company === job.company && item.role === job.role)) { notify('这份岗位已在求职记录中'); return; }
    setRecords((items) => [{ id: Date.now(), company: job.company, role: job.role, status: '已收藏', date: todayKey(), officialUrl: job.officialUrl }, ...items]); notify('已加入求职记录');
  }
  return <div className="page-content">
    <section className="hero-panel"><div><span className="eyebrow">JOB RADAR</span><h1>从企业官网发现合适岗位</h1><p>按目标岗位和地点读取已配置的企业官方招聘页面，保留原始链接和 JD；软件只帮助筛选，最终由本人投递。</p></div><div className="hero-stats"><div><strong>手动</strong><span>当前扫描方式</span></div><div><strong>{jobs.length}</strong><span>本地岗位池</span></div><div><strong>本人</strong><span>完成最终投递</span></div></div></section>
    <div className="coverage-note"><b>当前覆盖范围</b><span>桌面版目前预置 5 家企业招聘官网，并扫描用户自行添加的官网源；不是全国企业全量搜索。全国化将以国家及省级公共就业平台、企业招聘官网为来源，逐个建立合规适配器和刷新记录。</span></div>
    <section className="filter-card">
      <div className="search-row"><label className="search-input"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入目标职位，例如：产品经理" /></label><button className="primary-button" disabled={scanning || !canSearch} onClick={() => runOfficialScan(false)}>{scanning ? '正在搜索…' : canSearch ? `搜索${city.trim()}岗位` : '请先选择城市'}</button><button className="refresh-button" title="刷新该城市岗位" aria-label="刷新该城市岗位" disabled={scanning || !canSearch} onClick={() => runOfficialScan(true)}>↻</button></div>
      <div className="filter-row progressive-filters">
        <label><span>① 职业名称</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="如：产品经理" /></label>
        <label><span>② 省份</span><select value={province} onChange={(e) => { setProvince(e.target.value); setCity(''); setDistrict(''); }}>{PROVINCES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>城市（必填）</span><input list="job-city-options" value={city} onChange={(e) => setCity(e.target.value)} placeholder="可输入全国任意城市" /><datalist id="job-city-options">{CITY_SUGGESTIONS.map((item) => <option value={item} key={item} />)}</datalist></label>
        <label><span>区 / 县</span><input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="可选，如：海淀区" /></label>
        <label><span>③ 招聘类型</span><select value={type} onChange={(e) => setType(e.target.value)}><option>全部类型</option><option>校招</option><option>社招</option><option>实习</option></select></label>
        <button className="more-filter" onClick={() => setAdvanced((v) => !v)}>更多筛选 <span>{advanced ? '－' : '＋'}</span></button>
      </div>
      {advanced && <div className="advanced-row"><label>方向 <select value={field} onChange={(e) => setField(e.target.value)}><option>全部方向</option><option>产品</option><option>技术</option><option>运营</option><option>数据</option></select></label><label>学历 <select><option>不限</option><option>大专及以上</option><option>本科及以上</option></select></label><label>发布时间 <select><option>不限</option><option>今天</option><option>近 3 天</option></select></label></div>}
      {(scanSummary || lastRefresh) && <p className="scan-summary">{scanSummary || `${city.trim()}岗位上次刷新：${lastRefresh}`} {lastRefresh && <small>最近刷新：{lastRefresh}</small>}</p>}
    </section>
    <div className="section-heading"><div><h2>{city.trim() ? `${city.trim()}的公司与岗位` : '为你推荐'}</h2><span>当前显示 {companyCount} 家公司、{filteredJobs.length} 个岗位，其中 {filteredJobs.filter((job) => job.isDemo !== false).length} 个为引导示例</span></div><div className="source-note"><i>✓</i> 链接指向企业招聘官网</div></div>
    <section className="job-list">{filteredJobs.map((job) => <article className="job-card" key={job.id}>
      <div className="company-logo" style={{ background: job.accent }}>{job.logo}</div><div className="job-main"><div className="job-title-line"><h3>{job.role}</h3><span className={`type-badge type-${job.type}`}>{job.type}</span>{job.isNew && <span className="new-job-badge">本次新增</span>}</div><p className="company-name">{job.company}<span>·</span>{job.location}<span>·</span>{job.education}</p><div className="tag-list">{job.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
      <div className="job-side"><button className={`save-button ${saved.includes(job.id) ? 'saved' : ''}`} onClick={() => setSaved((items) => items.includes(job.id) ? items.filter((id) => id !== job.id) : [...items, job.id])}>{saved.includes(job.id) ? '★ 已收藏' : '☆ 收藏'}</button><a className="link-button" href={job.officialUrl} target="_blank" rel="noreferrer">查看官网 ↗</a><button className="analysis-button" onClick={() => analyze(job)}>分析 JD</button><button className="text-action" onClick={() => addRecord(job)}>＋ 加入记录</button><small>{job.isDemo === false ? job.source || '企业官网' : job.date}</small></div>
    </article>)}{!filteredJobs.length && <div className="empty-state"><b>没有找到匹配岗位</b><span>换一个关键词或放宽筛选条件试试</span></div>}</section>
    <p className="demo-notice"><b>数据说明</b> 首次启动会保留演示岗位帮助理解流程；点击“扫描企业官网”后读取官方页面。官网结构可能变化，扫描结果必须通过原始链接核验，不能仅凭软件判断岗位仍然开放。</p>
  </div>;
}

function CompanyRadarSection({ settings, openSettings, setJobs, companyLeads, setCompanyLeads, setLastCompanySearch, openCompanies, notify, analyze }: { settings: Settings; openSettings: () => void; setJobs: Dispatch<SetStateAction<Job[]>>; companyLeads: CompanyLead[]; setCompanyLeads: Dispatch<SetStateAction<CompanyLead[]>>; setLastCompanySearch: Dispatch<SetStateAction<RadarContext | null>>; openCompanies: () => void; notify: (m: string) => void; analyze: (job: Job) => void }) {
  const [query, setQuery] = useState(''); const [province, setProvince] = useState(''); const [city, setCity] = useState(''); const [type, setType] = useState('全部类型');
  const [searchedCity, setSearchedCity] = useState(''); const [capturing, setCapturing] = useState<CompanyDirectoryItem | null>(null);
  const [leadEditorOpen, setLeadEditorOpen] = useState(false); const [scanning, setScanning] = useState(false); const [aiSearching, setAiSearching] = useState(false);
  const [searchPlan, setSearchPlan] = useState<SearchPlanItem[]>([]); const [officialJobs, setOfficialJobs] = useState<Job[]>([]);
  const [sourceReports, setSourceReports] = useState<SourceReport[]>([]);
  const [agentRequests, setAgentRequests] = useStoredState<Record<string, AgentSearchRequest>>('qs-agent-search-requests', {});
  const cityOptions = CITIES_BY_PROVINCE[province] || [];
  const agentRequestKey = `${province}|${searchedCity}`;
  const companySearchMode = settings.companySearchMode || 'external';
  const providerPreset = aiProviderPreset(settings.provider);
  const connectedSearchReady = Boolean(window.jobSecretary && companySearchMode === 'api' && (providerPreset.search === 'native' || settings.webSearchConfirmed) && settings.endpoint && settings.model && settings.apiKey);
  const companies = useMemo(() => {
    if (!searchedCity) return [];
    const keyword = query.trim().toLowerCase();
    return COMPANIES.filter((company) => company.location.includes('全国多地') || company.location.includes(searchedCity)).filter((company) => !keyword || `${company.name}${company.business}${company.industry}${company.roles.join('')}`.toLowerCase().includes(keyword)).filter((company) => type === '全部类型' || company.recruitmentTypes.includes(type));
  }, [query, searchedCity, type]);
  const leads = useMemo(() => companyLeads.filter((lead) => lead.city === searchedCity).filter((lead) => type === '全部类型' || lead.recruitmentType === type).filter((lead) => !query.trim() || `${lead.name}${lead.role}${lead.notes}`.toLowerCase().includes(query.trim().toLowerCase())), [companyLeads, query, searchedCity, type]);
  function searchCompanies() {
    if (!province) { notify('请先选择省份'); return; }
    if (!city.trim()) { notify('请从当前省份中选择城市'); return; }
    const nextCity = city.trim(); setSearchedCity(nextCity); setLastCompanySearch({ province, city: nextCity, role: query.trim(), recruitmentType: type, searchedAt: new Date().toISOString() }); setSearchPlan(createSearchPlan(nextCity, query, type)); setOfficialJobs([]); setSourceReports([]);
    notify(`已生成 ${nextCity} 的即时搜索方案`);
  }
  async function scanRegisteredSources() {
    if (!searchedCity) { notify('请先生成搜索方案'); return; }
    if (!window.jobSecretary) { notify('当前预览可打开实时搜索；自动读取公开官网请在桌面版使用'); return; }
    setScanning(true);
    try {
      const result = await window.jobSecretary.jobs.search({ roles: query.trim() ? [query.trim()] : [], locations: [province, searchedCity], recruitmentTypes: type === '全部类型' ? [] : [type] });
      const jobs = (result.jobs as Job[]).map((job) => ({ ...job, isNew: true }));
      const reports = result.reports as SourceReport[]; setOfficialJobs(jobs); setSourceReports(reports);
      setJobs((items) => {
        const known = new Map(items.map((job) => [`${job.company}|${job.role}|${job.officialUrl}`.toLowerCase(), job]));
        for (const job of jobs) known.set(`${job.company}|${job.role}|${job.officialUrl}`.toLowerCase(), job);
        return Array.from(known.values());
      });
      const needsUser = reports.filter((item) => item.status !== 'ok').length;
      notify(jobs.length ? `从公开官网找到 ${jobs.length} 条候选岗位` : needsUser ? `${needsUser} 个来源需用户打开核验` : '登记官网暂未发现匹配岗位');
    } catch (error) { notify(error instanceof Error ? error.message : '公开官网检查失败'); }
    finally { setScanning(false); }
  }
  function saveLead(lead: Omit<CompanyLead, 'id' | 'province' | 'city' | 'foundAt'>) {
    const item: CompanyLead = { ...lead, id: Date.now(), province, city: searchedCity, foundAt: new Date().toISOString() };
    setCompanyLeads((items) => [item, ...items.filter((existing) => existing.officialUrl !== item.officialUrl)]); setLeadEditorOpen(false); notify('企业线索已保存到本地');
  }
  function exportAgentSearchTask() {
    const requestId = `job-secretary-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const task = {
      schema_version: 1,
      task: 'find-official-company-career-sites',
      request_id: requestId,
      created_at: createdAt,
      criteria: { province, city: searchedCity, role: query.trim() || '不限岗位方向', recruitment_type: type },
      instructions: [
        '使用你自己的网页搜索能力寻找符合地区和岗位方向的企业。',
        '优先核验企业官方招聘网站、官方校园招聘站或企业授权的 ATS 岗位页。',
        '不要返回 BOSS直聘、实习僧、搜索引擎结果页或无法核验来源的聚合页面。',
        '对每家企业继续检查其官方招聘页，列出当前公开可核验的匹配岗位名称和岗位详情链接；无法核验时 jobs 返回空数组，不要猜测。',
        '遇到登录、验证码或访问限制时停止自动处理，把 access 标记为 login_required 或 verification_required。',
        '不要投递、不要登录账号、不要猜测招聘状态；每家公司保留发现来源和核验说明。',
        '按 result_schema 返回纯 JSON，并保存为 company-search-results.json。',
      ],
      result_schema: {
        schema_version: 1,
        request_id: requestId,
        searched_at: 'ISO-8601 time',
        companies: [{ name: '企业名称', city: searchedCity, role: '匹配方向', recruitment_type: '校招/社招/实习/全部类型', official_url: 'https://企业官方招聘入口', source_url: 'https://用于核验的公开来源', access: 'public/login_required/verification_required/unknown', notes: '核验结果与注意事项', jobs: [{ title: '官网公开岗位名称', city: searchedCity, recruitment_type: '校招/社招/实习/未知', url: 'https://官方岗位详情链接', published_at: '官网显示日期或未知', summary: '一句话岗位方向' }] }],
      },
    };
    setAgentRequests((items) => ({ ...items, [agentRequestKey]: { requestId, province, city: searchedCity, role: query.trim() || '不限岗位方向', recruitmentType: type, createdAt } }));
    downloadFile(`求职秘书-AI搜索任务-${searchedCity}.json`, JSON.stringify(task, null, 2), 'application/json;charset=utf-8');
    const prompt = `请读取“求职秘书-AI搜索任务-${searchedCity}.json”，按照任务中的规则联网搜索企业官方招聘入口，并把纯 JSON 结果保存为 company-search-results.json。不要登录、不要绕过验证码、不要投递。`;
    navigator.clipboard?.writeText(prompt).catch(() => undefined); notify('AI 搜索任务已下载，调用提示也已尝试复制');
  }
  function normalizeCompanyResults(results: AgentCompanyResult[]) {
    if (!Array.isArray(results)) throw new Error('AI 结果缺少 companies 数组');
    if (results.length > 100) throw new Error('单次最多导入 100 家企业，请拆分并重新核验');
    const blockedHosts = ['baidu.com', 'bing.com', 'zhipin.com', 'shixiseng.com'];
    const accessMap: Record<string, CompanyLead['access']> = { public: '官网可直接查看', login_required: '需要登录或验证', verification_required: '需要登录或验证', unknown: '待核验' };
    return results.map((result, index) => {
      const officialUrl = String(result.official_url || result.officialUrl || '').trim(); const url = new URL(officialUrl);
      if (url.protocol !== 'https:' || blockedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new Error(`第 ${index + 1} 条不是允许的 HTTPS 企业官方招聘链接`);
      const name = String(result.name || '').trim(); if (name.length < 2) throw new Error(`第 ${index + 1} 条缺少企业名称`);
      const returnedCity = String(result.city || '').trim();
      const cityNote = returnedCity && returnedCity !== searchedCity ? `AI 返回地区：${returnedCity}；` : '';
      const returnedJobs = Array.isArray(result.jobs) ? result.jobs.slice(0, 50) : [];
      const jobs = returnedJobs.map((job, jobIndex) => {
        const jobUrl = String(job.url || '').trim(); const parsedJobUrl = new URL(jobUrl);
        if (parsedJobUrl.protocol !== 'https:' || blockedHosts.some((host) => parsedJobUrl.hostname === host || parsedJobUrl.hostname.endsWith(`.${host}`))) throw new Error(`第 ${index + 1} 家企业的第 ${jobIndex + 1} 个岗位链接不是允许的 HTTPS 官方链接`);
        const title = String(job.title || '').trim(); if (title.length < 2) throw new Error(`第 ${index + 1} 家企业的第 ${jobIndex + 1} 个岗位缺少名称`);
        return { title, city: String(job.city || searchedCity), recruitmentType: String(job.recruitment_type || job.recruitmentType || '未知'), url: jobUrl, publishedAt: String(job.published_at || job.publishedAt || '未知'), summary: String(job.summary || '') } satisfies CompanyLeadJob;
      });
      return { id: Date.now() + index, name, province, city: searchedCity, role: String(result.role || query || '待确认'), recruitmentType: String(result.recruitment_type || result.recruitmentType || (type === '全部类型' ? '待确认' : type)), officialUrl, discoveryUrl: String(result.source_url || result.sourceUrl || ''), access: accessMap[String(result.access || 'unknown')] || '待核验', notes: `${cityNote}${String(result.notes || '由用户接入的 AI 搜索并整理，仍需打开官网核验。')}`, foundAt: new Date().toISOString(), jobs } satisfies CompanyLead;
    });
  }
  function mergeCompanyResults(imported: CompanyLead[]) {
    setCompanyLeads((items) => { const byUrl = new Map(items.map((item) => [item.officialUrl, item])); for (const item of imported) byUrl.set(item.officialUrl, item); return Array.from(byUrl.values()).sort((a, b) => b.id - a.id); });
  }
  async function searchWithConnectedAI() {
    if (!window.jobSecretary) { notify('自定义 AI 接口仅在 Windows 桌面版中启用'); return; }
    if (!connectedSearchReady) { notify('请先配置 AI 接口，并确认该模型支持联网搜索'); openSettings(); return; }
    setAiSearching(true);
    try {
      const requestId = `job-secretary-api-${Date.now()}`;
      const result = await window.jobSecretary.advisor.run('company-search', { requestId, province, city: searchedCity, role: query.trim() || '不限岗位方向', recruitmentType: type });
      const imported = normalizeCompanyResults((result.companies || []) as AgentCompanyResult[]);
      mergeCompanyResults(imported); notify(imported.length ? `AI 返回 ${imported.length} 家企业，请逐个打开官网核验` : 'AI 未返回可核验的企业官网');
    } catch (error) { notify(error instanceof Error ? error.message : 'AI 企业搜索失败'); }
    finally { setAiSearching(false); }
  }
  async function importAgentSearchResults(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('结果文件不能超过 1 MB');
      const parsed = JSON.parse(await file.text());
      if (parsed?.schema_version !== 1) throw new Error('结果文件 schema_version 必须为 1');
      const expectedRequest = agentRequests[agentRequestKey];
      if (!expectedRequest) throw new Error('请先为当前省市下载 AI 搜索任务，再导入对应结果');
      if (parsed?.request_id !== expectedRequest.requestId) throw new Error('结果文件与当前省市最近一次 AI 搜索任务不匹配');
      const results: AgentCompanyResult[] = parsed.companies;
      if (!Array.isArray(results)) throw new Error('结果文件缺少 companies 数组');
      const imported = normalizeCompanyResults(results);
      mergeCompanyResults(imported);
      notify(`已导入 ${imported.length} 家企业，请逐个打开官网核验`);
    } catch (error) { notify(error instanceof Error ? error.message : 'AI 搜索结果导入失败'); }
    finally { event.target.value = ''; }
  }
  function captureJob(company: CompanyDirectoryItem, draft: { role: string; jd: string; officialUrl: string; type: string }) {
    const job: Job = { id: Date.now(), company: company.name, logo: company.logo, role: draft.role.trim(), location: `${province === '全国' ? '' : `${province} · `}${searchedCity}`, province: province === '全国' ? '' : province, city: searchedCity, district: '', type: draft.type, field: company.roles[0] || '待分析', education: '要求见 JD', tags: company.roles, date: '用户从官网录入', accent: company.accent, officialUrl: draft.officialUrl || company.officialUrl, jd: draft.jd.trim(), source: '用户从企业招聘官网录入', foundAt: new Date().toISOString(), isDemo: false, isNew: true };
    setJobs((items) => [job, ...items.filter((item) => item.id !== job.id)]); setCapturing(null); analyze(job); notify('岗位 JD 已录入，正在进入 AI 顾问');
  }
  return <div className="page-content">
    <section className="hero-panel"><div><span className="eyebrow">AI COMPANY SEARCH</span><h1>选择你的 AI 企业搜索方式</h1><p>可把结构化任务交给正在使用的 AI 编程助手，也可在桌面版接入用户自己的联网 AI 接口；结果统一回到本地核验。</p></div><div className="hero-stats"><div><strong>2 种</strong><span>AI 搜索方式</span></div><div><strong>{companyLeads.length}</strong><span>本地企业线索</span></div><div><strong>本人</strong><span>确认与投递</span></div></div></section>
    <div className="coverage-note"><b>用户自选 AI</b><span>默认使用无需密钥的外部任务文件；Windows 桌面版可调用用户选择的 Claude、OpenAI、千问、豆包等 AI 接口。只有模型本身支持实时联网时才能直接搜索，遇到登录或验证则停止并返回官方链接。</span></div>
    <section className="filter-card company-radar-filter"><div className="filter-row company-search-grid"><label><span>① 省份（必选）</span><select value={province} onChange={(e) => { setProvince(e.target.value); setCity(''); setSearchedCity(''); setSearchPlan([]); setOfficialJobs([]); setSourceReports([]); }}><option value="">请选择省份</option>{CHINA_PROVINCES.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label><span>② 城市（跟随省份）</span><select value={city} disabled={!province} onChange={(e) => { setCity(e.target.value); setSearchedCity(''); }}><option value="">{province ? `请选择${province}的城市` : '请先选择省份'}</option>{cityOptions.map((item) => <option value={item} key={item}>{item}</option>)}</select><small className="linked-field-hint">{province ? `当前只显示${province}下的 ${cityOptions.length} 个地区` : '选择省份后自动加载城市'}</small></label><label><span>招聘类型</span><select value={type} onChange={(e) => setType(e.target.value)}><option>全部类型</option><option>校招</option><option>社招</option><option>实习</option></select></label><label><span>企业或方向</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="可选，如：技术、腾讯" /></label><button className="primary-button" disabled={!province || !city} onClick={searchCompanies}>查询企业</button></div></section>
    {searchedCity ? <>
      <section className="search-workflow"><div><span>1</span><b>搜索公开网页</b><small>根据条件即时生成搜索</small></div><i>›</i><div><span>2</span><b>核验企业官网</b><small>确认城市、批次和日期</small></div><i>›</i><div><span>3</span><b>登录则交给用户</b><small>不绕过验证或账号限制</small></div><i>›</i><div><span>4</span><b>保存 JD 并分析</b><small>用户本人完成投递</small></div></section>
      <div className="section-heading company-results-heading"><div><h2>{province} · {searchedCity}的 AI 搜索结果</h2><span>仅显示已导入或由你保存的企业线索，仍需进入官网核验城市与招聘状态</span></div><div className="source-note"><i>✓</i> {leads.length} 家待核验</div></div>
      {leads.length > 0 && <section className="company-lead-list company-results-saved">{leads.map((lead) => <article key={lead.id}><div className="company-logo big" style={{ background: '#5279b6' }}>{lead.name.slice(0, 2)}</div><div className="lead-company-copy"><div className="lead-title"><h3>{lead.name}</h3><span className={lead.access === '官网可直接查看' ? 'public' : lead.access === '需要登录或验证' ? 'login' : ''}>{lead.access}</span></div><p>{lead.role || '岗位方向待确认'} · {lead.recruitmentType} · {lead.city}</p><small>{lead.notes || '来自你保存的网页搜索结果'}</small><CompanyPublishedJobs jobs={lead.jobs || []} fallbackUrl={lead.officialUrl} /></div><div className="company-radar-actions"><a href={lead.officialUrl} target="_blank" rel="noreferrer">{lead.access === '需要登录或验证' ? '打开网站，由我登录 ↗' : '进入官方招聘网站 ↗'}</a><button onClick={() => setCapturing(leadAsCompany(lead))}>{lead.access === '需要登录或验证' ? '登录后手动录入 JD' : '找到岗位后录入 JD'}</button><button onClick={openCompanies}>查看企业介绍</button><button className="lead-delete" onClick={() => setCompanyLeads((items) => items.filter((item) => item.id !== lead.id))}>删除线索</button></div></article>)}</section>}
      {!leads.length && <div className="empty-state company-results-empty"><b>还没有导入 {searchedCity} 的 AI 搜索结果</b><span>先下载下面的任务交给具备网页搜索能力的 AI 编程助手，完成后再导入结果。</span></div>}
      <section className="agent-search-card"><div><span className="agent-search-icon">AI</span><div><h3>AI 企业与岗位搜索入口</h3><p>{companySearchMode === 'api' ? `当前使用 ${settings.provider}；AI 会返回企业招聘官网，并尽量列出官网中可核验的岗位名称和详情链接。` : <>把任务文件交给具备网页搜索能力的 Codex、Claude Code 或 Cursor，完成后导回 <code>company-search-results.json</code>。</>}</p><button className="agent-settings-link" onClick={openSettings}>选择搜索方式与配置 AI</button></div></div><div className="agent-search-actions">{companySearchMode === 'api' && <button className="primary-button compact" disabled={aiSearching} onClick={searchWithConnectedAI}>{aiSearching ? 'AI 正在搜索…' : connectedSearchReady ? `使用 ${settings.provider} 搜索` : '配置联网 AI 后搜索'}</button>}<button className="secondary-button compact" onClick={exportAgentSearchTask}>下载外部 AI 任务</button><label className="agent-import-button">导入外部 AI 结果<input type="file" accept="application/json,.json" onChange={importAgentSearchResults} /></label></div></section>
      <div className="section-heading company-results-heading common-company-heading"><div><h2>常用企业官方入口</h2><span>以下是预置快捷入口，不代表已经核验这些企业在 {searchedCity} 有岗位</span></div><div className="source-note"><i>i</i> {companies.length} 家快捷入口</div></div>
      <section className="company-radar-list company-results-registered">{companies.map((company) => <article className="company-radar-card" key={company.name}><div className="company-logo big" style={{ background: company.accent }}>{company.logo}</div><div className="company-radar-main"><div><h3>{company.name}</h3><span>常用企业官方入口</span></div><p>{company.industry} · {company.business}</p><div className="tag-list">{company.recruitmentTypes.map((item) => <span key={item}>{item}</span>)}<span>{company.location}</span></div></div><div className="company-radar-actions"><a href={company.officialUrl} target="_blank" rel="noreferrer">进入官方招聘网站 ↗</a><button onClick={() => setCapturing(company)}>找到岗位后录入 JD</button><small>尚未核验“{searchedCity}”是否有开放岗位</small></div></article>)}{!companies.length && <div className="empty-state"><b>没有匹配的常用企业入口</b><span>这不会影响 AI 搜索；可调整企业或方向关键词。</span></div>}</section>
      <details className="more-search-panel"><summary><span><b>搜索更多企业</b><small>当前企业结果不足时，再打开即时网页搜索</small></span><i>⌄</i></summary><div className="more-search-body"><div className="more-search-heading"><p>这些链接用于发现更多公司；找到企业后保存官方招聘地址，它就会出现在上面的企业结果中。</p><button className="secondary-button compact" onClick={() => setLeadEditorOpen(true)}>＋ 录入搜索到的公司</button></div><section className="search-plan-grid">{searchPlan.map((item, index) => <article className="search-plan-card" key={item.title}><div><span>搜索 {index + 1}</span><em>{item.source}</em></div><h3>{item.title}</h3><p>{item.description}</p><code>{item.query}</code><a href={item.url} target="_blank" rel="noreferrer">打开实时搜索结果 ↗</a></article>)}</section></div></details>
      <section className="official-scan-card"><div><span className="scan-icon">检</span><div><h3>检查已登记的公开招聘官网</h3><p>桌面版会尝试从无需登录的企业官网读取公开岗位。遇到登录、验证码、拒绝访问或页面变化时，只保留官网链接并提示你处理。</p></div></div><button className="primary-button compact" disabled={scanning} onClick={scanRegisteredSources}>{scanning ? '正在检查…' : window.jobSecretary ? '检查公开官网' : '桌面版可自动检查'}</button></section>
      {sourceReports.length > 0 && <section className="source-report-list">{sourceReports.map((report) => <article className={report.status === 'ok' ? 'ok' : 'handoff'} key={`${report.company}-${report.source}`}><div><b>{report.company}</b><span>{report.status === 'ok' ? `公开页面可读取 · 找到 ${report.count} 条候选岗位` : '需要用户打开网页核验'}</span>{report.message && <small>{report.message}</small>}</div>{report.url && <a href={report.url} target="_blank" rel="noreferrer">打开官网 ↗</a>}</article>)}</section>}
      {officialJobs.length > 0 && <><div className="section-heading"><div><h2>公开官网候选岗位</h2><span>必须打开原始链接核验岗位是否仍开放</span></div><div className="source-note"><i>✓</i> {officialJobs.length} 条候选</div></div><section className="official-job-list">{officialJobs.map((job) => <article key={job.id}><div><span>{job.company}</span><h3>{job.role}</h3><p>{job.location} · {job.type}</p></div><div><a href={job.officialUrl} target="_blank" rel="noreferrer">核验原岗位 ↗</a><button onClick={() => analyze(job)}>分析已读取 JD</button></div></article>)}</section></>}
    </> : <div className="city-search-placeholder"><span>搜</span><b>填写城市和岗位方向，生成即时搜索方案</b><p>不需要招聘平台账号或地图接口；搜索结果来自你点击时打开的公开网页，最后以企业官网为准。</p></div>}
    {leadEditorOpen && <CompanyLeadModal city={searchedCity} province={province} role={query} recruitmentType={type} close={() => setLeadEditorOpen(false)} save={saveLead} />}
    {capturing && <JobCaptureModal company={capturing} city={searchedCity} close={() => setCapturing(null)} save={(draft) => captureJob(capturing, draft)} />}
  </div>;
}

function CompanyPublishedJobs({ jobs, fallbackUrl }: { jobs: CompanyLeadJob[]; fallbackUrl: string }) {
  return <section className="published-jobs"><header><b>官网当前公开岗位</b><span>{jobs.length ? `${jobs.length} 个已核验名称` : '尚未读取到岗位清单'}</span></header>{jobs.length ? <div className="published-job-list">{jobs.map((job, index) => <a href={job.url} target="_blank" rel="noreferrer" key={`${job.title}-${job.url}-${index}`}><div><b>{job.title}</b><small>{job.city || '城市待核验'} · {job.recruitmentType || '类型待核验'}{job.publishedAt && job.publishedAt !== '未知' ? ` · ${job.publishedAt}` : ''}</small></div><span>岗位详情 ↗</span></a>)}</div> : <p>AI 未可靠读取到岗位名称。<a href={fallbackUrl} target="_blank" rel="noreferrer">前往招聘官网查看最新岗位 ↗</a></p>}</section>;
}

function CompanyLeadModal({ city, province, role, recruitmentType, close, save }: { city: string; province: string; role: string; recruitmentType: string; close: () => void; save: (lead: Omit<CompanyLead, 'id' | 'province' | 'city' | 'foundAt'>) => void }) {
  const [name, setName] = useState(''); const [officialUrl, setOfficialUrl] = useState(''); const [discoveryUrl, setDiscoveryUrl] = useState('');
  const [access, setAccess] = useState<CompanyLead['access']>('待核验'); const [notes, setNotes] = useState('');
  const [roleValue, setRoleValue] = useState(role); const [typeValue, setTypeValue] = useState(recruitmentType === '全部类型' ? '社招' : recruitmentType);
  const canSave = name.trim().length >= 2 && /^https:\/\//i.test(officialUrl.trim());
  return <div className="modal-backdrop" onMouseDown={close}><section className="modal compact-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><span>SAVE COMPANY LEAD</span><h2>保存搜索到的企业</h2></div><button onClick={close}>×</button></header><div className="settings-section"><p>仅保存公开线索和企业官网地址。若页面需要账号、验证码或其他验证，请选择“需要登录或验证”，软件不会继续自动读取。</p><div className="capture-context"><div><span>搜索地区</span><b>{province === '全国' ? city : `${province} · ${city}`}</b></div><div><span>保存位置</span><b>当前设备本地</b></div></div><div className="form-grid"><Field label="企业名称" value={name} onChange={setName} placeholder="例如：某某科技有限公司" /><Field label="岗位方向" value={roleValue} onChange={setRoleValue} placeholder="例如：产品经理" /><label className="field"><span>招聘类型</span><select value={typeValue} onChange={(event) => setTypeValue(event.target.value)}><option>校招</option><option>社招</option><option>实习</option></select></label><label className="field"><span>访问情况</span><select value={access} onChange={(event) => setAccess(event.target.value as CompanyLead['access'])}><option>待核验</option><option>官网可直接查看</option><option>需要登录或验证</option></select></label><Field label="企业招聘官网（必填）" value={officialUrl} onChange={setOfficialUrl} placeholder="https://..." /><Field label="发现页面（可选）" value={discoveryUrl} onChange={setDiscoveryUrl} placeholder="搜索结果或介绍页面链接" /><label className="field full"><span>核验备注</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="例如：官网可直接查看，成都有社招入口；岗位发布日期仍需核对。" /></label></div></div><footer><button className="secondary-button" onClick={close}>取消</button><button className="primary-button compact" disabled={!canSave} onClick={() => save({ name: name.trim(), officialUrl: officialUrl.trim(), discoveryUrl: discoveryUrl.trim(), access, notes: notes.trim(), role: roleValue.trim(), recruitmentType: typeValue })}>保存企业线索</button></footer></section></div>;
}

function JobCaptureModal({ company, city, close, save }: { company: CompanyDirectoryItem; city: string; close: () => void; save: (draft: { role: string; jd: string; officialUrl: string; type: string }) => void }) {
  const [role, setRole] = useState(''); const [jd, setJd] = useState(''); const [officialUrl, setOfficialUrl] = useState(company.officialUrl); const [type, setType] = useState('社招');
  const canSave = role.trim().length >= 2 && jd.trim().length >= 20;
  return <div className="modal-backdrop" onMouseDown={close}><section className="modal compact-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><span>CAPTURE JOB</span><h2>录入官网岗位 JD</h2></div><button onClick={close}>×</button></header><div className="settings-section"><p>从 {company.name} 招聘官网复制岗位名称和完整 JD，保存后会直接进入 AI 顾问。软件不会自动投递。</p><div className="capture-context"><div><span>企业</span><b>{company.name}</b></div><div><span>目标城市</span><b>{city}</b></div></div><div className="form-grid"><Field label="岗位名称" value={role} onChange={setRole} placeholder="例如：产品经理" /><label className="field"><span>招聘类型</span><select value={type} onChange={(event) => setType(event.target.value)}><option>校招</option><option>社招</option><option>实习</option></select></label><Field label="岗位官方链接" value={officialUrl} onChange={setOfficialUrl} placeholder="https://..." /><label className="field full"><span>完整 JD</span><textarea value={jd} onChange={(event) => setJd(event.target.value)} rows={9} placeholder="粘贴岗位职责、任职要求和其他公开信息（至少 20 个字）" /></label></div></div><footer><button className="secondary-button" onClick={close}>取消</button><button className="primary-button compact" disabled={!canSave} onClick={() => save({ role, jd, officialUrl, type })}>保存并分析 JD</button></footer></section></div>;
}

const RESUME_TEMPLATES: { id: ResumeTemplate; name: string; description: string }[] = [
  { id: 'english_black', name: '标准黑白英文', description: '黑白英文版式，适合英文或双语简历' },
  { id: 'marketing_table', name: '市场专员', description: '表格式信息区，正式清晰' },
  { id: 'marketing_intern', name: '市场实习生', description: '清新分区，适合校招和实习' },
  { id: 'minimal', name: '极简留白', description: '克制轻量，适合内容较多' },
];

function selectedResumeTemplate(value?: string): ResumeTemplate {
  return RESUME_TEMPLATES.some((item) => item.id === value) ? value as ResumeTemplate : 'marketing_table';
}

function resumeCompletion(resume: Resume) {
  const fields = [resume.name, resume.phone, resume.email, resume.city, resume.targetRole, resume.photoDataUrl, resume.summary, resume.education, resume.experience, resume.projects, resume.skills];
  return Math.round(fields.filter(Boolean).length / fields.length * 100);
}

function prepareResumePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('请选择 JPG、PNG 或 WebP 图片')); return; }
    if (file.size > 10 * 1024 * 1024) { reject(new Error('图片不能超过 10 MB')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('无法识别这张图片'));
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 600; canvas.height = 800;
        const sourceRatio = image.naturalWidth / image.naturalHeight;
        const targetRatio = 3 / 4;
        let sx = 0; let sy = 0; let sw = image.naturalWidth; let sh = image.naturalHeight;
        if (sourceRatio > targetRatio) { sw = image.naturalHeight * targetRatio; sx = (image.naturalWidth - sw) / 2; }
        else { sh = image.naturalWidth / targetRatio; sy = (image.naturalHeight - sh) / 2; }
        const context = canvas.getContext('2d');
        if (!context) { reject(new Error('图片处理失败')); return; }
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, 600, 800);
        context.drawImage(image, sx, sy, sw, sh, 0, 0, 600, 800);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function escapeResumeHtml(value: string) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

function browserResumeDocument(resume: Resume) {
  const template = selectedResumeTemplate(resume.template);
  const accent = template === 'english_black' ? '#20252d' : template === 'marketing_intern' ? '#147e89' : template === 'minimal' ? '#4b5563' : '#2d5e82';
  const section = (title: string, value: string) => `<section><h2>${title}</h2><p>${escapeResumeHtml(value || '—').replace(/\n/g, '<br>')}</p></section>`;
  const photo = resume.photoDataUrl ? `<img src="${escapeResumeHtml(resume.photoDataUrl)}" alt="简历照片">` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font:10.5pt/1.65 "Microsoft YaHei",sans-serif;color:#303b4d}.header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${accent};padding-bottom:12px}.header h1{margin:0;color:${accent}}.header p{margin:4px 0}.header img{width:30mm;height:40mm;object-fit:cover}h2{font-size:12pt;color:${accent};border-bottom:1px solid #d7dde6;padding-bottom:4px}section p{white-space:normal;margin:0}</style></head><body class="${template}"><div class="header"><div><h1>${escapeResumeHtml(resume.name || '个人简历')}</h1><p>${escapeResumeHtml(resume.targetRole || '求职者')}</p><p>${[resume.phone, resume.email, resume.city].filter(Boolean).map(escapeResumeHtml).join(' · ')}</p></div>${photo}</div>${section('求职目标', resume.targetRole)}${section('个人优势', resume.summary)}${section('教育经历', resume.education)}${section('工作经历', resume.experience)}${section('项目经历', resume.projects)}${section('专业技能', resume.skills)}</body></html>`;
}

function ResumeSection({ resume, setResume, notify }: { resume: Resume; setResume: Dispatch<SetStateAction<Resume>>; notify: (m: string) => void }) {
  const template = selectedResumeTemplate(resume.template);
  const completion = resumeCompletion(resume);
  const update = (field: keyof Resume, value: string) => setResume((item) => ({ ...item, [field]: value }));
  async function importDocx() {
    if (!window.jobSecretary) { notify('请在求职秘书桌面版中导入 DOCX'); return; }
    const result = await window.jobSecretary.documents.importDocx();
    if (result.canceled) return;
    update('importedFile', result.name || '已导入简历.docx');
    if (result.text && !resume.summary && !resume.experience) update('summary', result.text);
    notify('DOCX 正文已读取，请检查并拆分到对应栏目');
  }
  async function uploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      const photoDataUrl = await prepareResumePhoto(file);
      setResume((item) => ({ ...item, photoDataUrl, photoName: file.name }));
      notify('照片已裁切为 3:4 并保存在本机');
    } catch (error) { notify(error instanceof Error ? error.message : '照片处理失败'); }
  }
  async function exportDoc() {
    if (window.jobSecretary) {
      const result = await window.jobSecretary.documents.exportDocx({ ...resume, template });
      if (!result.canceled) notify(`已导出“${RESUME_TEMPLATES.find((item) => item.id === template)?.name}”DOCX 简历`);
      return;
    }
    downloadFile(`${resume.name || '我的简历'}.doc`, browserResumeDocument({ ...resume, template }), 'application/msword;charset=utf-8');
    notify('已导出带照片的 Word 兼容文档');
  }
  const navItems = [
    ['resume-style', '样式与照片'], ['resume-0', '基本信息'], ['resume-1', '个人优势'], ['resume-2', '教育经历'],
    ['resume-3', '工作经历'], ['resume-4', '项目经历'], ['resume-5', '专业技能'],
  ];
  return <div className="page-content"><PageIntro section="resume" action={<div className="button-cluster"><button className="secondary-button" onClick={importDocx}>导入 DOCX</button><button className="secondary-button" onClick={() => window.print()}>导出 PDF</button><button className="primary-button compact" onClick={exportDoc}>导出 DOCX</button></div>} />
    <div className="resume-layout"><aside className="resume-nav-card">{resume.photoDataUrl ? <img className="profile-photo" src={resume.photoDataUrl} alt="简历照片预览" /> : <div className="profile-orb">{resume.name ? resume.name.slice(0, 1) : '你'}</div>}<strong>{resume.name || '填写你的姓名'}</strong><span>{resume.targetRole || '未设置求职目标'}</span><div className="completeness"><div><b>简历完整度</b><em>{completion}%</em></div><i><span style={{ width: `${completion}%` }} /></i></div>{navItems.map(([id, item], index) => <a href={`#${id}`} key={id}>{index + 1}<span>{item}</span></a>)}</aside>
      <section className="resume-editor"><ResumeBlock id="resume-style" title="样式与照片" hint="导出 DOCX 和 PDF 时同步生效"><div className="template-data-note"><b>模板中的示例资料不会导出</b><span>姓名、联系方式、教育、工作经历、项目经历、技能和照片，都以你在本页填写的内容替换；没有填写的项目会留空。</span></div><div className="template-picker">{RESUME_TEMPLATES.map((item) => <button type="button" key={item.id} className={template === item.id ? 'active' : ''} aria-pressed={template === item.id} onClick={() => update('template', item.id)}><span className={`template-thumbnail ${item.id}`}><i /><i /><i /></span><b>{item.name}</b><small>{item.description}</small>{template === item.id && <em>已选择</em>}</button>)}</div><div className="resume-photo-control"><div className="photo-preview">{resume.photoDataUrl ? <img src={resume.photoDataUrl} alt="上传的简历照片" /> : <span><b>3:4</b>照片预览</span>}</div><div><h3>简历照片</h3><p>支持 JPG、PNG、WebP，最大 10 MB；软件会在本机裁切并压缩为 3:4。</p><div className="photo-actions"><label className="secondary-button photo-upload">{resume.photoDataUrl ? '更换照片' : '上传照片'}<input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={uploadPhoto} /></label>{resume.photoDataUrl && <button type="button" className="text-danger-button" onClick={() => setResume((item) => ({ ...item, photoDataUrl: '', photoName: '' }))}>删除照片</button>}</div><small>{resume.photoDataUrl ? `已选择：${resume.photoName || '简历照片'}；导出时会替换模板中的示例照片。` : '尚未上传；导出时会清除模板中的示例照片。照片仅保存在本机。'}</small></div></div></ResumeBlock>
      <ResumeBlock id="resume-0" title="基本信息" hint="建议保持联系方式准确"><div className="form-grid"><Field label="姓名" value={resume.name} onChange={(v) => update('name', v)} placeholder="你的姓名" /><Field label="目标职位" value={resume.targetRole} onChange={(v) => update('targetRole', v)} placeholder="如：产品经理" /><Field label="手机" value={resume.phone} onChange={(v) => update('phone', v)} placeholder="手机号" /><Field label="邮箱" value={resume.email} onChange={(v) => update('email', v)} placeholder="常用邮箱" /><Field label="所在城市" value={resume.city} onChange={(v) => update('city', v)} placeholder="如：上海" /></div>{resume.importedFile && <p className="import-note">已导入：{resume.importedFile}。正文已读取，请逐项核对后保存。</p>}</ResumeBlock>
      <ResumeBlock id="resume-1" title="个人优势" hint="用 3—5 句话总结你的价值"><TextField value={resume.summary} onChange={(v) => update('summary', v)} placeholder="例如：3 年互联网产品经验，熟悉用户研究和数据分析……" /></ResumeBlock>
      <ResumeBlock id="resume-2" title="教育经历"><TextField value={resume.education} onChange={(v) => update('education', v)} placeholder="学校、专业、学历、时间，以及与岗位有关的课程或成果" /></ResumeBlock>
      <ResumeBlock id="resume-3" title="工作经历" hint="尽量写清你的行动与量化结果"><TextField value={resume.experience} onChange={(v) => update('experience', v)} placeholder="公司｜职位｜时间\n负责……通过……最终使……" /></ResumeBlock>
      <ResumeBlock id="resume-4" title="项目经历" hint="推荐使用 STAR 或问题拆解结构"><TextField value={resume.projects} onChange={(v) => update('projects', v)} placeholder="项目背景、你的任务、采取的行动和最终结果" /></ResumeBlock>
      <ResumeBlock id="resume-5" title="专业技能"><TextField value={resume.skills} onChange={(v) => update('skills', v)} placeholder="用逗号分隔，例如：SQL、Axure、英语 CET-6" /></ResumeBlock>
      <div className="local-save"><span>✓ 所有修改、照片和模板选择已自动保存到{window.jobSecretary ? '电脑本地私有数据文件' : '当前浏览器本地空间'}</span><button onClick={() => notify('简历已保存')}>立即保存</button></div></section></div>
    <ResumePrintPreview resume={{ ...resume, template }} />
  </div>;
}

function ResumePrintPreview({ resume }: { resume: Resume }) {
  const sections = [['求职目标', resume.targetRole], ['个人优势', resume.summary], ['教育经历', resume.education], ['工作经历', resume.experience], ['项目经历', resume.projects], ['专业技能', resume.skills]];
  return <article className={`resume-print-sheet template-${selectedResumeTemplate(resume.template)}`}><header><div><h1>{resume.name || '个人简历'}</h1><b>{resume.targetRole || '求职者'}</b><p>{[resume.phone, resume.email, resume.city].filter(Boolean).join(' · ') || '请补充联系方式'}</p></div>{resume.photoDataUrl && <img src={resume.photoDataUrl} alt="简历照片" />}</header>{sections.map(([title, value]) => <section key={title}><h2>{title}</h2><p>{value || '—'}</p></section>)}</article>;
}

function ResumeBlock({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) { return <section className="editor-card" id={id}><div className="editor-heading"><h2>{title}</h2>{hint && <span>{hint}</span>}</div>{children}</section>; }
function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) { return <label className="field"><span>{label}</span><input type={type} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>; }
function TextField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) { return <textarea className="large-textarea" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={5} />; }

function CompaniesSection({ targetRole, companyLeads, searchContext, openSubmit }: { targetRole: string; companyLeads: CompanyLead[]; searchContext: RadarContext | null; openSubmit: () => void }) {
  const [funding, setFunding] = useState('全部阶段'); const [location, setLocation] = useState('全国');
  const roleKeyword = targetRole.includes('数据') ? '数据' : targetRole.includes('运营') ? '运营' : targetRole.includes('技术') || targetRole.includes('开发') ? '技术' : '产品';
  const liveCompanies = searchContext ? companyLeads.filter((lead) => lead.city === searchContext.city).map(leadAsCompany) : [];
  const sourceCompanies = liveCompanies.length ? liveCompanies : COMPANIES;
  const sorted = [...sourceCompanies].sort((a, b) => Number(Boolean(b.jobs?.length)) - Number(Boolean(a.jobs?.length)) || Number(b.roles.includes(roleKeyword)) - Number(a.roles.includes(roleKeyword))).filter((item) => (funding === '全部阶段' || item.funding === funding) && (location === '全国' || item.location.includes(location)));
  const heading = liveCompanies.length && searchContext ? `${searchContext.province} · ${searchContext.city}招聘企业` : '主流企业介绍示例';
  return <div className="page-content"><PageIntro section="companies" action={<button className="secondary-button" onClick={openSubmit}>＋ 添加企业招聘官网</button>} />
    <div className="company-source-note"><b>{liveCompanies.length ? '已与岗位雷达联动' : '信息来源说明'}</b><span>{liveCompanies.length && searchContext ? `优先展示岗位雷达在 ${searchContext.city} 搜索并保存的企业；岗位名称和链接来自联网 AI 的公开官网核验结果，企业规模、融资和详细介绍仍需通过官网、公告或年报补充。` : '当前暂无岗位雷达搜索结果，因此显示主流企业原型示例；公司规模、地点、融资情况等信息必须通过企业官网、公告或年报核验。'}</span></div>
    <div className="company-toolbar"><div><b>{heading}</b><span>{searchContext?.role || targetRole || '尚未设置岗位方向'}</span></div><label>融资情况<select value={funding} onChange={(e) => setFunding(e.target.value)}><option>全部阶段</option><option>已上市</option><option>未上市</option><option>待核验</option></select></label><label>地理位置<select value={location} onChange={(e) => setLocation(e.target.value)}><option>全国</option>{searchContext?.city && !['北京', '深圳'].includes(searchContext.city) && <option>{searchContext.city}</option>}<option>北京</option><option>深圳</option></select></label></div>
    <section className="company-grid">{sorted.map((company) => <article className={`company-card ${company.liveResult ? 'live-company-card' : ''}`} key={`${company.name}-${company.officialUrl}`}><div className="company-card-head"><div className="company-logo big" style={{ background: company.accent }}>{company.logo}</div><div><h2>{company.name}</h2><p>{company.industry}</p></div><span className={`verified ${company.liveResult && !company.jobs?.length ? 'pending' : ''}`}>{company.liveResult ? company.jobs?.length ? '岗位已核验' : '官网待核验' : '介绍示例'}</span></div><p className="business-copy">{company.business}</p><dl><div><dt>团队规模</dt><dd>{company.size}</dd></div><div><dt>主要地点</dt><dd>{company.location}</dd></div><div><dt>融资情况</dt><dd>{company.funding}</dd></div></dl><div className="role-match"><span>与你匹配的方向</span>{company.roles.map((role) => <b className={role === roleKeyword ? 'matched' : ''} key={role}>{role}</b>)}</div>{company.liveResult && <CompanyPublishedJobs jobs={company.jobs || []} fallbackUrl={company.officialUrl} />}<a href={company.officialUrl} target="_blank" rel="noreferrer">查看企业招聘官网 ↗</a><small>{company.liveResult ? '来自岗位雷达本地结果，请打开原始官网再次核验' : '以上介绍为原型示例，使用前请通过企业官网或公告核验'}</small></article>)}</section>
    {!sorted.length && <div className="empty-state"><b>当前筛选下没有企业</b><span>返回岗位雷达重新搜索，或清除融资与地区筛选。</span></div>}
  </div>;
}

function RecordsSection({ records, setRecords, notify }: { records: RecordItem[]; setRecords: Dispatch<SetStateAction<RecordItem[]>>; notify: (m: string) => void }) {
  const statuses = RECORD_STATUSES; const [filter, setFilter] = useState('全部'); const [editing, setEditing] = useState<RecordItem | null>(null);
  const shown = filter === '全部' ? records : records.filter((item) => item.status === filter);
  const submitted = records.filter((item) => !['已收藏', '准备投递'].includes(item.status)).length;
  const due = records.filter((item) => item.reminderDate && item.reminderDate <= todayKey() && !['已录用', '已结束'].includes(item.status));
  function saveRecord(record: RecordItem) {
    setRecords((items) => items.some((item) => item.id === record.id) ? items.map((item) => item.id === record.id ? record : item) : [record, ...items]);
    setEditing(null); notify('求职记录已保存');
  }
  return <div className="page-content"><PageIntro section="records" />
    {due.length > 0 && <section className="reminder-banner"><b>今天有 {due.length} 项需要跟进</b><span>{due.slice(0, 3).map((item) => `${item.company} · ${item.status}`).join('；')}</span></section>}
    <section className="record-stats">{[{ label: '全部记录', value: records.length, tone: 'blue' }, { label: '确认已投递', value: submitted, tone: 'violet' }, { label: '今天需跟进', value: due.length, tone: 'orange' }, { label: '已录用', value: records.filter((i) => i.status === '已录用').length, tone: 'green' }].map((stat) => <div key={stat.label} className={`stat-card ${stat.tone}`}><span>{stat.label}</span><strong>{stat.value}</strong><i /></div>)}</section>
    <section className="records-card"><div className="records-toolbar"><div className="status-tabs">{['全部', ...statuses].map((status) => <button className={filter === status ? 'active' : ''} key={status} onClick={() => setFilter(status)}>{status}</button>)}</div><button className="secondary-button compact" onClick={() => setEditing({ id: Date.now(), company: '', role: '', status: '已收藏', date: todayKey(), officialUrl: '#', reminderDate: '', notes: '', updatedAt: new Date().toISOString() })}>＋ 新增记录</button></div>
      <div className="record-table"><div className="record-row table-head"><span>公司与岗位</span><span>记录日期</span><span>当前状态</span><span>下次提醒</span><span>官网进度</span><span>操作</span></div>{shown.map((record) => <div className={`record-row ${record.reminderDate && record.reminderDate <= todayKey() && !['已录用', '已结束'].includes(record.status) ? 'reminder-due' : ''}`} key={record.id}><div><b>{record.company}</b><small>{record.role}{record.notes ? ` · ${record.notes}` : ''}</small></div><span>{record.date}</span><select value={record.status} onChange={(e) => setRecords((items) => items.map((item) => item.id === record.id ? { ...item, status: e.target.value, updatedAt: new Date().toISOString() } : item))}>{statuses.map((s) => <option key={s}>{s}</option>)}</select><span>{record.reminderDate || '未设置'}</span>{record.officialUrl === '#' ? <button className="disabled-link" onClick={() => notify('请编辑记录并填写企业官网链接')}>未配置</button> : <a href={record.officialUrl} target="_blank" rel="noreferrer">打开官网 ↗</a>}<div className="record-actions"><button onClick={() => setEditing(record)}>编辑</button><button className="delete-text" onClick={() => setRecords((items) => items.filter((item) => item.id !== record.id))}>删除</button></div></div>)}</div>
      {!shown.length && <div className="empty-state"><b>这个阶段还没有记录</b><span>从岗位雷达把感兴趣的岗位加入进来吧</span></div>}
    </section>
    <p className="manual-progress-note">官网投递进展默认由你手动更新。软件不会登录招聘账号或抓取私人进度；后续可增加由用户主动导入招聘邮件的辅助识别。</p>
    {editing && <RecordEditorModal record={editing} close={() => setEditing(null)} save={saveRecord} notify={notify} />}
  </div>;
}

function RecordEditorModal({ record, close, save, notify }: { record: RecordItem; close: () => void; save: (record: RecordItem) => void; notify: (m: string) => void }) {
  const [draft, setDraft] = useState(record);
  const update = (field: keyof RecordItem, value: string) => setDraft((item) => ({ ...item, [field]: value }));
  function submit() {
    if (!draft.company.trim() || !draft.role.trim()) { notify('请填写企业和岗位名称'); return; }
    if (draft.officialUrl && draft.officialUrl !== '#') {
      try { const url = new URL(draft.officialUrl); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); }
      catch { notify('官网链接格式不正确'); return; }
    }
    save({ ...draft, company: draft.company.trim(), role: draft.role.trim(), officialUrl: draft.officialUrl.trim() || '#', updatedAt: new Date().toISOString() });
  }
  return <div className="modal-backdrop" onMouseDown={close}><section className="modal compact-modal" onMouseDown={(e) => e.stopPropagation()}><header><div><span>APPLICATION TRACKER</span><h2>填写求职记录</h2></div><button onClick={close}>×</button></header><div className="settings-section"><div className="form-grid"><Field label="企业名称" value={draft.company} onChange={(v) => update('company', v)} placeholder="例如：某某科技" /><Field label="岗位名称" value={draft.role} onChange={(v) => update('role', v)} placeholder="例如：产品经理" /><Field label="记录 / 投递日期" type="date" value={draft.date} onChange={(v) => update('date', v)} placeholder="" /><label className="field"><span>当前阶段</span><select value={draft.status} onChange={(e) => update('status', e.target.value)}>{RECORD_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label><Field label="下次提醒日期" type="date" value={draft.reminderDate || ''} onChange={(v) => update('reminderDate', v)} placeholder="" /><Field label="官方岗位链接" value={draft.officialUrl === '#' ? '' : draft.officialUrl} onChange={(v) => update('officialUrl', v)} placeholder="https://..." /><label className="field full"><span>备注</span><textarea value={draft.notes || ''} onChange={(e) => update('notes', e.target.value)} placeholder="例如：等待测评邮件；下周三前准备作品集" rows={4} /></label></div></div><footer><button className="secondary-button" onClick={close}>取消</button><button className="primary-button compact" onClick={submit}>保存记录</button></footer></section></div>;
}

function AdvisorSection({ resume, records, setRecords, selectedJob, settings, openSettings, notify }: { resume: Resume; records: RecordItem[]; setRecords: Dispatch<SetStateAction<RecordItem[]>>; selectedJob: Job | null; settings: Settings; openSettings: () => void; notify: (m: string) => void }) {
  const [advisorTab, setAdvisorTab] = useStoredState<'recommendation' | 'interview' | 'resume'>('qs-advisor-tab', 'recommendation');
  const [daily, setDaily] = useStoredState<{ date: string; questions: string[] }>('qs-daily-questions', { date: '', questions: [] });
  const [star, setStar] = useStoredState('qs-star-mode', true); const [caseMode, setCaseMode] = useStoredState('qs-case-mode', true); const [answers, setAnswers] = useStoredState<string[]>('qs-daily-answers', ['', '', '']); const [analysis, setAnalysis] = useState<string[]>([]);
  const [versions, setVersions] = useStoredState<ResumeVersion[]>('qs-resume-versions', []); const [draft, setDraft] = useState<Resume | null>(null); const [draftVersionId, setDraftVersionId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false); const [analyzingIndex, setAnalyzingIndex] = useState<number | null>(null); const [feedback, setFeedback] = useState(''); const [feedbackLoading, setFeedbackLoading] = useState(false);
  const role = selectedJob?.role || resume.targetRole || records[0]?.role || '通用岗位'; const usedToday = daily.date === todayKey() && daily.questions.length === 3;
  const aiReady = Boolean(window.jobSecretary && settings.endpoint && settings.model && settings.apiKey);
  const resumeText = `${resume.summary} ${resume.experience} ${resume.projects} ${resume.skills}`;
  const jdText = `${selectedJob?.role || ''} ${selectedJob?.jd || ''}`;
  const beforeEvaluation = useMemo(() => evaluateResume(resume, jdText, role), [jdText, resume, role]);
  const draftEvaluation = useMemo(() => draft ? evaluateResume(draft, jdText, role) : null, [draft, jdText, role]);
  const jdKeywords = beforeEvaluation.jdKeywords; const matchedKeywords = beforeEvaluation.matchedKeywords; const missingKeywords = beforeEvaluation.missingKeywords;
  const fitLabel = !selectedJob ? '待选择岗位' : jdKeywords.length === 0 ? '需要人工复核' : matchedKeywords.length / jdKeywords.length >= .65 ? '高匹配' : matchedKeywords.length / jdKeywords.length >= .35 ? '中匹配' : '可尝试';
  const selectedVersions = selectedJob ? versions.filter((item) => item.jobId === selectedJob.id).sort((a, b) => b.id - a.id) : [];
  const currentVersion = draftVersionId ? versions.find((item) => item.id === draftVersionId) || null : selectedVersions[0] || null;
  useEffect(() => {
    const latest = selectedJob ? versions.filter((item) => item.jobId === selectedJob.id).sort((a, b) => b.id - a.id)[0] : null;
    setDraft(latest?.resume || null); setDraftVersionId(latest?.id || null);
  }, [selectedJob?.id, versions]);

  function generateTailoredDraft() {
    if (!selectedJob) { notify('请先从岗位雷达选择一份岗位'); return; }
    const tailored = tailorResume(resume, jdText, role) as Resume;
    const id = Date.now(); const after = evaluateResume(tailored, jdText, role);
    const version: ResumeVersion = { id, jobId: selectedJob.id, company: selectedJob.company, role, officialUrl: selectedJob.officialUrl, createdAt: new Date().toISOString(), resume: tailored, before: beforeEvaluation, after };
    setVersions((items) => [version, ...items]); setDraft(tailored); setDraftVersionId(id);
    notify('已生成岗位定制副本，主简历没有被修改');
  }
  function updateDraft(field: keyof Resume, value: string) { setDraft((item) => item ? { ...item, [field]: value } : item); }
  function saveDraft(approved = false) {
    if (!draft || !selectedJob) { notify('请先生成定制简历副本'); return null; }
    const id = draftVersionId || Date.now(); const updated: ResumeVersion = { id, jobId: selectedJob.id, company: selectedJob.company, role, officialUrl: selectedJob.officialUrl, createdAt: currentVersion?.createdAt || new Date().toISOString(), resume: draft, before: beforeEvaluation, after: evaluateResume(draft, jdText, role), approvedAt: approved ? new Date().toISOString() : currentVersion?.approvedAt };
    setVersions((items) => items.some((item) => item.id === id) ? items.map((item) => item.id === id ? updated : item) : [updated, ...items]); setDraftVersionId(id);
    return updated;
  }
  async function exportTailored() {
    if (!draft || !window.jobSecretary) { notify('请在桌面版中生成定制简历后导出'); return; }
    const result = await window.jobSecretary.documents.exportDocx({ ...draft, name: `${draft.name || '我的简历'}-${selectedJob?.company || ''}-${role}` });
    if (!result.canceled) notify('岗位定制 DOCX 已导出');
  }
  async function approveAndOpen() {
    const saved = saveDraft(true); if (!saved || !selectedJob) return;
    setRecords((items) => {
      const existing = items.find((item) => item.company === selectedJob.company && item.role === selectedJob.role);
      if (existing) return items.map((item) => item.id === existing.id ? { ...item, status: '准备投递', officialUrl: selectedJob.officialUrl, updatedAt: new Date().toISOString() } : item);
      return [{ id: Date.now(), company: selectedJob.company, role: selectedJob.role, status: '准备投递', date: todayKey(), officialUrl: selectedJob.officialUrl, reminderDate: '', notes: '定制简历已确认，等待本人官网投递', updatedAt: new Date().toISOString() }, ...items];
    });
    notify('定制简历已确认，正在打开企业官网');
    if (window.jobSecretary) await window.jobSecretary.system.openExternal(selectedJob.officialUrl); else window.open(selectedJob.officialUrl, '_blank', 'noopener,noreferrer');
  }
  function markSubmitted() {
    if (!selectedJob) return;
    setRecords((items) => {
      const existing = items.find((item) => item.company === selectedJob.company && item.role === selectedJob.role);
      if (existing) return items.map((item) => item.id === existing.id ? { ...item, status: '已投递', date: todayKey(), notes: '用户已确认完成官网投递', updatedAt: new Date().toISOString() } : item);
      return [{ id: Date.now(), company: selectedJob.company, role: selectedJob.role, status: '已投递', date: todayKey(), officialUrl: selectedJob.officialUrl, notes: '用户已确认完成官网投递', updatedAt: new Date().toISOString() }, ...items];
    });
    notify('已按你的确认计入投递记录');
  }
  async function generateQuestions() {
    if (usedToday) { notify('今天已经生成过 3 道题，明天再来练习'); return; }
    setGenerating(true);
    try {
      let questions: string[];
      if (aiReady && window.jobSecretary) {
        const result = await window.jobSecretary.advisor.run('questions', { role, jd: selectedJob?.jd || '' });
        questions = result.questions || [];
        if (questions.length !== 3) throw new Error('AI 未返回恰好 3 道题');
      } else {
        questions = role.includes('产品') ? ['请分享一个你发现用户问题并推动解决的案例。', '如果核心指标突然下降 20%，你会如何拆分和研究问题？', '请设计一个提升新用户次日留存的方案，并说明如何验证结果。'] : role.includes('数据') ? ['请讲一次你用数据发现并解决业务问题的经历。', '遇到口径不一致的数据，你会如何排查并推动统一？', '如何向非技术团队解释一个反直觉的数据结论？'] : [`为什么你适合${role}，请用具体经历说明？`, '请讲一次你面对困难目标并最终取得结果的经历。', '如果入职后第一个月没有明确任务，你会如何开展工作？'];
      }
      setDaily({ date: todayKey(), questions }); setAnswers(['', '', '']); setAnalysis([]); notify(aiReady ? 'AI 已生成今日 3 道面试题' : '本地题库已生成今日 3 道题');
    } catch (error) { notify(error instanceof Error ? error.message : '面试题生成失败'); }
    finally { setGenerating(false); }
  }
  async function analyze(index: number) {
    const answer = answers[index]?.trim(); if (!answer) { notify('请先填写回答'); return; }
    setAnalyzingIndex(index);
    try {
      let text: string;
      if (aiReady && window.jobSecretary) {
        const result = await window.jobSecretary.advisor.run('answer-analysis', { role, question: daily.questions[index], answer, star, caseMode });
        text = result.text || 'AI 没有返回分析内容';
      } else {
        const tips = [`结构清晰度：${answer.length > 120 ? '较完整' : '还可以补充背景、行动和结果'}`, star ? 'STAR 检查：请确认任务、个人行动和量化结果都出现了' : '表达建议：先给结论，再用一段经历佐证', caseMode ? '案例拆解：建议补上“发现问题—拆分—研究—解决—结果”链路' : '岗位关联：最后一句可明确说明这段经验如何迁移到目标岗位']; text = tips.join('；');
      }
      setAnalysis((items) => { const next = [...items]; next[index] = text; return next; });
    } catch (error) { notify(error instanceof Error ? error.message : '回答分析失败'); }
    finally { setAnalyzingIndex(null); }
  }
  async function requestResumeFeedback() {
    if (!selectedJob) { notify('请先从岗位雷达选择一份岗位'); return; }
    if (!aiReady || !window.jobSecretary) { notify('请先配置完整的 AI 接口、模型和密钥'); openSettings(); return; }
    setFeedbackLoading(true); setFeedback('');
    try {
      const feedbackResume = draft ? `${draft.summary} ${draft.experience} ${draft.projects} ${draft.skills}` : resumeText;
      const result = await window.jobSecretary.advisor.run('resume-feedback', { role, jd: selectedJob.jd || '', resume: feedbackResume });
      setFeedback(result.text || 'AI 没有返回建议');
    } catch (error) { notify(error instanceof Error ? error.message : '简历建议生成失败'); }
    finally { setFeedbackLoading(false); }
  }
  return <div className="page-content"><PageIntro section="advisor" action={<button className="secondary-button" onClick={openSettings}>AI 接入设置</button>} />
    <div className="advisor-status"><span className="ai-orb">AI</span><div><b>{aiReady ? `${settings.provider} 已连接` : window.jobSecretary ? 'AI 服务尚未完整配置' : '在线体验版 · 本地规则模式'}</b><p>{aiReady ? '只有点击生成或分析按钮时，才会把当前题目、回答或所选 JD 发送到你配置的接口。' : window.jobSecretary ? '未配置时仍可使用本地题库和基础规则；联网 AI 需要用户自己的服务凭据。' : '岗位匹配、简历评分和每日题库可以体验；网页不接收 API Key，联网 AI 留给桌面版或安全后端。'}</p></div><button onClick={openSettings}>{window.jobSecretary ? settings.endpoint ? '查看设置' : '立即配置' : '了解接入方式'}</button></div>
    <nav className="advisor-tabbar" aria-label="AI 顾问功能"><button className={advisorTab === 'recommendation' ? 'active' : ''} onClick={() => setAdvisorTab('recommendation')}><span>01</span><b>岗位推荐</b><small>JD 与简历证据匹配</small></button><button className={advisorTab === 'interview' ? 'active' : ''} onClick={() => setAdvisorTab('interview')}><span>02</span><b>每日面试题</b><small>每天 3 题与回答分析</small></button><button className={advisorTab === 'resume' ? 'active' : ''} onClick={() => setAdvisorTab('resume')}><span>03</span><b>定制简历</b><small>独立版本、评分与缺口</small></button></nav>
    <div className="advisor-panel">
    {advisorTab === 'recommendation' && <section className="match-card"><div className="card-title"><div><span>{selectedJob ? `${selectedJob.company} · JD 证据匹配` : '岗位匹配分析'}</span><h2>{role}</h2></div><div className={`fit-badge ${fitLabel === '高匹配' ? 'high' : fitLabel === '中匹配' ? 'medium' : ''}`}>{fitLabel}</div></div><div className="evidence-panel"><div><span>JD 中已识别关键词</span><p>{jdKeywords.length ? jdKeywords.join('、') : '请先从岗位雷达选择一份带有 JD 的岗位'}</p></div><div><span>简历中已有证据</span><p className="evidence-good">{matchedKeywords.length ? matchedKeywords.join('、') : '暂未找到直接证据'}</p></div><div><span>需要补充或核实</span><p className="evidence-missing">{missingKeywords.length ? missingKeywords.join('、') : selectedJob ? '没有明显缺项，仍需人工核对完整 JD' : '待选择岗位'}</p></div></div><div className="advisor-suggestions"><b>优先修改建议</b><p>① 只选用经历库中确实发生过、能够解释清楚的项目。</p><p>② 把与 JD 直接相关的行动提前，并补充真实可验证的结果。</p><p>③ 生成岗位定制副本，不覆盖主简历；最终内容由本人确认。</p></div><button className="secondary-button compact" disabled={feedbackLoading || !selectedJob} onClick={requestResumeFeedback}>{feedbackLoading ? 'AI 正在复核…' : '请 AI 复核简历建议'}</button>{feedback && <div className="ai-feedback"><b>AI 复核结果</b><p>{feedback}</p></div>}</section>}
    {advisorTab === 'interview' && <section className="daily-card"><div className="daily-heading"><div><span>DAILY INTERVIEW</span><h2>每日面试练习</h2><p>围绕“{role}”生成，每天仅一次、共 3 题。</p></div><button className="primary-button compact" disabled={usedToday || generating} onClick={generateQuestions}>{usedToday ? '今日已生成' : generating ? '正在生成…' : '生成今日题目'}</button></div><div className="mode-switches"><label><input type="checkbox" checked={star} onChange={(e) => setStar(e.target.checked)} /><span>STAR 模型</span></label><label><input type="checkbox" checked={caseMode} onChange={(e) => setCaseMode(e.target.checked)} /><span>案例分析结构</span></label></div>{usedToday ? <div className="questions">{daily.questions.map((question, index) => <article key={question}><header><span>{String(index + 1).padStart(2, '0')}</span><b>{question}</b></header><textarea value={answers[index] || ''} onChange={(e) => setAnswers((items) => { const next = [...items]; next[index] = e.target.value; return next; })} placeholder="在这里组织你的回答……" rows={4} /><div><small>{answers[index]?.length || 0} 字</small><button disabled={analyzingIndex === index} onClick={() => analyze(index)}>{analyzingIndex === index ? '分析中…' : '分析回答'}</button></div>{analysis[index] && <p className="answer-analysis"><b>{aiReady ? 'AI 建议：' : '本地基础建议：'}</b>{analysis[index]}</p>}</article>)}</div> : <div className="question-placeholder"><span>3</span><b>今天的面试题还未生成</b><p>点击按钮后，将根据当前求职岗位生成 3 道练习题；没有目标岗位时使用通用题。</p></div>}<p className="ai-disclaimer">未连接 AI 时使用本地题库和结构规则；连接后只在你点击按钮时发送对应内容。</p></section>}
    {advisorTab === 'resume' && (selectedJob ? <section className="tailored-resume-card"><header><div><span>TAILORED RESUME</span><h2>{selectedJob.company} · {role} 定制简历</h2><p>只重排和强调主简历中已经存在的事实；缺失要求会单独提示，不会偷偷补写。</p></div><div className="tailored-header-actions"><small>已保存 {selectedVersions.length} 个版本</small><button className="primary-button compact" onClick={generateTailoredDraft}>{draft ? '重新生成副本' : '生成定制副本'}</button></div></header>{draft && draftEvaluation ? <>
      <div className="score-comparison"><div><span>主简历检查分</span><strong>{beforeEvaluation.total}</strong><small>/ 100</small></div><i>→</i><div className="after"><span>当前定制版</span><strong>{draftEvaluation.total}</strong><small>/ 100</small></div><em className={draftEvaluation.total > beforeEvaluation.total ? 'positive' : ''}>{draftEvaluation.total === beforeEvaluation.total ? '没有新增真实证据，因此总分可能不变' : `变化 ${draftEvaluation.total - beforeEvaluation.total > 0 ? '+' : ''}${draftEvaluation.total - beforeEvaluation.total}`}</em></div>
      <p className="score-disclaimer">这是可解释的简历质量检查分，不是录用概率。重新排序不会凭空提高经历证据分；只有你补充真实、可核实的内容后才会变化。</p>
      <div className="score-components">{draftEvaluation.components.map((component) => <article key={component.label}><div><b>{component.label}</b><span>{component.score} / {component.max}</span></div><i><em style={{ width: `${component.max ? component.score / component.max * 100 : 0}%` }} /></i><p>{component.reason}</p></article>)}</div>
      <div className="tailored-editor"><label><span>定制个人优势</span><textarea value={draft.summary} onChange={(e) => updateDraft('summary', e.target.value)} rows={5} /></label><label><span>定制工作经历</span><textarea value={draft.experience} onChange={(e) => updateDraft('experience', e.target.value)} rows={7} /></label><label><span>定制项目经历</span><textarea value={draft.projects} onChange={(e) => updateDraft('projects', e.target.value)} rows={7} /></label><label><span>技能排序</span><textarea value={draft.skills} onChange={(e) => updateDraft('skills', e.target.value)} rows={4} /></label></div>
      <div className="experience-gap"><div><h3>还缺少哪些岗位证据</h3><p>下面是需要通过真实学习、项目或工作经历补足的内容，不会直接写入简历。</p></div>{draftEvaluation.missingExperienceSuggestions.length ? <div className="gap-list">{draftEvaluation.missingExperienceSuggestions.map((item) => <article key={item.keyword}><b>{item.keyword}</b><span>{item.suggestion}</span></article>)}</div> : <div className="gap-empty">没有识别到明显关键词缺口，仍需打开完整 JD 人工核对。</div>}</div>
      <div className="tailored-footer"><div><button className="secondary-button compact" onClick={() => { if (saveDraft()) notify('定制简历版本已保存'); }}>保存版本</button><button className="secondary-button compact" onClick={exportTailored}>导出定制 DOCX</button></div><div><button className="primary-button compact" onClick={approveAndOpen}>确认简历并打开官网</button>{currentVersion?.approvedAt && <button className="submitted-button" onClick={markSubmitted}>我已完成投递</button>}</div></div>
    </> : <div className="tailored-empty"><span>文</span><b>还没有生成岗位定制副本</b><p>点击“生成定制副本”后，会保存独立版本、给出修改前后评分，并列出仍缺少的真实经历证据。</p></div>}</section> : <section className="tailored-resume-card"><div className="tailored-empty"><span>岗</span><b>请先选择目标岗位</b><p>从岗位雷达点击“分析 JD”，这里才会生成对应岗位的定制简历、评分和经历缺口。</p></div></section>)}
    </div>
  </div>;
}

function SettingsModal({ settings, setSettings, resume, setResume, records, setRecords, close, notify }: { settings: Settings; setSettings: Dispatch<SetStateAction<Settings>>; resume: Resume; setResume: Dispatch<SetStateAction<Resume>>; records: RecordItem[]; setRecords: Dispatch<SetStateAction<RecordItem[]>>; close: () => void; notify: (m: string) => void }) {
  const update = (field: keyof Settings, value: string | boolean) => setSettings((item) => ({ ...item, [field]: value }));
  const desktopMode = Boolean(window.jobSecretary);
  const preset = aiProviderPreset(settings.provider);
  async function backup() {
    if (window.jobSecretary) { const result = await window.jobSecretary.storage.backup(); if (!result.canceled) notify('完整备份已保存'); return; }
    downloadFile(`求职秘书备份-${todayKey()}.json`, JSON.stringify({ version: 1, resume, records, settings: { ...settings, apiKey: '' } }, null, 2), 'application/json'); notify('本地备份已下载');
  }
  async function restore() {
    if (!window.jobSecretary) { notify('请在桌面版中恢复备份'); return; }
    const result = await window.jobSecretary.storage.restore();
    if (!result.canceled) { notify('备份已恢复，重新打开软件后生效'); close(); }
  }
  const searchSection = <div className="settings-section"><h3>AI 企业与岗位搜索</h3><p>默认可把任务交给外部 AI 编程助手；桌面版也能直接调用已配置的模型。只有供应商 API 提供实时网页搜索工具时，软件才会请求当前企业和岗位。</p><div className="form-grid"><label className="field"><span>企业搜索方式</span><select disabled={!desktopMode} value={settings.companySearchMode || 'external'} onChange={(e) => update('companySearchMode', e.target.value)}><option value="external">外部 AI 助手（无需在软件填密钥）</option><option value="api">使用上方 AI API 直接搜索</option></select></label><div className={`provider-capability ${preset.search === 'native' ? 'native' : ''}`}><span>当前供应商联网能力</span><b>{preset.search === 'native' ? '已内置官方联网搜索适配' : '取决于具体模型或代理服务'}</b><small>顾问、简历和面试分析不要求联网。</small></div></div>{settings.companySearchMode === 'api' && preset.search !== 'native' && <label className="check-line"><input type="checkbox" checked={Boolean(settings.webSearchConfirmed)} onChange={(e) => update('webSearchConfirmed', e.target.checked)} />我已确认当前模型或代理接口确实支持实时联网搜索；结果仍由本人打开企业官网核验</label>}</div>;
  return <div className="modal-backdrop" onMouseDown={close}><section className="modal" onMouseDown={(e) => e.stopPropagation()}>
    <header><div><span>SETTINGS</span><h2>设置与数据</h2></div><button onClick={close}>×</button></header>
    <div className="settings-section"><h3>AI 接口（顾问与企业搜索共用）</h3>{desktopMode ? <><p>可接入 Claude、ChatGPT/OpenAI API、通义千问、豆包、Gemini、DeepSeek、Kimi、智谱 GLM、本地 Ollama 及自定义兼容接口。聊天产品会员通常不等于 API 额度，需要在相应开发者平台单独取得 API Key；软件不内置共享密钥。</p><div className="provider-summary"><b>{settings.provider}</b><span>{preset.protocol}</span><em>{preset.search === 'native' ? '支持官方联网搜索工具' : '基础 AI 顾问可用，联网能力需另行确认'}</em></div><div className="form-grid"><label className="field"><span>服务商</span><select value={settings.provider} onChange={(e) => { const provider = e.target.value; const nextPreset = aiProviderPreset(provider); setSettings((item) => ({ ...item, provider, endpoint: nextPreset.endpoint, model: '', apiKey: '', webSearchConfirmed: nextPreset.search === 'native' })); }}>{Object.keys(AI_PROVIDER_PRESETS).map((provider) => <option key={provider}>{provider}</option>)}</select></label><Field label="模型名称" value={settings.model} onChange={(v) => update('model', v)} placeholder={preset.modelHint} /><Field label="接口地址" value={settings.endpoint} onChange={(v) => update('endpoint', v)} placeholder={preset.endpoint || 'https://你的服务商/v1/chat/completions'} /><Field label="API Key" type="password" value={settings.apiKey} onChange={(v) => update('apiKey', v)} placeholder="只用于你主动发起的 AI 请求" /></div>{!settings.endpoint && preset.endpoint && <button className="agent-settings-link" onClick={() => update('endpoint', preset.endpoint)}>填入该供应商默认接口地址</button>}<label className="check-line"><input type="checkbox" checked={settings.rememberKey} onChange={(e) => update('rememberKey', e.target.checked)} />使用当前 Windows 账户加密保存密钥（不勾选则关闭软件后忘记密钥）</label></> : <div className="online-security-note"><b>在线体验版不接收 API Key</b><p>为避免把个人密钥暴露在网页中，这里只使用本地题库与规则分析；多供应商私有密钥接入只在桌面版启用。</p><div className="preview-provider-list">{Object.keys(AI_PROVIDER_PRESETS).filter((name) => !name.startsWith('自定义')).map((name) => <span key={name}>{name}</span>)}</div></div>}</div>
    {searchSection}
    <div className="settings-section"><h3>本地数据</h3><p>没有账号系统；简历、岗位池和投递记录保存在{desktopMode ? '电脑的应用数据目录' : '当前浏览器的本地空间'}，不上传到网站服务器。建议定期备份。</p><div className="button-cluster"><button className="secondary-button" onClick={backup}>导出完整备份</button><button className="secondary-button" disabled={!desktopMode} onClick={restore}>{desktopMode ? '恢复备份' : '恢复备份（桌面版）'}</button></div></div>
    <footer><button className="secondary-button" onClick={close}>取消</button><button className="primary-button compact" onClick={() => { notify('设置已保存'); close(); }}>保存设置</button></footer>
  </section></div>;
}

function SubmissionModal({ close, notify }: { close: () => void; notify: (m: string) => void }) {
  const [submitted, setSubmitted] = useState(false);
  async function saveSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.jobSecretary) { notify('请在桌面版中添加官网源'); return; }
    const form = new FormData(event.currentTarget);
    try {
      await window.jobSecretary.jobs.addSource({ company: String(form.get('company') || ''), name: String(form.get('name') || ''), url: String(form.get('url') || '') });
      setSubmitted(true); notify('企业招聘官网已加入本地来源库');
    } catch (error) { notify(error instanceof Error ? error.message : '官网源保存失败'); }
  }
  return <div className="modal-backdrop" onMouseDown={close}><section className="modal compact-modal" onMouseDown={(e) => e.stopPropagation()}><header><div><span>OFFICIAL SOURCE</span><h2>添加企业招聘官网</h2></div><button onClick={close}>×</button></header>{submitted ? <div className="submitted-state"><span>✓</span><h3>官网源已保存到本地</h3><p>下次点击“扫描企业官网”时会尝试读取该页面。动态招聘网站可能需要后续编写专用适配器。</p><button className="primary-button compact" onClick={close}>完成</button></div> : <form onSubmit={saveSource}><div className="form-grid">
    <label className="field"><span>企业名称</span><input name="company" required placeholder="企业全称" /></label><label className="field"><span>来源名称</span><input name="name" placeholder="例如：某某招聘官网" /></label><label className="field full"><span>官方招聘网址</span><input name="url" required type="url" placeholder="https://..." /></label>
  </div><p className="form-note">只添加企业公开招聘官网，不添加 BOSS 直聘、实习僧等第三方页面。软件不会绕过登录、验证码或反爬限制。</p><footer><button type="button" className="secondary-button" onClick={close}>取消</button><button className="primary-button compact" type="submit">保存官网源</button></footer></form>}</section></div>;
}

const GUIDE_STEPS = [
  { section: 'jobs' as Section, title: '岗位雷达', text: '输入城市查看企业官方招聘入口；最新岗位直接在官网筛选，找到后可把 JD 录入 AI 顾问。' },
  { section: 'resume' as Section, title: '自我简历', text: '本地填写简历，自动保存到电脑的私有数据文件，也能导出和备份。' },
  { section: 'companies' as Section, title: '企业介绍', text: '根据求职方向了解企业业务、规模、地点、融资与开放岗位。' },
  { section: 'records' as Section, title: '求职记录', text: '查看投递总数和每家公司的当前阶段，一键回到企业官网。' },
  { section: 'advisor' as Section, title: 'AI 顾问', text: '查看岗位匹配建议，每天生成一次 3 道面试题并分析回答。' },
];
function GuideOverlay({ step, setStep, close, setActive }: { step: number; setStep: (v: number) => void; close: () => void; setActive: Dispatch<SetStateAction<Section>> }) {
  const item = GUIDE_STEPS[step];
  const [position, setPosition] = useState({ top: 120, left: 274, targetTop: 100, targetLeft: 18, targetWidth: 220, targetHeight: 52 });
  useEffect(() => {
    setActive(item.section);
    function placeGuide() {
      const target = document.querySelector<HTMLElement>(`[data-guide-nav="${item.section}"]`);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const compact = window.innerWidth <= 760;
      const popoverWidth = Math.min(430, window.innerWidth - 40);
      const left = compact ? 20 : Math.min(window.innerWidth - popoverWidth - 20, rect.right + 18);
      const top = compact ? Math.min(window.innerHeight - 275, rect.bottom + 14) : Math.min(window.innerHeight - 275, Math.max(18, rect.top - 14));
      setPosition({ top: Math.max(18, top), left: Math.max(20, left), targetTop: rect.top - 5, targetLeft: rect.left - 5, targetWidth: rect.width + 10, targetHeight: rect.height + 10 });
    }
    const frame = window.requestAnimationFrame(placeGuide);
    window.addEventListener('resize', placeGuide);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('resize', placeGuide); };
  }, [item.section, setActive]);
  return <div className="guide-overlay"><div className="guide-highlight" style={{ top: position.targetTop, left: position.targetLeft, width: position.targetWidth, height: position.targetHeight }} /><section className="guide-popover" style={{ top: position.top, left: position.left }}><span className="guide-count">{step + 1} / {GUIDE_STEPS.length}</span><h2>{item.title}</h2><p>{item.text}</p><div className="guide-dots">{GUIDE_STEPS.map((_, index) => <i className={index === step ? 'active' : ''} key={index} />)}</div><footer><button onClick={close}>跳过</button><div>{step > 0 && <button onClick={() => setStep(step - 1)}>上一步</button>}<button className="primary-button compact" onClick={() => step === GUIDE_STEPS.length - 1 ? close() : setStep(step + 1)}>{step === GUIDE_STEPS.length - 1 ? '开始使用' : '下一步'}</button></div></footer></section></div>;
}
