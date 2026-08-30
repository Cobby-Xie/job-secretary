const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} = require('docx');

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const BLANK_PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

const TEMPLATE_THEMES = {
  english_black: {
    id: 'english_black', name: '标准黑白英文', accent: '1F2937', soft: 'F5F5F5', bodyFont: 'Arial',
    sourceFile: 'cv-007标准黑白优秀的英文简历模板.docx',
    sourceSha256: 'cd953bae3e061d5eca4bfc67c1325622faf0d472760dfecc81baa7e759fc221a',
    photoPath: 'word/media/image2.jpeg',
  },
  marketing_table: {
    id: 'marketing_table', name: '市场专员', accent: '2D5E82', soft: 'EAF2F7', bodyFont: 'Microsoft YaHei',
    sourceFile: 'ZWW-00072市场营销学士市场专员简历模板.docx',
    sourceSha256: '17d01435d85636f54b2484e8b56640566ba98ce6cc475722a6a67375c16e40da',
    photoPath: 'word/media/image1.png',
  },
  marketing_intern: {
    id: 'marketing_intern', name: '市场实习生', accent: '147E89', soft: 'E9F6F6', bodyFont: 'Microsoft YaHei',
    sourceFile: 'ZWW-00079市场营销专业实习生简历模板.docx',
    sourceSha256: '487e4db42d6da065ae4ddbf50e3c736f98a4d52def911917d6f4626b15aa9259',
    photoPath: 'word/media/image1.jpeg',
  },
  minimal: {
    id: 'minimal', name: '极简留白', accent: '4B5563', soft: 'FFFFFF', bodyFont: 'DengXian',
  },
};

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const TABLE_BORDERS_NONE = {
  top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
  insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
};

async function readDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value.trim();
}

function nodes(nodeList) {
  const result = [];
  for (let index = 0; index < nodeList.length; index += 1) result.push(nodeList.item(index));
  return result;
}

function normalized(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function photoFromDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/(png|jpe?g|gif|bmp);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const format = match[1].toLowerCase();
  return {
    type: format === 'jpeg' ? 'jpg' : format,
    data: Buffer.from(match[2].replace(/\s/g, ''), 'base64'),
  };
}

function firstEducationSegment(education) {
  return String(education || '').split(/\r?\n/)[0].split(/[｜|]/)[0].trim();
}

function degreeFromEducation(education) {
  return String(education || '').match(/博士|硕士|本科|大专|高中/)?.[0] || '';
}

function paragraphText(paragraph) {
  return nodes(paragraph.getElementsByTagNameNS(W_NS, 't')).map((item) => item.textContent || '').join('');
}

function leafParagraphs(document) {
  return nodes(document.getElementsByTagNameNS(W_NS, 'p')).filter((paragraph) => paragraph.getElementsByTagNameNS(W_NS, 'p').length === 0);
}

function setParagraphText(document, paragraph, value) {
  const textNodes = nodes(paragraph.getElementsByTagNameNS(W_NS, 't'));
  if (!textNodes.length) return;
  const firstRun = textNodes[0].parentNode;
  for (const textNode of textNodes) textNode.textContent = '';
  const removable = nodes(firstRun.childNodes).filter((child) => ['t', 'br', 'tab'].includes(child.localName));
  for (const child of removable) firstRun.removeChild(child);
  const lines = String(value || '').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (index) firstRun.appendChild(document.createElementNS(W_NS, 'w:br'));
    const text = document.createElementNS(W_NS, 'w:t');
    text.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    text.appendChild(document.createTextNode(line));
    firstRun.appendChild(text);
  });
}

function replaceExactParagraphs(document, paragraphs, replacements) {
  const protectedParagraphs = new Set();
  for (const paragraph of paragraphs) {
    const key = normalized(paragraphText(paragraph));
    if (!Object.prototype.hasOwnProperty.call(replacements, key)) continue;
    const replacement = typeof replacements[key] === 'function' ? replacements[key]() : replacements[key];
    setParagraphText(document, paragraph, replacement);
    protectedParagraphs.add(paragraph);
  }
  return protectedParagraphs;
}

