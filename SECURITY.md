# 安全政策

## 支持范围

当前维护版本为 `0.1.x` 测试版。项目尚未完成代码签名和自动更新，因此请只从项目 GitHub Releases 下载，并核对 Release 中公布的 SHA-256。

## 报告安全问题

请不要在公开 Issue 中发布漏洞利用细节、API Key、真实简历、身份证明、联系方式或投递记录。

在仓库启用 GitHub Private Vulnerability Reporting 后，请优先使用仓库 **Security → Report a vulnerability** 私下报告。尚未启用时，可只创建不含敏感细节的 Issue，请维护者提供私下沟通方式。

## 安全边界

- 不绕过登录、验证码、2FA、Cloudflare 或反爬限制。
- 不执行未经用户确认的最终求职投递。
- 不在日志、备份和 GitHub 示例中保存明文 API Key。
- 不把模型输出当成已核验事实；企业和岗位信息最终以官方招聘网站为准。
