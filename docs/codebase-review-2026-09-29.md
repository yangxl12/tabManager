# TabNest 代码与性能分析报告

日期：2026-09-29。范围：`src/`、构建配置、现有测试与《技术方案.md》。本次仅分析，没有修改业务代码。结论来自源码路径和本地静态验证；浏览器内存、帧率及真实 Chrome API 时序尚未实测。

## 1. 现状与总体判断

项目是 Manifest V3 新标签页扩展。`src/newtab/main.tsx` 启动 React；`src/components/App.tsx` 组装界面；`src/store/` 用 Zustand slices 管理标签、书签、快捷访问、便签和 UI；`src/services/` 包装 Chrome API；`src/lib/` 主要放纯逻辑；`src/dnd/dnd.ts` 集中注册和编排拖拽。这些边界总体合理，`bookmarkTree.ts` 的纯函数、`upsertNode` 的事件幂等处理和独立的 Chrome API 适配层值得保留。

主要改进顺序是：先修数据一致性与失败处理，再减少大书签库和拖拽时的重复计算，最后按职责拆分大文件。单凭文件行数拆分会制造跳转成本；应以可独立测试的业务流程为拆分单位。

| 项目 | 当前结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm test` | 15 个测试文件、151 个测试通过；覆盖以纯逻辑为主 |
| `npm exec vite build` | 通过；主 JS 588.21 kB（gzip 180.95 kB），CSS 47.27 kB（gzip 9.58 kB）；Vite 提示主 chunk 超过 500 kB |
| 大文件 | `theme.css` 约 2,250 行，`bookmarksSlice.ts` 约 727 行，`dnd.ts` 约 700 行，`QuickSites.tsx` 约 400 行 |

上述体积是构建产物大小，不能直接推断首屏耗时；性能建议仍需在真实扩展页面中测量。

## 2. 优先处理的问题

### P1-1 批量删除与撤销在部分失败时不一致

**证据**：[`bookmarksSlice.ts`](../src/store/bookmarksSlice.ts) 第 373–438 行先为全部书签制作记录，再用 `Promise.all(real.map(removeNode))` 删除；只有全部成功才把记录压入 `undoStack`。若部分 `removeNode` 已成功、其中一个失败，代码进入 `catch`、同步树，却没有为已删除项留下撤销记录。第 479–518 行又在恢复前先 `pop()`；恢复到一半失败后，剩余项的撤销记录也已消失。

**影响**：用户可能看到“删除失败”，实际已有若干书签被删且无法通过当前撤销入口恢复；撤销失败时同样可能出现半恢复状态。

**建议**：把批量操作结果逐项记录下来，仅将成功删除的项写入撤销记录。撤销时先标记进行中，逐项确认创建结果；失败时保留尚未恢复的记录并提示成功/失败数量，防止重复触发。先补 Chrome API 部分失败的模拟测试，再改业务流程。

### P1-2 便签跨标签页编辑可能被旧内容覆盖

**证据**：[`NotePanel.tsx`](../src/components/NotePanel.tsx) 第 69–76 行收到外部 `noteHtml` 时，编辑器正聚焦便跳过 DOM 回灌；第 78–111 行在隐藏、卸载时调用 `flushSave()`，把当前 DOM HTML 再写回。[`store/index.ts`](../src/store/index.ts) 第 101–104 行会接收其他新标签页的便签变更，且 [`notesSlice.ts`](../src/store/notesSlice.ts) 第 55–61 行每次保存都直接覆盖同一键。

**影响**：A 页编辑中，B 页保存了新内容；A 页仍显示旧 DOM，随后隐藏或关闭会把旧内容重新写回。当前没有版本号或冲突提示。

**建议**：先定义多页同时编辑的规则。最小方案是记录本地 dirty 状态及内容版本，只在有未保存本地修改时 flush；外部变更到达而本地 dirty 时提示冲突或保留双版本供选择。至少覆盖“两页先后编辑、A 聚焦时 B 保存、A 隐藏”的测试。

### P1-3 本地存储写失败被统一吞掉

**证据**：[`storage.ts`](../src/services/storage.ts) 第 33–39 行把 `chrome.storage.local.set` 异常完全忽略；[`quickSlice.ts`](../src/store/quickSlice.ts) 第 95–256 行多处先更新内存、再 `void setLocal(...)`。便签保存和 UI 偏好也沿用该接口。

**影响**：配额或环境错误时，页面显示操作已完成，刷新后数据却回退。`initQuick` 的种子标记与数据写入也无法辨别失败。

**建议**：`setLocal` 返回失败结果或抛错，让重要数据（快捷访问、便签）显示保存失败并保持可重试状态；纯展示偏好可选择静默回退。按键区分处理策略，避免给所有调用方加一套重型事务框架。

### P2-1 标签激活事件缺少窗口过滤

**证据**：[`tabsSlice.ts`](../src/store/tabsSlice.ts) 第 112–124 行创建事件会按 `selfWindowId` 过滤，而第 163–167 行 `chrome.tabs.onActivated` 对所有窗口的事件都遍历本页标签并修改 `active`。

**影响**：切换另一 Chrome 窗口的标签时，本窗口列表的激活标记可能全部消失。

**建议**：先判断 `info.windowId === selfWindowId` 再更新。增加双窗口事件单测或浏览器验证。

### P2-2 书签移动与重排的乐观状态可能被中途同步覆盖

**证据**：[`bookmarksSlice.ts`](../src/store/bookmarksSlice.ts) 第 181–184 行任何 `onMoved` 都计划 70 ms 后全量同步；第 598–669 行批量移动和排序逐条 `await Bookmarks.moveNode(...)`，操作期间仍可能收到中间态事件；失败时还把旧的整树 `snapshot` 写回，然后再次全量同步。

**影响**：书签多、Chrome API 较慢或多页并发时，界面可能闪回中间顺序；旧快照短暂覆盖外部新变更。这里是由时序推导的风险，尚未在真实 Chrome 复现。

**建议**：给本地批量移动一个操作边界，期间合并移动事件，结束后做一次权威同步；失败时优先重新读取 Chrome 状态，避免把旧整树长期作为事实来源。补“连续移动 + 外部变更 + 单步失败”时序测试。

## 3. 性能与扩展性

### P2-3 大书签库下，树和网格有重复遍历与全量渲染

**证据**：[`BookmarkTree.tsx`](../src/components/BookmarkTree.tsx) 第 164–169 行在 `bm` 或折叠状态变化时扫描文件夹并重建所有可见行，第 199–215 行全部渲染。默认全部展开。[`BookmarkGrid.tsx`](../src/components/BookmarkGrid.tsx) 第 9–24 行每个子文件夹 chip 都以 `countOf(s.bm, id)` 订阅子树计数；第 59–64 行提取当前文件夹条目，第 175–178 行全部渲染。每张卡片又注册拖拽及落点，且使用 Motion `layout`（[`BookmarkCard.tsx`](../src/components/BookmarkCard.tsx) 第 97–105 行）。

**影响**：几百到几千条、深层目录或单目录大量卡片时，书签树更新和选中/拖拽会放大计算、React 节点和 DOM 数量。现有代码没有性能阈值或虚拟列表；具体卡顿程度尚未实测。

**建议**：先在 500/2,000/10,000 条书签场景测首次打开、切换文件夹、折叠树和拖拽。优先把子树计数与可见行作为一次派生结果计算，避免每个 chip 重走子树；对单文件夹卡片数超过实测阈值时再引入虚拟列表。虚拟化要先验证拖拽命中和滚动，否则收益可能被交互回归抵消。

### P2-4 网格空白处拖拽命中每次读取所有卡片布局

**证据**：[`dnd.ts`](../src/dnd/dnd.ts) 第 121–142 行 `nearestCell` 对每张卡片调用 `getBoundingClientRect()`；第 295–313 行 pane 的 `getData` 会取全部 cells；[`BookmarkGrid.tsx`](../src/components/BookmarkGrid.tsx) 第 70–75 行的 `getCells` 每次执行 `querySelectorAll`。标签面板也使用相同路径。

**影响**：网格卡片越多，指针移动时 DOM 查询和布局读取越多，可能让拖拽掉帧。这是明确的热路径，但没有帧率数据。

**建议**：按一次拖拽或一次布局变化缓存卡片矩形，滚动/缩放/网格变化时失效；先用 Performance 面板确认该路径占比，再决定是否采用行列定位。保持卡片缝隙、首张左侧和最后一行空位的现有命中语义。

### P2-5 分隔条每个鼠标事件都写存储

**证据**：[`Splitter.tsx`](../src/components/Splitter.tsx) 第 17–25 行 `mousemove` 调用 `setPanelWidth`；[`uiSlice.ts`](../src/store/uiSlice.ts) 第 119–123 行每次调用都更新 Zustand 并 `chrome.storage.local.set`。便签宽度同理：[`NotePanel.tsx`](../src/components/NotePanel.tsx) 第 208–218 行与 [`notesSlice.ts`](../src/store/notesSlice.ts) 第 45–52 行。

**影响**：拖动一秒可触发大量异步写入与订阅通知，并让其他扩展页面反复更新。当前只对便签相同宽度做去重，仍可能随每像素写入。

**建议**：拖动期间只更新视觉状态，按动画帧节流；鼠标松开时落库最终值。若要跨页实时跟手，再用低频节流写入。验证松手后的持久化和窗口失焦中断情形。

### P2-6 搜索每次输入全库扫描并为每个节点求路径

**证据**：[`bookmarkSearch.ts`](../src/lib/bookmarkSearch.ts) 第 16–52 行每次查询遍历全部节点，在匹配判定前对每个节点调用 `pathOf`，最后排序所有命中；[`BookmarkSearchModal.tsx`](../src/components/BookmarkSearchModal.tsx) 第 34 行每次 `q` 变化执行搜索。

**影响**：大型书签库输入时重复计算路径、域名和排序。搜索结果虽只显示 80 条，计算阶段仍处理全库。

**建议**：先把 `pathOf` 延迟到命中后；再视测量结果决定是否缓存小写标题/域名/父路径或对输入做短防抖。保留现有相关性排序和即时反馈。

### P3-1 主包较大，但应按首屏使用情况拆分

**证据**：[`App.tsx`](../src/components/App.tsx) 第 5–14 行静态引入搜索、导入、帮助等弹层及便签；本次构建的单 JS chunk 为 588.21 kB（gzip 180.95 kB），触发 Vite 的 500 kB 警告。

**建议**：在真实扩展页测解析/执行与首屏可交互时间；若主包确为瓶颈，优先动态加载首次使用才打开的搜索、导入、帮助弹层，并保持打开时的短暂加载反馈。不要只为消除警告而机械拆包。

## 4. 结构、职责与可维护性

| 优先级 | 观察与证据 | 建议边界 |
| --- | --- | --- |
| P2 | [`bookmarksSlice.ts`](../src/store/bookmarksSlice.ts) 同时负责事件订阅、选中、草稿编辑、删除/撤销、导入、跨区复制和移动；约 727 行。 | 保留 slice 作为状态入口，先抽“删除与撤销”流程，再抽“批量创建/移动”服务；纯树计算继续放 `bookmarkTree.ts`。每抽一块先有失败时序测试。 |
| P2 | [`dnd.ts`](../src/dnd/dnd.ts) 同时定义拖拽数据、注册 hooks、几何命中、指示器和业务 drop 路由；约 700 行。 | 按 `types/geometry`、`registration`、`dropActions` 拆职责；drop 路由只派发动作，不自行复制书签业务逻辑。保持同一全局 monitor。 |
| P3 | [`QuickSites.tsx`](../src/components/QuickSites.tsx) 集磁贴、分组 tab 拖拽、增改表单、列表渲染于一个组件；约 400 行。 | 提取分组标签/表单为局部组件或 hook，保留 `QuickSites` 负责组合和筛选；不要把小型纯展示磁贴再过细拆分。 |
| P3 | [`theme.css`](../src/styles/theme.css) 约 2,250 行，按主题、面板、树、卡片、弹层、便签等已有段落排列。 | 按现有段落拆成少量 CSS 模块并由一个入口按原顺序导入；先做视觉回归，避免改变层叠顺序。变量和跨组件通用规则留在基础层。 |
| P3 | [`技术方案.md`](../技术方案.md) 描述 Vite 7、Motion 12 以及早期目录规划；当前 [`package.json`](../package.json) 是 Vite 8、Motion 13，部分组件路径也已变化。根目录 [`index.html`](../index.html) 仍是旧 demo，开发服务已在 [`vite.config.ts`](../vite.config.ts) 重定向。 | 将技术方案标为历史设计，补一页当前架构/运行入口说明；不要按旧目录规划重构现有实现。 |

## 5. 建议实施顺序与验收

1. **数据正确性**：先修批量删除/撤销、便签多页冲突、存储写失败；模拟部分 API 失败及两页交错保存。验收是失败后状态与可恢复记录一致，刷新后数据不“悄悄消失”。
2. **事件一致性**：修 `onActivated` 窗口过滤；为批量移动明确同步边界。验收覆盖双窗口、两新标签页、连续移动和失败回读。
3. **性能基线**：在真实 Chrome 扩展页用 500/2,000/10,000 条书签、单文件夹 300/1,000 张卡片测交互延迟、长任务和拖拽帧率；保留测量前后记录。优先优化计数、搜索路径、拖拽几何与宽度持久化。
4. **按职责拆分**：在上述行为有测试保护后逐块拆 `bookmarksSlice.ts` 和 `dnd.ts`，最后整理 QuickSites/CSS。每一步只调整一个边界，保持数据契约和拖拽语义。

**本次验证边界**：类型检查、现有单测和生产构建都通过；没有运行真实 Chrome 扩展，也没有采集 CPU、内存或帧率。性能项是源码热路径推断，需以第 3 步实测决定最终方案和阈值。
