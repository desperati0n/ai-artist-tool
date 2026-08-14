<div align="center">

# AI Artist Manager v15

**本地优先的画师资料、风格预设与 Prompt 编排工具。**

[![Release](https://img.shields.io/badge/release-v15-20201e)](https://github.com/desperati0n/ai-artist-tool/releases/tag/v15)
[![UI](https://img.shields.io/badge/UI-Obsidian%20%26%20Bone-e8e3d9)](https://desperati0n.github.io/ai-artist-tool/index-spotlight.html)
[![Storage](https://img.shields.io/badge/storage-local--first-596554)](#数据与隐私)

[在线体验 v15](https://desperati0n.github.io/ai-artist-tool/index-spotlight.html) · [查看 Changelog](CHANGELOG.md) · [反馈问题](https://github.com/desperati0n/ai-artist-tool/issues)

</div>

---

## 这是什么

AI Artist Manager 用来整理画师 Tag、预览图、分类与常用风格组合，并把选中的画师快速转换成 NovelAI 或 Stable Diffusion 可用的 Prompt。

v15 提供一套独立的新界面 `index-spotlight.html`。它保留原有数据和功能，将工作流程重新组织为分类、画师浏览和 Prompt 编排三个明确区域。经典界面 `index.html` 仍然保留，方便比较或回退。

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
- 本地存储：使用 IndexedDB 保存图片与画师资料，设置项使用 LocalStorage。

## 快速开始

### 在线体验

打开 [v15 GitHub Pages 页面](https://desperati0n.github.io/ai-artist-tool/index-spotlight.html)。在线页面适合体验；重要数据仍建议定期导出备份。

### 本地使用

1. 在仓库右上角选择 `Code` → `Download ZIP`，或者运行：

   ```bash
   git clone https://github.com/desperati0n/ai-artist-tool.git
   ```

2. 解压或进入项目目录。
3. 双击 `index-spotlight.html` 使用 v15 界面。
4. 如需经典界面，打开 `index.html`。

应用不需要后端服务。页面通过 CDN 加载 Tailwind CSS 和 Phosphor Icons，因此首次打开或缓存缺失时需要网络连接。

## 基本工作流

1. 点击右上角“添加”，录入画师名称、Tag、分类和封面。
2. 从左侧选择分类，在中间浏览或搜索画师。
3. 点击卡片加入右侧 Prompt 编排区。
4. 调整权重与顺序，选择 NAI 或 SDXL 输出格式。
5. 复制 Prompt，或者把当前组合保存为预设。
6. 定期使用左侧“导出”生成 JSON 备份。

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
| `index-spotlight.html` | v15 黑曜石 × 骨白界面。 |
| `index.html` | 保留的经典界面。 |
| `fetch_danbooru_counts.py` | 可选的 Danbooru 批量更新脚本。 |
| `CHANGELOG.md` | 版本更新记录。 |
| `architecture_reference.md` | 项目结构与二次开发参考。 |

## 贡献

欢迎通过 [Issues](https://github.com/desperati0n/ai-artist-tool/issues) 提交问题和建议，也欢迎发起 Pull Request。提交界面改动时，请同时检查浅色/深色主题和窄屏布局，并确保现有数据流程不受影响。

<div align="center">

Made for practical AI art workflows.

</div>
