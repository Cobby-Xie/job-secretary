# 求职秘书 Job Secretary

![Release](https://img.shields.io/badge/release-v0.1.3-1769e8)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-0078d4)
![Local first](https://img.shields.io/badge/data-local--first-24a148)
![Code license](https://img.shields.io/badge/code%20license-MIT-f0c000)

![求职秘书产品封面](public/job-secretary-social.png)

一款面向 Windows 与 macOS 的本地优先求职工作台：按省市发现企业与官方招聘入口，保存岗位 JD，分析岗位匹配度，管理和定制简历，练习每日面试题，并追踪每一次投递。

> 求职秘书不是“一键自动海投”工具。软件不会绕过登录、验证码或网站限制，也不会代替用户点击最终提交。

**English summary:** A local-first Windows and macOS job-search workspace for company discovery, official career links, JD-to-resume matching, resume tailoring, interview practice, and application tracking. Users remain in control of every final application.

## 下载安装

当前测试版：**v0.1.3**

- Windows 10 / 11 x64：下载 `Job-Secretary-0.1.3-Windows-x64.exe`。
- macOS 11 及以上：下载 `Job-Secretary-0.1.3-macOS-Universal.dmg`，同时支持 Intel 与 Apple Silicon。
- 两个平台均无需单独安装 Node.js。当前测试包尚未购买代码签名证书，系统可能显示未知开发者提示；请只从本项目 Release 页面下载并核对 `SHA256SUMS.txt`。
- 软件不内置任何共享 AI Key。使用云端 AI 时，需要用户自行从相应开发者平台取得 API Key。

## 核心功能

| 模块 | 能做什么 |
| --- | --- |
| 自我简历 | 填写个人信息、教育、工作经历、项目经历、技能和照片；导入 DOCX，导出 DOCX/PDF；模板示例资料会被用户填写的内容替换。 |
| 岗位雷达 | 按省份、城市、岗位方向和校招/社招/实习生成企业搜索任务；保存企业官方招聘入口和能够核验的公开岗位。 |
| 企业介绍 | 与岗位雷达的城市结果联动，展示企业官网、岗位入口、地点、团队规模和融资信息；无法可靠核验时明确显示“待核验”。 |
| 求职记录 | 手动记录收藏、准备投递、已投递、测评、笔试、面试、等待结果、录用或结束状态，并设置提醒。 |
| AI 顾问 | 分为岗位推荐、每日三道面试题、定制简历三个页面；输出岗位匹配证据、简历质量检查分和仍需补足的真实经历。 |

### 简历模板

- 标准黑白英文
- 市场专员
- 市场实习生
- 极简留白

姓名、电话、邮箱、城市、求职目标、个人优势、教育经历、工作经历、项目经历、技能和用户照片均来自软件内填写内容。没有填写的字段会留空，模板中的示例姓名、公司、学校、电话和头像不会进入导出文件。

## AI 接入

桌面版目前适配：

- 豆包（火山方舟）
- 通义千问（阿里云百炼）
- ChatGPT / OpenAI API
- Claude（Anthropic）
- Gemini（Google AI）
- DeepSeek、Kimi、智谱 GLM
- Ollama 本地模型
- 自定义 OpenAI 兼容接口

聊天产品会员通常不等于 API 额度。只有供应商 API 或用户自己的代理明确支持网页搜索时，软件才会请求实时企业与岗位结果；普通聊天接口不能自动变成联网搜索接口。

## 工作流程

```text
设置求职方向与城市
        ↓
外部 AI 助手搜索，或调用用户自己配置且支持联网的 AI API
        ↓
校验企业名称、HTTPS 官方招聘入口和公开岗位链接
        ↓
用户打开企业官网；需要登录或验证时交还用户处理
        ↓
保存 JD → 匹配简历证据 → 生成定制副本与经历缺口
        ↓
用户核对简历并亲自提交
        ↓
用户确认“已投递”并继续记录测评、笔试和面试进度
```

岗位发现与人工确认思路受到 [JobHuntBot](https://github.com/Raymon-boy-pal/JobHuntBot) 启发。本项目没有直接复制其代码，并采用独立的 Electron/React 桌面实现。

## 安全边界

求职秘书不会：

- 猜测或编造身份、学历、工作资格、薪资、技能、项目和工作成果。
- 绕过 CAPTCHA、Cloudflare、短信验证、2FA、登录或反爬限制。
- 把“收藏”“已保存”误记成“已投递”。
- 未经用户确认就提交简历或对外发送个人资料。
- 在 GitHub 仓库、安装包或示例配置中附带共享 API Key。

详细说明见 [PRIVACY.md](PRIVACY.md)、[SECURITY.md](SECURITY.md) 和 [SKILL.md](SKILL.md)。

## 本地数据与隐私

- 简历、岗位、投递记录和 AI 设置默认保存在当前电脑的应用私有目录。
- 选择“记住密钥”时，桌面版使用 Windows 安全存储或 macOS 钥匙串能力加密 API Key。
- 完整备份不会导出 API Key。
- 请勿把真实简历、照片、投递记录、备份或本地配置提交到公开 GitHub 仓库。

## 本地开发

要求：Windows 或 macOS、Node.js 22.13+、pnpm。

```powershell
pnpm install
pnpm dev
```

质量检查与构建：

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm dist:win
pnpm dist:mac
```

打包文件默认输出到 `release` 目录。`release*`、构建缓存、用户数据、导出简历和 API Key 配置均已被 `.gitignore` 排除。

## 项目结构

```text
app/                 React 业务界面
desktop/             Electron 主进程、数据存储、AI 与文档服务
resources/           软件图标和官方招聘来源示例
config/              可公开的空白配置示例
references/          AI Agent 工作流与安全参考
tests/               自动化测试
scripts/             构建与质量检查脚本
简历模板/             本地 DOCX 模板资源（许可范围见第三方说明）
```

## 当前状态

- v0.1.3：Windows x64 与 macOS Universal 测试版。
- TypeScript 检查通过，14 项自动测试通过。
- 企业招聘网站结构差异较大，通用扫描无法保证读取所有动态岗位；最终结果必须以企业官网为准。
- 安装包尚未代码签名，也没有自动更新功能。

版本变化见 [CHANGELOG.md](CHANGELOG.md)。

## 贡献

欢迎提交 Issue 和 Pull Request。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 中的方式私下报告，不要在公开 Issue 中粘贴真实简历或 API Key。

## 许可证与第三方资源

项目自有源代码使用 [MIT License](LICENSE)。第三方 DOCX 模板、商标和外部网站内容不自动适用 MIT License，具体范围见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

