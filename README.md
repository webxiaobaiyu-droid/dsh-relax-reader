# dsh-relax-reader

在 DeepSeek Harness 左侧导航打开「阅读」，整个主内容区就是搜索、书架与阅读器：搜一本，或粘贴一个小说页面地址，确认书名与目录后收藏，然后按章阅读。

这是一个 **DSH 双端插件**：Host 侧负责抓取、搜索、解析、目录与正文缓存、书架持久化；Client 侧注册左栏「阅读」入口，并把主内容区变成搜索、书架、解析预览与阅读器。

> 只做个人阅读；不批量抓取、不做全站下载，不把正文送进会话或模型上下文。

## 能做什么

- **多书库搜索，或者粘贴地址。** 按书名/作者同时搜索笔趣阁、蚂蚁阅读、就爱文学、若雨中文、唐三中文；同一本书命中多个站点时会合并为一条结果（标注「X 等 N 站」），首个站点解析失败会自动换下一个。也支持直接粘贴书籍详情页、目录页和带「目录」入口的章节页，从章节页添加时会回溯目录并把本章正文作为试读。
- **站点级适配。** 笔趣阁 `bq555.cc` 的详情页目录、章节页跳转和章节正文接口都做了适配；另外从微信分享的 Legado 书源里筛选出 4 个仍然可用的静态站点（蚂蚁阅读、就爱文学、若雨中文、唐三中文），按同样方式抓取完整目录与正文。目录常见 1000–1300 章，正文按整章读取，不只是一段试读。
- **书架。** 收藏、继续阅读、删除；最近阅读的排在前面。
- **按章阅读。** 目录页、上下章、章节位置与进度线；正文只按纯文本段落渲染。
- **阅读设置。** 字号 14–24px、三档行距、自动 / 浅色 / 护眼 / 深色四套主题，设置在章节间保持。
- **记得住。** 书架、目录、章节缓存和滚动位置写入本地 JSON；重启 DSH 后仍在。
- **失败说得清楚。** 非法地址、内网地址、抓取失败、页面不支持、无目录、无正文、存储失败都有独立文案。
- **抓取有边界。** 15 秒截止、5 MB 上限、最多 3 次重定向、逐跳 SSRF 校验、GBK/GB18030 解码、同域请求串行且间隔 500 ms。笔趣阁的签名 API 也走同一抓取通道。

## 安装到开发 profile

当前仓库按**源码 linked install**开发。需要：

- Node.js ≥ 20
- pnpm ≥ 10
- 一份 DeepSeek Harness 源码 checkout（提供 `@deepseek-ai/*` 类型与运行时包）

```bash
cd /path/to/dsh-relax-reader
pnpm install
DSH_SRC=/path/to/deepseek-harness pnpm run link:dsh
pnpm build
```

把插件装进 profile：

```bash
cd /path/to/deepseek-harness
node --import tsx/esm apps/cli/src/bin.ts plugin --profile novel-dev add \
  link:/path/to/dsh-relax-reader
```

启动开发实例：

```bash
node --import tsx/esm apps/cli/src/bin.ts --profile novel-dev --no-open --port 48999
```

打开终端打印的带 `?token=` 地址，然后点击左栏的「阅读」。主内容区会切换到阅读器，不占用对话会话。

## 本地开发

```bash
pnpm install
DSH_SRC=/path/to/deepseek-harness pnpm run link:dsh

pnpm typecheck   # Host / Client 分开编译检查
pnpm test        # parser / fetcher / store 测试
pnpm build       # lib/index.js + lib/client.js + 类型与 Typert 产物
```

修改 **Remote API 的方法或类型签名** 后，需要回到 DSH 源码用其 Typert generator 重新生成 `typert/` 下的两份产物；仅改 UI、解析器内部或实现逻辑时不需要。当前产物对应：

- `relaxReader.parseUrl`
- `relaxReader.saveBook`
- `relaxReader.listBooks`
- `relaxReader.getToc`
- `relaxReader.getChapter`
- `relaxReader.saveProgress`
- `relaxReader.removeBook`

所有方法最后一个参数都是 `AbortSignal`。

站点搜索走同源 Host 路由：`GET /api/dsh-relax-reader/search?q=<书名或作者>`，客户端不需要跨域访问小说站。

## 架构

