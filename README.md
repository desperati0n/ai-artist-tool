<div align="center">

# AI Artist Manager v16（重构预览）

**本地优先的画师资料、风格预设与 Prompt 编排工具。**

[![Release](https://img.shields.io/badge/release-v15-20201e)](https://github.com/desperati0n/ai-artist-tool/releases/tag/v15)
[![UI](https://img.shields.io/badge/UI-Obsidian%20%26%20Bone-e8e3d9)](https://desperati0n.github.io/ai-artist-tool/index.html)
[![Storage](https://img.shields.io/badge/storage-local--first-596554)](#数据与隐私)

[在线体验 v15](https://desperati0n.github.io/ai-artist-tool/index.html) · [查看 Changelog](CHANGELOG.md) · [反馈问题](https://github.com/desperati0n/ai-artist-tool/issues)

</div>

---

## 这是什么

AI Artist Manager 用来整理画师 Tag、预览图、分类与常用风格组合，并把选中的画师快速转换成 NovelAI 或 Stable Diffusion 可用的 Prompt。

项目正在迁移到 React + TypeScript + Vite。新的 `react.html` 按画师、Prompt、预设、生图、存储和存档等功能拆分源码；原有 `index.html` 完整保留，作为稳定版本和交互对照。

两个版本继续读取 `nai-v12-*` LocalStorage 键和 `NAIArtistDB_V12` IndexedDB，并使用相同的本地存档 API。通过 Vite 开发服务器访问时，浏览器存储因端口不同而属于另一个来源；通过构建后的 Python 本地服务访问可以继续使用同一 `data/` 存档。

## v15 更新重点

| 更新 | 说明 |
| --- | --- |
| 工具型三栏布局 | 搜索、分类、画师选择与 Prompt 编排在同一工作区内完成。 |
| 黑曜石 × 骨白 | 统一浅色、深色模式的主操作、选中态、焦点环和按钮交互。 |
| 默认 NAI 输出 | 默认生成 NovelAI 格式，同时保留 SDXL/NAI 快速切换。 |
| 分类 Dock 动画 | 当前分类使用平滑移动的指示层反馈，减少界面跳动。 |
| 侵蚀按钮反馈 | 填充从指针位置扩散，并针对两种主题保持清晰文字对比。 |
| 卡片聚光反馈 | 使用低饱和中性光泽提示当前卡片，不干扰图片内容。 |
| 响应式工具抽屉 | 窄屏下分类与 Prompt 面板转为抽屉，390px 宽度下无横向溢出。 |
| 可访问性修正 | 统一焦点状态，并为翻页、清空、权重和卡片操作补充可访问名称。 |

完整改动请查看 [CHANGELOG.md](CHANGELOG.md)。

## 核心功能

- 画师资料管理：保存名称、Danbooru Tag、分类、封面、热度与社交链接。
- Prompt 编排：选择多个画师、调整权重、拖拽排序并一键复制结果。
- 双格式输出：支持 NovelAI 与 Stable Diffusion/SDXL 权重语法。
- 风格预设：保存常用画师组合，之后可以快速恢复。
- 批量管理：批量选择、分类、移出与删除画师。
- 智能导入：合并 JSON 数据时保留现有封面、UUID 和自定义分类。
- 数据更新：可在网页内调用 Danbooru API 更新热度和社交链接。
- NAI 批量更新插件：从画师列表批量生成新例图，逐张审查后直接写回 IndexedDB，并沿用原有导出格式。
- 本地存储：使用 IndexedDB 保存图片与画师资料，设置项使用 LocalStorage。

## 快速开始

### 在线体验

打开 [v15 GitHub Pages 页面](https://desperati0n.github.io/ai-artist-tool/index.html)。在线页面适合体验；重要数据仍建议定期导出备份。

### 使用 React 重构版本

需要 Node.js 和 Python。在两个终端中运行：

```powershell
python run_server.py
npm install
npm run dev
```

开发页面为 `http://127.0.0.1:5173/react.html`，Vite 会把 `/api` 转发给 `localhost:8010` 的本地存档服务。

生成生产文件并通过 Python 服务访问：

```powershell
npm run build
python run_server.py
```

然后打开 `http://localhost:8010/react.html`。生产构建与旧版页面共享同一个来源和 `data/` 存档。

### 使用保留的旧版本

1. 在仓库右上角选择 `Code` → `Download ZIP`，或者运行：

   ```bash
   git clone https://github.com/desperati0n/ai-artist-tool.git
   ```

2. 解压或进入项目目录。
3. 双击 `index.html` 使用原有 v15 界面。

应用不需要后端服务。页面通过 CDN 加载 Tailwind CSS 和 Phosphor Icons，因此首次打开或缓存缺失时需要网络连接。

## 基本工作流

1. 点击右上角“添加”，录入画师名称、Tag、分类和封面。
2. 从左侧选择分类，在中间浏览或搜索画师。
3. 点击卡片加入右侧 Prompt 编排区。
4. 调整权重与顺序，选择 NAI 或 SDXL 输出格式。
5. 复制 Prompt，或者把当前组合保存为预设。
6. 定期使用左侧“导出”生成 JSON 备份。

在右侧 Prompt 编排区粘贴别人的画师串后，点击“送到生图区”可以自动收录本地没有的画师，并打开 NAI 批量生图窗口补齐例图。

### NAI 批量生图插件

- 在当前分类和搜索结果中显示“有例图”标记。
- “全选”只选择当前分类/搜索结果；“选择无例图”只选择当前分类中缺少例图的画师。
- 从 Prompt 编排区粘贴别人的画师串后，可一键收录缺失画师，并只把没有例图的画师送入生图区。
- 当前画师串全部已有例图时，“送到生图区”按钮自动隐藏。
- 每位画师单独请求 1 张图片，支持暂停、停止、失败重试和逐张通过/拒绝。
- 通过审核的图片会直接写回画师资料；API Key 只在当前页面会话内存中保留，关闭窗口不会丢失，刷新页面后清除。

## 数据更新

左侧“更新数据”可以直接在网页内访问 Danbooru API，支持：

- 仅更新尚无热度数据的画师。
- 强制更新全部画师。
- 仅补充缺失的社交链接。
- 调整请求速率、查看进度与随时取消。

该功能需要当前网络能够访问 `danbooru.donmai.us`。仓库中的 `fetch_danbooru_counts.py` 仍可用于脚本化更新。

## 数据与隐私

画师资料、预览图和预设默认保存在当前浏览器的本地数据库中，不会自动上传到项目服务器。以下操作可能清除数据：

- 清理浏览器站点数据或缓存。
- 更换浏览器、浏览器配置文件或页面来源。
- 重装系统或删除本地浏览器数据。

请定期使用“导出”保存 JSON 备份。在线页面与本地文件的存储空间彼此独立，切换入口前请先导出数据。

## 项目文件

| 文件 | 用途 |
| --- | --- |
| `index.html` | 完整保留的 v15 单文件界面和回退入口。 |
| `react.html` | React 重构版本的 Vite 源入口。 |
| `src/app/` | 应用状态、生命周期、顶层布局和兼容动作入口。 |
| `src/features/` | 画师、Prompt、预设、生图和存档功能模块。 |
| `src/storage/` | 浏览器存储和 Python 本地存档适配。 |
| `server/` | 拆分后的 Python 配置、图片、存档和 HTTP 路由。 |
| `package.json` | 开发、测试、类型检查和构建命令。 |
| `fetch_danbooru_counts.py` | 可选的 Danbooru 批量更新脚本。 |
| `plugins/nai-batch-updater.js` | NAI 批量生图与例图审查插件。 |
| `CHANGELOG.md` | 版本更新记录。 |
| `architecture_reference.md` | 项目结构与二次开发参考。 |

## 贡献

欢迎通过 [Issues](https://github.com/desperati0n/ai-artist-tool/issues) 提交问题和建议，也欢迎发起 Pull Request。提交界面改动时，请同时检查浅色/深色主题和窄屏布局，并确保现有数据流程不受影响。

<div align="center">

Made for practical AI art workflows.

</div>