function replaceSections(document, paragraphs, sectionMap, resume, protectedParagraphs) {
  let active = null;
  let filled = false;
  for (const paragraph of paragraphs) {
    const text = normalized(paragraphText(paragraph));
    const section = sectionMap[text];
    if (section) {
      if (section.title) setParagraphText(document, paragraph, section.title);
      active = section;
      filled = false;
      continue;
    }
    if (protectedParagraphs.has(paragraph)) { active = null; filled = false; continue; }
    if (!active || !text) continue;
    if (!filled) {
      setParagraphText(document, paragraph, String(resume[active.field] || '—'));
      filled = true;
    } else {
      setParagraphText(document, paragraph, '');
    }
  }
}

function fillEnglishTemplate(document, resume) {
  const paragraphs = leafParagraphs(document);
  const contact = [resume.phone, resume.email].filter(Boolean).join(' | ') || '—';
  const target = [resume.targetRole, resume.city].filter(Boolean).join(' | ') || '—';
  const protectedParagraphs = replaceExactParagraphs(document, paragraphs, {
    'Haomin Yu': resume.name || 'Personal Resume',
    '(+86) 13900139000 | E-mail: 1906222627@qq.com': contact,
    'Address: No.67, Lane123, Job Road, Job District, Shanghai, China': target,
  });
  replaceSections(document, paragraphs, {
    EDUCATION: { field: 'education' },
    'WORK EXPERIENCE': { field: 'experience' },
    INTERNSHIP: { field: 'projects', title: 'PROJECT EXPERIENCE' },
    'CERTIFICATES AND HONORS': { field: 'skills', title: 'SKILLS' },
    HIGHLIGHTS: { field: 'summary', title: 'PROFILE' },
  }, resume, protectedParagraphs);
}

function fillMarketingTableTemplate(document, resume) {
  const paragraphs = leafParagraphs(document);
  const protectedParagraphs = replaceExactParagraphs(document, paragraphs, {
    '某某某': resume.name || '个人简历',
    '1996.05': '',
    汉: '',
    '177cm': '',
    '135 0013 5000': resume.phone || '',
    中共党员: '',
    '123123@163.com': resume.email || '',
    上海复旦大学: firstEducationSegment(resume.education),
    广东省广州市海珠区滨江东路: resume.city || '',
    本科: degreeFromEducation(resume.education),
    市场专员: resume.targetRole || '',
  });
  replaceSections(document, paragraphs, {
    教育背景: { field: 'education' },
    实习经历: { field: 'experience', title: '工作经历' },
    校内实践: { field: 'projects', title: '项目经历' },
    技能证书: { field: 'skills' },
    自我评价: { field: 'summary' },
  }, resume, protectedParagraphs);
}

function fillMarketingInternTemplate(document, resume) {
  const paragraphs = leafParagraphs(document);
  const protectedParagraphs = replaceExactParagraphs(document, paragraphs, {
    '出生年月：1996.05': `目标职位：${resume.targetRole || ''}`,
    '身 高：167cm': `所在城市：${resume.city || ''}`,
    '政治面貌：中共党员': '',
    '毕业院校：某某某科技大学': `毕业院校：${firstEducationSegment(resume.education)}`,
    '学 历：本科': `学    历：${degreeFromEducation(resume.education)}`,
    '姓 名：某某某': `姓    名：${resume.name || ''}`,
    '民 族：汉': '',
    '电 话：13888888888': `电    话：${resume.phone || ''}`,
    '邮 箱：888888@163.com': `邮    箱：${resume.email || ''}`,
    '住 址：浙江省杭州市滨江区': `住    址：${resume.city || ''}`,
  });
  replaceSections(document, paragraphs, {
    教育背景: { field: 'education' },
    自我评价: { field: 'summary' },
    技能证书: { field: 'skills' },
    校园经历: { field: 'projects', title: '项目经历' },
    实习经历: { field: 'experience', title: '工作经历' },
  }, resume, protectedParagraphs);
}

