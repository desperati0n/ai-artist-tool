# 画师管理器插件

`nai-batch-updater.js` 是 AI Artist Manager 的无构建步骤插件。它复用管理器的 `state.artists`、IndexedDB 图片存储和 `actions.exportData()`，因此通过审查的结果会直接出现在画师卡片中，并且可以从管理器原有的“导出”流程导出。

## 安装

把 `plugins/nai-batch-updater.js` 保留在项目目录，并确认 `index.html` 末尾存在：

```html
<script src="plugins/nai-batch-updater.js"></script>
```

重新打开 `index.html`，左侧“更新数据”下方会出现“NAI 批量更新”。

画师选择区的分类下拉会读取管理器现有分类。插件打开时默认不选择任何画师，并优先沿用管理器当前正在查看的分类。切换分类会清空旧分类的全部选择和搜索词，避免把不可见画师误带进队列；“全选当前/取消当前”只作用于当前分类与当前搜索结果。生成进行中会锁定分类、搜索和选择控件。

模型使用固定下拉选项，不允许自由输入模型 ID。V5 选项使用 `nai-diffusion-5-full` / `nai-diffusion-5-curated`；如果你的 NovelAI 账户尚未开放 V5，选择 V4.5 选项即可。

V5 的公开文档目前尚未给出独立的图像 API 请求体；插件沿用官方图像接口的通用 `input/model/action/parameters` 外壳，并为 V4 及以上模型附加结构化的 `v4_prompt` / `v4_negative_prompt`。每次请求还会带 6 位 `x-correlation-id`，便于定位服务端错误。

插件将 `n_samples` 固定为 `1`，并且等待当前请求完整返回后才提交下一位画师，避免单次请求批量返回多张图片。

生成期间的进度文字和进度条会逐张更新；画师列表和审查结果区每完成 10 张集中刷新一次，队列结束或停止时会再刷新最终结果。

生成过程中可以点击“暂停”：当前请求会完成，但不会继续提交下一张；点击“继续”后恢复队列。

审查结果采用单张即时处理：点击“通过”会立刻取消该画师的选择并把新例图写回画师资料；点击“拒绝”会保留该画师的选择，方便下一轮继续生成。无论通过还是拒绝，处理后的图片都会从右侧审查区移除。

右侧审查结果下方内置“请求记录”面板。每张图会记录请求提示词与参数（不会记录 API Key）、响应 HTTP 状态、Content-Type、耗时、响应大小、ZIP 解包结果和错误正文；记录最多保留 200 条，可直接复制或清空。

## 画师串补图流程

在主页面右侧 Prompt 编排区粘贴别人分享的画师串，点击“送到生图区”即可：本地不存在的 tag 会自动按当前分类收录；已有例图的画师不会进入生成队列；只有缺少例图的画师会被预选到批量窗口。当前画师栏没有缺例图画师时，该按钮不会显示。

插件默认正面提示词为：

```text
{artist},masterpiece, best quality, amazing quality, very aesthetic, absurdres, cinematic illustration,1 girl, beach, solo, hand up, kneeling, barefoot, peace sign, bikini,
```

API Key 仅保存在当前页面内存中。关闭批量窗口后重新打开仍会自动回填；刷新页面或关闭管理器后清除，不会写入 JSON 导出文件。
