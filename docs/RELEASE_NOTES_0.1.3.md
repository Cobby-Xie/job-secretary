# 求职秘书 0.1.3

新增 Windows 与 macOS 双平台构建。

## 下载文件

- Windows 10 / 11 x64：`Job-Secretary-0.1.3-Windows-x64.exe`
- macOS 11+ Intel / Apple Silicon：`Job-Secretary-0.1.3-macOS-Universal.dmg`
- Mac ZIP 备用包：`Job-Secretary-0.1.3-macOS-Universal.zip`
- 文件校验：`SHA256SUMS.txt`

## macOS 使用说明

1. 下载并打开 DMG。
2. 将“求职秘书”拖入“应用程序”文件夹。
3. 当前测试版尚未使用 Apple Developer ID 签名和公证，因此首次运行可能显示未知开发者提示。
4. 只应从本项目 GitHub Release 页面下载，并核对 SHA-256。

## 本版变化

- 增加 macOS Universal 通用版本，同时支持 Intel 和 Apple Silicon。
- 增加 Mac ICNS 图标生成流程。
- Windows 和 macOS 使用同一套本地简历、岗位雷达、AI 顾问与求职记录功能。
- 增加 GitHub Actions 自动测试、双平台打包和 Release 上传。

## 已知限制

- Windows 与 macOS 测试包都尚未购买代码签名证书。
- Mac 版必须在真实 Mac 上继续验证 DMG 安装、钥匙串存储、DOCX/PDF 导出和中文路径。
- AI 功能仍需用户自行配置 API Key；聊天产品会员通常不等于 API 调用额度。