function ensureImageContentType(contentTypesDocument, extension, mimeType) {
  const defaults = nodes(contentTypesDocument.getElementsByTagNameNS(CONTENT_TYPES_NS, 'Default'));
  if (defaults.some((item) => String(item.getAttribute('Extension')).toLowerCase() === extension)) return;
  const item = contentTypesDocument.createElementNS(CONTENT_TYPES_NS, 'Default');
  item.setAttribute('Extension', extension);
  item.setAttribute('ContentType', mimeType);
  contentTypesDocument.documentElement.appendChild(item);
}

async function replaceTemplatePhoto(zip, theme, resume, parser, serializer) {
  const photo = photoFromDataUrl(resume.photoDataUrl) || { type: 'png', data: BLANK_PHOTO };
  const originalPath = theme.photoPath;
  const extension = photo.type === 'jpg' ? 'jpeg' : photo.type;
  const newPath = originalPath.replace(/\.[^.]+$/, `.${extension}`);
  if (newPath !== originalPath) zip.remove(originalPath);
  zip.file(newPath, photo.data);

  const relPath = 'word/_rels/document.xml.rels';
  const relDocument = parser.parseFromString(await zip.file(relPath).async('string'), 'application/xml');
  const relationships = nodes(relDocument.getElementsByTagNameNS(REL_NS, 'Relationship'));
  const originalTarget = `media/${path.posix.basename(originalPath)}`;
  for (const relationship of relationships) {
    if (relationship.getAttribute('Target') === originalTarget) relationship.setAttribute('Target', `media/${path.posix.basename(newPath)}`);
  }
  zip.file(relPath, serializer.serializeToString(relDocument));

  const contentTypesPath = '[Content_Types].xml';
  const contentTypes = parser.parseFromString(await zip.file(contentTypesPath).async('string'), 'application/xml');
  const mimeType = extension === 'png' ? 'image/png' : extension === 'gif' ? 'image/gif' : extension === 'bmp' ? 'image/bmp' : 'image/jpeg';
  ensureImageContentType(contentTypes, extension, mimeType);
  zip.file(contentTypesPath, serializer.serializeToString(contentTypes));
}

function assertNoSampleData(documentXml, resume) {
  const forbidden = [
    'Haomin Yu', '1906222627@qq.com', '13900139000', 'No.67, Lane123',
    '某某某', '135 0013 5000', '123123@163.com', '13888888888', '888888@163.com',
    '上海复旦大学', '某某某科技大学', '泽熙信息科技有限公司', 'Frost&amp;Sullivan', 'Deloitte Touche',
  ];
  const userText = Object.values(resume || {}).filter((value) => typeof value === 'string' && !String(value).startsWith('data:image/')).join('\n');
  const found = forbidden.filter((token) => documentXml.includes(token) && !userText.includes(token.replace('&amp;', '&')));
  if (found.length) throw new Error(`模板示例资料未完全清除：${found.join('、')}`);
}

async function writeSourceTemplateDocx(filePath, resume, theme, templateRoot) {
  if (!templateRoot) throw new Error('缺少简历模板目录');
  const sourcePath = path.join(templateRoot, theme.sourceFile);
  const sourceBuffer = fs.readFileSync(sourcePath);
  const sourceHash = crypto.createHash('sha256').update(sourceBuffer).digest('hex');
  if (sourceHash !== theme.sourceSha256) throw new Error(`模板文件已变化，请重新检查后再导出：${theme.name}`);

  const zip = await JSZip.loadAsync(sourceBuffer);
  const documentPath = 'word/document.xml';
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const document = parser.parseFromString(await zip.file(documentPath).async('string'), 'application/xml');
  if (theme.id === 'english_black') fillEnglishTemplate(document, resume);
  else if (theme.id === 'marketing_table') fillMarketingTableTemplate(document, resume);
  else fillMarketingInternTemplate(document, resume);
  const documentXml = serializer.serializeToString(document);
  assertNoSampleData(documentXml, resume);
  zip.file(documentPath, documentXml);
  await replaceTemplatePhoto(zip, theme, resume, parser, serializer);
  fs.writeFileSync(filePath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } }));
}

