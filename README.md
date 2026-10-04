# dsh-puzzle-themes

`dsh-puzzle-mode` 插件的**主题仓库**。主题不在插件包里，只在你点「下载并应用」时从这里取。

插件默认源就是本仓：`liancha22/dsh-puzzle-themes`。也可以在插件的主题页里换成自己的源。

---

## 装一套主题

打开拼图面板 → 右上角主题图标 → 卡片上点「下载并应用」。完事。

插件会依次尝试 jsDelivr → gh-proxy → raw.githubusercontent 三个镜像（任一可用即可），
下载后按 `index.json` 里的 `sha256` 校验，不符就拒绝安装。

---

## 目录结构

```
index.json                  # 主题清单（由 tools/build-index.mjs 生成，别手改）
tools/build-index.mjs       # 从 themes/ 现算清单，含 sha256
themes/<id>/manifest.json   # 元数据
themes/<id>/theme.css       # 皮肤本身（唯一的实际内容）
```

`<id>` 必须是**小写字母或数字开头**，可含 `.` `_` `-`，最长 64 —— 它就是缓存文件名。

---

## 加一套主题

1. 复制 `themes/sakura/` 成 `themes/<你的id>/`；
2. 改 `manifest.json`（`name` / `description` / `accent` 必填，`accent` 用于列表卡片色块）；
3. 改 `theme.css`；
4. 跑 `node tools/build-index.mjs` 重算 `index.json`；
5. 提交。

发布前可以跑 `node tools/build-index.mjs --check` 自检：清单与文件不一致会退出码 1，
并逐条列出「新增 / hash 变了 / 已删除」。CI 里跑这一条就够了。

---

## theme.css 能写什么（**这是硬约束，插件会逐条校验**）

### 只允许 CSS

**不允许 JS。** 插件侧没有任何 JS 求值路径——主题带脚本也无法执行，
因为下载流程只认 `theme.css` 这一个文本文件。

### 会被拒绝的写法

| 写法 | 为什么拒 |
| --- | --- |
| `@import` | 能把外部资源拉进页面 |
| `url(http…)` / `url(//…)` | 外部请求：跟踪像素、远程字体、侧信道外带数据 |
| `javascript:` | 等于在 CSS 里执行 JS |
| `expression(…)` | 老 IE 的 CSS 表达式，同上 |
| 出现 `</` | 能提前闭合 `<style>`，把后面变成 HTML（注入） |
| 花括号不配平 | 后续规则会跑进别的规则里，静默破坏样式 |
| 选择器不含 `.dshpz-`（且不是 `:root`/`html`） | 越界：主题的作用域只有**面板 + 那颗小按钮** |
| `html.dark{…}` / `:root{color:red}` | 同上：`html`/`:root` 块里**只能声明 `--dshpz-*`** |
| 整份 CSS 没声明任何 `--dshpz-*` | 应用了也不会有变化，等于功能像坏的 |

`url(data:image/…)` 内联图是**允许**的（不产生外部请求）。

`@media` / `@supports` 可以写，里面的规则会被逐条按上表判。
`@keyframes` 可以写（里面的百分比不是 DOM 选择器）。

### 可以覆盖的令牌

面板所有颜色/尺度/字体/动效都走这 31 个变量，覆盖它们就够换一整套皮：

```
基底（默认吃宿主的 --dsw-alias-*，建议别写死）
  --dshpz-bg-1  --dshpz-bg-2  --dshpz-bg-3  --dshpz-bg-overlay
  --dshpz-label-1  --dshpz-label-2  --dshpz-label-3
  --dshpz-border-1  --dshpz-border-2
  --dshpz-brand  --dshpz-ok  --dshpz-warn  --dshpz-err

主色（主题的个性主要来自这里）
  --dshpz-accent  --dshpz-accent-hi  --dshpz-accent-lo  --dshpz-on-accent

玻璃与特效
  --dshpz-glass  --dshpz-glass-sheen  --dshpz-grid  --dshpz-glow  --dshpz-shadow

尺度与字体
  --dshpz-radius-sm  --dshpz-radius-md  --dshpz-radius-lg
  --dshpz-font-ui  --dshpz-font-mono

动效
  --dshpz-dur-in  --dshpz-dur-fast  --dshpz-ease-out  --dshpz-ease-std
```

`--dshpz-glass-sheen` 可以写 `none`，`--dshpz-grid` 可以写 `transparent` —— 都是合法值，
不必为「这套主题不要那个效果」写分支。

### 两条最容易翻车的经验

1. **`--dshpz-on-accent` 必须与 `--dshpz-accent` 明度相反。**
   主色亮（如 `#22d3ee`）就用深色前景；主色深就用浅色前景。写死 `#fff` 的后果是
   「白字压亮色」，几乎读不出来——这是主题最常见的翻车点。

2. **别把 `--dshpz-bg-*` / `--dshpz-label-*` 写死。**
   它们默认是宿主的语义令牌，所以宿主切浅色/深色时面板自动跟随。
   写死 `#111` 的主题在浅色宿主上会变成一块黑砖，而作者通常只在自己那台深色机器上试过。

### 可以直接改的类（结构微调）

作用域内所有 `.dshpz-*` 选择器都可以改，常用的几处：

| 类 | 是什么 |
| --- | --- |
| `.dshpz-panel` | 面板本体（玻璃底、描边、投影） |
| `.dshpz-head` / `.dshpz-title` / `.dshpz-sub` | 顶栏 |
| `.dshpz-btn` | 输入框左边那颗小按钮（`[data-on="1"]` 是打开态） |
| `.dshpz-col` | 三栏之一 |
| `.dshpz-tile` / `.dshpz-card` | 模块图块与条目卡片 |
| `.dshpz-tlayer` / `.dshpz-tcard` | 主题层与主题卡片 |
| `.dshpz-secttitle` | 分区小标题 |

> 这些类名是插件的**内部结构**，宿主改版时可能变。所以主题尽量只动变量，
> 少动结构选择器——变量是稳定的对外契约，类名不是。

---

## 许可

主题与插件同为 MIT。投稿请直接开 PR。
