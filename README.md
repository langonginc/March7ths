# March7ths 图片画廊

March7ths 是一个以三月七与长夜月为主题的静态图片画廊。项目使用 React、TypeScript 与 Vite 构建，通过 GitHub Pages 发布，并使用 GitHub Issue 与 Actions 接收新的图片投稿。

## 本地开发

需要 Node.js 22 与 npm。

```bash
npm install
npm run dev
```

本地开发服务器默认使用根路径。生产构建默认使用 `/March7ths/` 作为 GitHub Pages 基础路径：

```bash
npm test
npm run build
```

如需为其他地址构建，可以覆盖基础路径：

```bash
VITE_BASE_PATH=/ npm run build
```

## 页面

- `/`：无顶栏、底栏的沉浸式首页。将正式首图放到 `public/hero.jpg`；文件缺失时会使用星空渐变背景。
- `/gallery`：搜索、三级分类筛选、时间与文本相关度排序。
- `/gallery/:id`：图片原图、详细信息、可选来源、GitHub 上传者头像与下载入口。
- `/upload`：在浏览器本地整理多张图片并生成投稿 ZIP，不会直接把图片上传到服务器。

## 图片数据

```text
public/
├── images/<id>.<ext>          # 原图
├── thumbnails/<id>.jpg       # 最长边 720px 的缩略图
├── metadata.json             # 画廊摘要索引
└── metadata/<id>.json        # 单张图片详情
```

`metadata.json` 使用版本化结构：

```json
{
  "schemaVersion": 1,
  "items": []
}
```

不要手工猜测图片 ID。`issue_bot` 会根据原图 SHA-256 生成 ID，并同步创建缩略图、摘要和详情文件。

## 图片投稿

1. 在网站的“上传”页面选择并填写图片。
2. 下载生成的 `march7ths-submission-*.zip`。
3. 打开仓库的“图片投稿”Issue Form，上传 ZIP 并提交。
4. `issue_bot` 会验证附件，创建 `bot/submission-<issue号>` 分支和收录 PR。

投稿表单中的发布者默认填写为 `MiHoYo`，可以按实际发布方修改；更新时间固定为投稿当天，来源链接为可选字段。机器人会从 Issue 事件中记录投稿者的 GitHub 用户名和数字 ID，用于详情页展示 GitHub 头像及主页入口。

投稿包会被当作不可信输入处理：机器人限制压缩包及解压体积、验证真实图片格式、拒绝不安全路径和符号链接，并且不会执行附件中的任何内容。

## GitHub 配置

首次启用前，仓库管理员需要：

1. 在 **Settings → Actions → General → Workflow permissions** 中启用 Read and write permissions，并允许 GitHub Actions 创建 Pull Request。
2. 创建 `image-submission` 标签；机器人首次成功运行后也会自动补建该标签。
3. 在 **Settings → Pages** 中将发布源设为 **Deploy from a branch**，选择 `gh-pages` 分支与根目录。

“Build and publish”工作流只能手动触发。每次运行选择 `patch`、`minor` 或 `major`，工作流会先测试与构建，再提交版本号、创建 Git Tag，并更新 `gh-pages` 分支。失败重跑会复用同一个 workflow run 的版本，避免重复递增。

## 常用命令

```bash
npm run dev          # 本地开发
npm test             # 运行全部测试
npm run test:watch   # 监听测试
npm run build        # 类型检查与生产构建
```

## 版权与许可

Copyright © 2026 langonginc

本仓库的代码和文档采用[限制使用许可](LICENSE)：仅可在署名并保留许可声明的前提下，用于非商业的个人、教育、研究或学习活动；可修改和分发衍生版本，但衍生版本须继续遵守相同的非商业和署名限制。

任何公司、企业或其他营利性组织使用本仓库的代码，以及其他任何商业用途，均须事先取得 `langonginc` 的书面授权。

仓库内的图片、照片、插画、图标、纹理、截图及其他图片资源不包含在代码许可内。其权利归相应原始权利人所有；未经原作者许可，不得用于商业用途。

## Copyright and license

Copyright © 2026 langonginc

The repository's Code and documentation are available under the [Restricted Use License](LICENSE). They may be used, modified, and distributed only for non-commercial personal, educational, research, or learning purposes, with attribution and retention of the license notice. Derivative versions must remain subject to the same non-commercial and attribution restrictions.

Any use of the Code by a company, enterprise, or other for-profit organization, and any other commercial use, requires prior written authorization from `langonginc`.

Images, photographs, illustrations, icons, textures, screenshots, and other Image Assets in this repository are excluded from the Code license. Their rights remain with the applicable original rights holders, and they may not be used commercially without the original creator's permission.