function bodyParagraphs(text, theme) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [new Paragraph({ text: '—', spacing: { after: 90 }, run: { color: '8A94A3', size: 20 } })];
  return lines.map((line) => new Paragraph({
    children: [new TextRun({ text: line, size: 20, color: '303B4D', font: theme.bodyFont })],
    spacing: { after: 100, line: 310 }, widowControl: true,
  }));
}

function sectionTitle(label, theme) {
  return new Paragraph({
    children: [new TextRun({ text: label, bold: true, color: theme.accent, size: 23, font: theme.bodyFont })],
    spacing: { before: 180, after: 110 }, keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, color: theme.accent, size: 4, space: 3 } },
  });
}

function resumeSections(resume, theme) {
  return [
    ['求职目标', resume.targetRole], ['个人优势', resume.summary], ['教育经历', resume.education],
    ['工作经历', resume.experience], ['项目经历', resume.projects], ['专业技能', resume.skills],
  ].flatMap(([label, value]) => [sectionTitle(label, theme), ...bodyParagraphs(value, theme)]);
}

function identityParagraphs(resume, theme, alignOverride) {
  const align = alignOverride || AlignmentType.LEFT;
  const contact = [resume.phone, resume.email, resume.city].filter(Boolean).join('  ·  ');
  return [
    new Paragraph({ alignment: align, children: [new TextRun({ text: resume.name || '个人简历', bold: true, color: theme.accent, size: 32, font: theme.bodyFont })], spacing: { after: 100 } }),
    new Paragraph({ alignment: align, children: [new TextRun({ text: resume.targetRole || '求职者', bold: true, color: '596579', size: 21, font: theme.bodyFont })], spacing: { after: 80 } }),
    new Paragraph({ alignment: align, children: [new TextRun({ text: contact || '请补充联系方式', color: '6B7585', size: 18, font: theme.bodyFont })], spacing: { after: 130 } }),
  ];
}

function resumeHeader(resume, theme) {
  const photo = photoFromDataUrl(resume.photoDataUrl);
  if (!photo) return identityParagraphs(resume, theme);
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [7500, 1500], layout: TableLayoutType.FIXED, borders: TABLE_BORDERS_NONE,
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 7500, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: { top: 0, bottom: 0, left: 0, right: 160 }, borders: TABLE_BORDERS_NONE, children: identityParagraphs(resume, theme) }),
      new TableCell({ width: { size: 1500, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: { top: 0, bottom: 0, left: 0, right: 0 }, borders: { top: { style: BorderStyle.SINGLE, color: 'E5E7EB', size: 6 }, bottom: { style: BorderStyle.SINGLE, color: 'E5E7EB', size: 6 }, left: { style: BorderStyle.SINGLE, color: 'E5E7EB', size: 6 }, right: { style: BorderStyle.SINGLE, color: 'E5E7EB', size: 6 } }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: photo.type, data: photo.data, transformation: { width: 90, height: 120 }, altText: { title: '简历照片', description: '用户上传的简历照片', name: '简历照片' } })] })] }),
    ] })],
  })];
}

function buildResumeDocument(resume = {}) {
  const theme = TEMPLATE_THEMES.minimal;
  return new Document({
    title: `${resume.name || '个人'}简历`, creator: '求职秘书', description: `${theme.name}简历模板`,
    styles: { default: { document: { run: { font: theme.bodyFont, size: 20, color: '303B4D' }, paragraph: { spacing: { line: 310 } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1190, bottom: 1134, left: 1190, header: 500, footer: 500, gutter: 0 } } }, children: [...resumeHeader(resume, theme), ...resumeSections(resume, theme)] }],
  });
}

async function writeResumeDocx(filePath, resume, options = {}) {
  const theme = TEMPLATE_THEMES[resume.template] || TEMPLATE_THEMES.marketing_table;
  if (theme.sourceFile) return writeSourceTemplateDocx(filePath, resume, theme, options.templateRoot);
  fs.writeFileSync(filePath, await Packer.toBuffer(buildResumeDocument(resume)));
}

module.exports = { TEMPLATE_THEMES, buildResumeDocument, readDocx, writeResumeDocx };
