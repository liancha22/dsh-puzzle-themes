#!/usr/bin/env node
/**
 * 生成 `index.json`——主题仓库的**唯一权威清单**。
 *
 *   node tools/build-index.mjs          # 写入 index.json
 *   node tools/build-index.mjs --check  # 只校验，不写（CI / 本地预跑用）
 *
 * 为什么必须有这个脚本（而不是手写 index.json）：
 * `index.json` 里的 `sha256` 是插件侧的**信任锚**——插件下载主题后拿它比对，
 * 不符就拒绝安装。手写就意味着「改完主题 CSS 忘了更新 hash」，而那个后果不是报错，
 * 是**所有用户都装不上**（插件会报「sha256 不匹配」，看起来像主题仓库被黑了）。
 * 让脚本从 theme.css 现算，这类漂移在机制上不可能发生。
 *
 * `--check` 是给发布流程用的：它把「清单与文件是否一致」变成一条可判定的命令，
 * 不写盘。仓库的 CI 与本地预跑都跑它——本仓的老教训是「守卫须能抓到漂移否则形同虚设」。
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const themesDir = join(root, 'themes')
const indexPath = join(root, 'index.json')

/** 与插件侧 `THEME_API_VERSION` 必须一致；不匹配插件会整批拒绝。 */
const API_VERSION = 1

const check = process.argv.includes('--check')

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

if (!existsSync(themesDir)) {
  console.error('找不到 themes/ 目录：' + themesDir)
  process.exit(1)
}

const ids = readdirSync(themesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const themes = []
const problems = []

for (const id of ids) {
  // id 必须是插件侧 THEME_ID_RE 认的形状：小写字母数字开头，允许 . _ -，≤64。
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id)) {
    problems.push(`themes/${id}：目录名不是合法主题 id（只允许小写字母数字开头，可含 . _ -）`)
    continue
  }
  const manifestPath = join(themesDir, id, 'manifest.json')
  const cssPath = join(themesDir, id, 'theme.css')
  if (!existsSync(manifestPath)) {
    problems.push(`themes/${id}：缺 manifest.json`)
    continue
  }
  if (!existsSync(cssPath)) {
    problems.push(`themes/${id}：缺 theme.css`)
    continue
  }
  let manifest = null
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    problems.push(`themes/${id}/manifest.json：不是合法 JSON —— ${error.message}`)
    continue
  }
  const css = readFileSync(cssPath, 'utf8')
  if (css.trim() === '') {
    problems.push(`themes/${id}/theme.css：是空文件`)
    continue
  }
  // 只做**最基础**的自查（完整白名单在插件侧，且那边才是权威）。
  // 这里拦的是「作者自己就写错了」的那一类，能在本地就报出来，不必等用户装失败。
  for (const [label, needle] of [['@import', '@import'], ['外部 url(', 'url(http'], ['javascript:', 'javascript:']]) {
    if (css.toLowerCase().includes(needle)) problems.push(`themes/${id}/theme.css：含 ${label}（插件侧会拒绝安装）`)
  }
  if (!/--dshpz-/.test(css)) problems.push(`themes/${id}/theme.css：没有声明任何 --dshpz-* 变量（应用了也不会有变化）`)

  themes.push({
    id,
    name: typeof manifest.name === 'string' && manifest.name !== '' ? manifest.name : id,
    author: typeof manifest.author === 'string' ? manifest.author : '',
    description: typeof manifest.description === 'string' ? manifest.description : '',
    version: typeof manifest.version === 'string' ? manifest.version : '',
    accent: typeof manifest.accent === 'string' ? manifest.accent : '',
    file: `themes/${id}/theme.css`,
    sha256: sha256(css),
  })
}

if (problems.length > 0) {
  console.error('主题仓库有问题：')
  for (const row of problems) console.error('  - ' + row)
  process.exit(1)
}

const next = {
  apiVersion: API_VERSION,
  updatedAt: new Date().toISOString().slice(0, 10),
  themes,
}
const text = JSON.stringify(next, null, 2) + '\n'

if (check) {
  const current = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : ''
  // 比内容而不是比字节：只忽略「末尾换行/时间戳」这类噪音会让守卫漏掉真漂移。
  const same = current === text
  if (!same) {
    console.error('index.json 与 themes/ 不一致——请跑 `node tools/build-index.mjs` 重新生成。')
    const cur = current === '' ? { themes: [] } : JSON.parse(current)
    const before = new Map((cur.themes || []).map((t) => [t.id, t.sha256]))
    for (const theme of themes) {
      const old = before.get(theme.id)
      if (old === undefined) console.error('  + 新增主题：' + theme.id)
      else if (old !== theme.sha256) console.error('  ~ hash 变了：' + theme.id)
    }
    for (const id of before.keys()) if (!themes.some((t) => t.id === id)) console.error('  - 已删除：' + id)
    process.exit(1)
  }
  console.log('index.json 与 themes/ 一致（' + themes.length + ' 套主题）')
  process.exit(0)
}

writeFileSync(indexPath, text)
console.log('已写入 index.json：' + themes.length + ' 套主题')
for (const theme of themes) console.log('  ' + theme.id + '  ' + theme.sha256.slice(0, 12) + '…  ' + theme.name)
