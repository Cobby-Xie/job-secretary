const fs = require('node:fs');
const path = require('node:path');
const { writeResumeDocx } = require('../desktop/services/resume-documents.cjs');

async function run() {
  const root = path.resolve(__dirname, '..');
  const outputDir = path.join(root, 'qa', 'resume-template-filled');
  const templateRoot = path.join(root, '简历模板');
  fs.mkdirSync(outputDir, { recursive: true });
  const icon = fs.readFileSync(path.join(root, 'resources', '求职秘书-icon.png')).toString('base64');
  const resume = {
    name: '林晓', phone: '138 0000 0000', email: 'linxiao@example.com', city: '上海', targetRole: '产品经理',
    summary: '3 年校园产品与实习项目经验，善于从用户反馈中发现问题，使用数据验证方案，并推动跨团队协作落地。',
    education: '示例大学｜信息管理与信息系统｜本科｜2021.09—2025.06\n主修课程：用户研究、数据库原理、统计学、项目管理',
    experience: '某科技公司｜产品实习生｜2024.03—2024.09\n负责收集和归类 300+ 条用户反馈，拆分注册流程中的关键阻塞点。\n联合设计与研发完成 3 轮迭代，核心流程完成率提升 18%。',
    projects: '校园服务平台｜项目负责人｜2023.10—2024.02\n发现问题：学生办事入口分散，平均需要跳转 4 次。\n拆分研究：完成 26 次访谈和 320 份问卷，梳理高频服务路径。\n解决结果：设计统一入口并组织灰度测试，上线后覆盖 2,000 名用户，任务耗时下降 31%。',
    skills: '产品：Axure、Figma、需求文档、用户研究\n数据：SQL、Excel、基础 Python\n语言：英语 CET-6',
    photoDataUrl: `data:image/png;base64,${icon}`,
  };
  for (const template of ['english_black', 'marketing_table', 'marketing_intern']) {
    await writeResumeDocx(path.join(outputDir, `${template}.docx`), { ...resume, template }, { templateRoot });
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