```text
Client（sidebar.panellist + main，key = dsh-relax-reader）
  ReaderPage
    ├─ 书架：封面/书名/作者/继续阅读/删除
    ├─ 搜索：书名/作者 → 结果 → 解析预览
    ├─ 添加：URL → 解析 → 预览 → 收藏
    └─ 阅读：目录 / 正文 / 上下章 / 字号 / 行距 / 主题 / 进度
                 │
                 │ ctx.remote.relaxReader.*（Typert Remote）
                 ▼
Host（Cordis 插件）
  RelaxReaderService
    ├─ fetcher.ts   地址校验 / DNS / 重定向 / 大小 / 超时 / 编码 / 同域节流
    ├─ parser.ts    元数据 / 目录 / 正文 / 上下章 / 章节页回溯
    ├─ bqg.ts       笔趣阁搜索 / 令牌 / 完整目录 / 章节正文适配
    ├─ sources.ts   蚂蚁阅读 / 就爱文学 / 若雨中文 / 唐三中文 规则与解析
    ├─ search.ts    多书库结果排序 / 跨站合并 / 备用地址
    ├─ store.ts     JSON 原子写 + 写入串行化
    └─ index.ts     Remote 方法与预览置信度
                 │
                 ▼
$DSH_HOME/dsh-relax-reader/store.json
  { version: 1, books, toc, chapters }
```

### 解析策略

- 书名：`og:novel:book_name` → `og:title` → 标题/`h1` → 文档标题清理
- 作者：`og:novel:author` → `book:author` → 常见作者节点 → 文本「作者：」
- 封面：`og:image` → 常见封面选择器（含 `data-src`）
- 目录：常见章节列表选择器，按链接数量与同源比例选最像目录的一组
- 正文：`#content`、`.read-content`、`article` 等候选，按文本密度减去链接噪声评分
- 段落：保留 `p` / `div` / `br` 的块级边界，过滤站内广告与「请记住本站」类行
- 上下章：`rel=prev/next`、`#prev_url/#next_url`、常见类名，再回退到「上一章/下一章」文本
- 章节页添加：解析本章 + 找「目录」链接 + 抓目录 + 以本章正文作 sample

### 置信度

- `high`：书名、作者、≥3 章、且拿到了 ≥100 字的**章节正文**样本
- `medium`：书名 + ≥1 章（可能缺作者或正文样本）
- `low`：结构较弱；仍允许收藏，前端会提示检查目录

### 存储与隐私

- 路径：`$DSH_HOME/dsh-relax-reader/store.json`，默认 `~/.dsh/dsh-relax-reader/store.json`
- 首次启动会自动迁移改名前的旧书架目录；旧阅读设置也会继续沿用
- 原子写：同目录临时文件 + `rename`；写入队列串行，避免旧写覆盖新写
- 章节正文懒加载后缓存；删除书时一并删除目录与章节缓存
- 正文不写入 `session/event`，不作为工具结果或消息发送给模型

### 网络与安全

- 只允许 `http:` / `https:`，拒绝 URL 内嵌账号密码
- 解析 DNS，拒绝 loopback、RFC1918、链路本地、唯一本地 IPv6 等地址；每次重定向重新校验
- 某些本机透明代理会把公网域名解析到 `198.18.0.0/15`（Clash fake-IP），该段不视为内网；真正的私网段仍全部拒绝
- 限制 5 MB、15 秒、3 次重定向；同域请求串行，间隔 500 ms
- 正文以 React 文本节点渲染，不使用 `innerHTML` / `dangerouslySetInnerHTML`

## 已知限制

- 通用解析只支持服务端渲染的静态 HTML 站；目前对笔趣阁（`bq555.cc` / 当前 SPA 后端）和 4 个静态书库做了专门适配，其他 JS 站、App 签名接口（七猫、酷我、猫眼等）和 Cloudflare 挑战页仍会返回「页面不支持」。
- 新增的 4 个书库是同一套小说模板的镜像站，最近 1–2 章可能返回站方的反爬占位文本；旧章节正常。
- 笔趣阁的接口域名或签名规则、书库的域名跳转如果改版，站点适配需要跟着更新（书源里的旧域名已映射到当前域名）。
- 章节分页（“下一页”）暂不合并。
- 站点规则可视化覆盖编辑尚未实现；当前是通用规则 + 笔趣阁站点适配。
- 封面直接引用原站，可能有防盗链；没有封面代理缓存。
- 从章节页添加要求页面本身带有可识别的「目录」入口，否则无法建立书架目录。
- tarball 安装尚未在当前 DSH profile resolver 下验证；开发期使用 linked install。

## 测试

```text
tests/parser.host.spec.ts    9 项  元数据/目录/正文分段/章节页/噪声列表/稳定 id
tests/fetcher.host.spec.ts  14 项  SSRF/协议/编码/私网范围
tests/store.host.spec.ts     6 项  持久化/删除/恢复/迁移/进度
tests/bqg.host.spec.ts       6 项  笔趣阁令牌/URL/目录/正文清洗
tests/sources.host.spec.ts  10 项  书源识别/URL 归一/搜索行/目录去重/正文清洗
tests/search.host.spec.ts    5 项  结果排序/跨站合并/同站去重/备用地址
```

运行：

```bash
pnpm test
pnpm typecheck
pnpm build
```

## 许可

MIT。仅用于个人阅读；请遵守来源网站的服务条款与版权要求。
