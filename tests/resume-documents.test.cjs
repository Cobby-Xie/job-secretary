const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const { TEMPLATE_THEMES, writeResumeDocx } = require('../desktop/services/resume-documents.cjs');

const samplePhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/69x7WQAAAABJRU5ErkJggg==';
const samplePhotoBytes = Buffer.from(samplePhoto.split(',')[1], 'base64');
const blankPhotoBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const sampleResume = {
  name: '林晓', phone: '138 0000 0000', email: 'linxiao@example.com', city: '上海', targetRole: '产品经理',
  summary: '关注用户价值与业务结果，能够完成从问题发现到方案落地的完整闭环。',
  education: '示例大学｜信息管理与信息系统｜本科｜2021—2025',
  experience: '某科技公司｜产品实习生｜2024.03—2024.09\n梳理用户反馈并推动版本优化，核心流程完成率提升 18%。',
  projects: '校园服务平台｜项目负责人\n拆分需求、验证方案并组织迭代，上线后覆盖 2,000 名用户。',
  skills: 'Axure、Figma、SQL、数据分析、英语 CET-6',
  photoDataUrl: samplePhoto,
};

test('四种模板都能用用户资料生成 DOCX，且不保留模板示例信息', async () => {
  const tempDir = path.join(process.cwd(), 'tests', '.resume-docx-test');
  const templateRoot = path.join(process.cwd(), '简历模板');
  fs.mkdirSync(tempDir, { recursive: true });
  const created = [];
  try {
    for (const template of Object.keys(TEMPLATE_THEMES)) {
      const output = path.join(tempDir, `${template}.docx`); created.push(output);
      await writeResumeDocx(output, { ...sampleResume, template }, { templateRoot });
      const raw = fs.readFileSync(output);
      assert.ok(raw.length > 2000);
      const zip = await JSZip.loadAsync(raw);
      const documentXml = await zip.file('word/document.xml').async('string');
      assert.match(documentXml, /林晓/, `${template} 应写入用户姓名`);
      assert.match(documentXml, /产品经理/, `${template} 应写入用户目标岗位`);
      assert.match(documentXml, /核心流程完成率提升 18%/, `${template} 应写入用户工作经历`);
      assert.match(documentXml, /校园服务平台/, `${template} 应写入用户项目经历`);
      assert.doesNotMatch(documentXml, /Haomin Yu|某某某|13888888888|888888@163\.com|上海复旦大学|泽熙信息科技有限公司/, `${template} 不应保留模板示例资料`);
      const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/') && !zip.files[name].dir);
      assert.ok(media.length > 0, `${template} 应包含照片媒体文件`);
      const mediaBuffers = await Promise.all(media.map((name) => zip.file(name).async('nodebuffer')));
      assert.ok(mediaBuffers.some((item) => item.equals(samplePhotoBytes)), `${template} 应以用户照片替换模板照片`);
      if (template === 'minimal') {
        const extracted = await mammoth.extractRawText({ path: output });
        assert.match(extracted.value, /林晓/);
      }
    }
  } finally {
    for (const file of created) if (fs.existsSync(file)) fs.unlinkSync(file);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  }
});

test('未填写资料或照片时，三个原模板也不会带出假资料和示例头像', async () => {
  const tempDir = path.join(process.cwd(), 'tests', '.blank-resume-docx-test');
  const templateRoot = path.join(process.cwd(), '简历模板');
  fs.mkdirSync(tempDir, { recursive: true });
  const created = [];
  try {
    for (const template of ['english_black', 'marketing_table', 'marketing_intern']) {
      const output = path.join(tempDir, `${template}.docx`); created.push(output);
      await writeResumeDocx(output, { template }, { templateRoot });
      const zip = await JSZip.loadAsync(fs.readFileSync(output));
      const documentXml = await zip.file('word/document.xml').async('string');
      assert.doesNotMatch(documentXml, /Haomin Yu|1906222627@qq\.com|某某某|135 0013 5000|13888888888|888888@163\.com|上海复旦大学|泽熙信息科技有限公司/);
      const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/') && !zip.files[name].dir);
      const mediaBuffers = await Promise.all(media.map((name) => zip.file(name).async('nodebuffer')));
      assert.ok(mediaBuffers.some((item) => item.equals(blankPhotoBytes)), `${template} 应清除示例头像`);
    }
  } finally {
    for (const file of created) if (fs.existsSync(file)) fs.unlinkSync(file);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  }
});
