import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const repo = process.argv[2]
if (!repo) throw new Error('Usage: node build-agent-explorer.mjs <repo>')
const outDir = path.join(repo, '.agents', 'explorer')

const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

function inline(text) {
  let value = escapeHtml(text)
  value = value.replace(/`([^`]+)`/g, '<code>$1</code>')
  value = value.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  value = value.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="source-link" title="$2">$1</span>')
  return value
}

function markdownToHtml(markdown) {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n')
  const output = []
  let paragraph = []
  let list = null
  let code = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    output.push(`<p>${inline(paragraph.join(' '))}</p>`)
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    output.push(`<${list.type}>${list.items.map(item => `<li>${inline(item)}</li>`).join('')}</${list.type}>`)
    list = null
  }

  for (const line of lines) {
    if (code) {
      if (/^```/.test(line)) {
        output.push(`<pre><code class="language-${escapeHtml(code.lang)}">${escapeHtml(code.lines.join('\n'))}</code></pre>`)
        code = null
      } else code.lines.push(line)
      continue
    }
    const fence = line.match(/^```\s*([\w-]*)/)
    if (fence) {
      flushParagraph(); flushList()
      code = { lang: fence[1], lines: [] }
      continue
    }
    const heading = line.match(/^(#{1,4})\s+(.+)/)
    if (heading) {
      flushParagraph(); flushList()
      const level = Math.min(4, heading[1].length + 1)
      output.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)/)
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)/)
    if (bullet || numbered) {
      flushParagraph()
      const type = numbered ? 'ol' : 'ul'
      if (list && list.type !== type) flushList()
      if (!list) list = { type, items: [] }
      list.items.push((bullet || numbered)[1])
      continue
    }
    if (/^>\s?/.test(line)) {
      flushParagraph(); flushList()
      output.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`)
      continue
    }
    if (/^\s*---+\s*$/.test(line)) {
      flushParagraph(); flushList(); output.push('<hr>'); continue
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushParagraph(); flushList(); output.push(`<div class="table-row">${inline(line)}</div>`); continue
    }
    if (!line.trim()) {
      flushParagraph(); flushList(); continue
    }
    paragraph.push(line.trim())
  }
  flushParagraph(); flushList()
  if (code) output.push(`<pre><code>${escapeHtml(code.lines.join('\n'))}</code></pre>`)
  return output.join('\n')
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await walk(full))
    else files.push(full)
  }
  return files
}

function parseFrontmatter(source) {
  if (!source.startsWith('---\n')) return { attributes: {}, body: source }
  const end = source.indexOf('\n---\n', 4)
  if (end === -1) return { attributes: {}, body: source }
  const attributes = {}
  for (const line of source.slice(4, end).split('\n')) {
    const match = line.match(/^([\w-]+):\s*(.*)$/)
    if (match) attributes[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
  return { attributes, body: source.slice(end + 5) }
}

const skillGuides = {
  'dsh-archive-agent-notes': {
    group: 'Knowledge', zh: 'Agent Note 生命周期管理员',
    work: ['读取 Note 与 archive 合约', '按未来决策价值检查 supersession', '保留、归档、拒绝或删除完整 triplet', '修复入链并封存 manifest', '运行 archive、doc-sync 与 lint 验证'],
    input: '待新增、审计或归档的 Agent Notes', output: '保持权威边界清晰、历史冻结可追溯的 Note 树', guard: '绝不按字数或配额归档；archived 快照永不再编辑。',
  },
  'dsh-code-review': {
    group: 'Review', zh: 'DeepSeek Harness PR 独立审查',
    work: ['核验 PR 的 live base 与 exact head', '运行 change-scope 建立影响面', '追踪接口两端、生命周期和安全边界', '核对 Agent Notes、文档与测试证据', '按缺陷、位置、影响、证据输出 finding'],
    input: 'PR、diff、base/head revision', output: '可定位、可复核、按严重度排序的 review findings', guard: '不把绿色 gate 当作语义正确证明，也不把 Agent Note 分歧自动当 blocker。',
  },
  'dsh-doc-site-sync': {
    group: 'Docs', zh: '文档站投影与同步',
    work: ['确认 canonical Markdown 与双语配对', '分类为编辑、发布、移动或站点结构变更', '更新 website/docs.ts 显式 allowlist', '检查投影后的链接与资源路径', '运行 docs:check、doc-sync 与链接检查'],
    input: '需要发布或调整的仓库文档', output: '由 canonical Markdown 正确投影出的 VitePress 页面', guard: '不直接编辑 website/.generated，也不把站点专用路径写回 canonical docs。',
  },
  'dsh-doc-standards': {
    group: 'Docs', zh: '文档结构与信息层级审计',
    work: ['定位文档在知识树中的职责', '确定允许的细节层级', '区分 tutorial 与 reference', '查重、查叙事泄漏与手工目录', '运行预算、链接、配对与 prose 检查'],
    input: '待编写、移动或审计的文档范围', output: '职责单一、可导航、不过度重复的文档结构', guard: 'archived Notes 和生成目录不进入日常编辑；长度只是线索，不是缺陷。',
  },
  'dsh-find-simplifications': {
    group: 'Architecture', zh: '删除优先的简化发现器',
    work: ['建立生产消费者与行为证据', '识别无消费者的 seam、配置和兼容层', '区分真正删除与换一种抽象', '为非平凡简化写 proposed Note', '用负向测试证明能力已完整移除'],
    input: '需要瘦身的包、能力或公共接口', output: '有证据、有放弃项、有重引入条件的简化方案', guard: '不把重构或依赖替换冒充简化；先证明没有生产消费者。',
  },
  'dsh-merging-stacked-prs': {
    group: 'Delivery', zh: 'Stacked PR 合并编排',
    work: ['读取 live stack 拓扑与每个 PR head', '自底向上确认 review、CI 和依赖', '逐层合并并等待 GitHub 状态收敛', '必要时 retarget 后重新核验 diff', '检查最终分支与 issue 状态'],
    input: '一组相互依赖的 GitHub PR', output: '按依赖顺序安全落地、状态收敛的 PR stack', guard: '每一次 head 或 base 变化都会使旧证据失效；禁止凭缓存状态继续。',
  },
  'dsh-pre-push-checks': {
    group: 'Quality', zh: '按变更影响面选择 pre-push gates',
    work: ['验证 base 并运行 change-scope', '把脏路径映射到 gate families', '先跑快速本地检查', '按平台与变更类型补充重型检查', '只报告实际执行的命令和结果'],
    input: '当前分支相对已核验 base 的变更', output: '与影响面匹配的最小充分验证集合', guard: '不机械运行所有 gate，也不以快照或 lint 替代真实入口验证。',
  },
  'dsh-prose-standard': {
    group: 'Docs', zh: '代码与文档的契约化写作标准',
    work: ['确认明确 scope 与编辑权限', '枚举段落中的完整 proposition', '保留 actor、条件、时序和后果', '删除推理过程、复述和装饰', '按 prose 所在位置补足必要契约并验证'],
    input: 'Markdown、JSDoc、注释、prompt、诊断或可见字符串', output: '从 HEAD 可独立理解、事实完整且简洁的 prose', guard: 'vendor 与 archived Notes 永远排除；不能为了变短而削弱事实。',
  },
  'dsh-translate-docs': {
    group: 'Docs', zh: '双语文档配对与翻译',
    work: ['读取 pairing contract 与术语表', '确认源语言和完整 proposition', '逐节保持结构与含义对齐', '最小化更新 counterpart', '重录 sidecar 并运行 translation gates'],
    input: '明确点名的英中翻译或双语更新任务', output: '结构、术语、链接和事实对齐的文档 pair', guard: '只在用户显式调用时运行；不顺手翻译无关文件。',
  },
  'dsh-trim-cot-leakage': {
    group: 'Docs', zh: '清理文档里的推理轨迹泄漏',
    work: ['用 HEAD 可解析性测试定位泄漏', '按八类 taxonomy 判断命中', '先枚举仍需保留的事实命题', '从仓库视角重写或删除空叙事', '重新运行 recall batteries 与文档 gates'],
    input: '疑似包含 review 对话、旧版本叙事或推理过程的 prose', output: '不依赖会话上下文、可在仓库独立验证的文字', guard: '保留 issue、标准和 Agent Note 中合法的历史证据；不误删契约。',
  },
  'record-browser-gif': {
    group: 'Media', zh: '真实浏览器流程 GIF 证据制作',
    work: ['固定待证明的 commit 与真实运行环境', '设计 3–6 个有语义的界面状态', '用浏览器按唯一状态条件截图', '确定性编码并检查成品 GIF', '仅在任务要求时发布到 assets branch'],
    input: '需要演示的浏览器工作流或 GUI PR', output: '带 commit 与运行来源说明的可复核 GIF', guard: '不能用 mock 冒充真实模型流程；录制与远程发布严格分离。',
  },
}

// Map references to the legacy, now-unavailable repository name to the current
// canonical name, so generated pages never trip the public-repository-links gate.
const canonicalizeRepoReferences = value => String(value).replace(/deepseek-ai\/deepseek-harness-sdk/gi, 'deepseek-ai/deepseek-harness')

const skillFiles = (await walk(path.join(repo, '.agents', 'skills')))
  .filter(file => file.endsWith('/SKILL.md')).sort()
const skills = []
for (const file of skillFiles) {
  const raw = canonicalizeRepoReferences(await readFile(file, 'utf8'))
  const { attributes, body } = parseFrontmatter(raw)
  const name = attributes.name || path.basename(path.dirname(file))
  const guide = skillGuides[name] || { group: 'Other', zh: name, work: [], input: '见原文', output: '见原文', guard: '见原文' }
  skills.push({ name, description: attributes.description || '', source: path.relative(repo, file), html: markdownToHtml(body), ...guide })
}

const noteFiles = (await walk(path.join(repo, '.agents', 'notes')))
  .filter(file => file.endsWith('.md'))
  .filter(file => !file.endsWith('.zh.md'))
  .filter(file => !['README.md', 'AGENTS.md', 'CLAUDE.md'].includes(path.basename(file)))
  .sort()

const notes = []
for (const file of noteFiles) {
  const raw = canonicalizeRepoReferences(await readFile(file, 'utf8'))
  const rel = path.relative(repo, file).split(path.sep).join('/')
  const parts = rel.split('/')
  const archived = parts[2] === 'archived'
  const lifecycle = archived ? 'archived' : parts[2]
  const category = archived ? parts[3] : parts[3]
  const filename = path.basename(file)
  const date = filename.slice(0, 10)
  const title = raw.match(/^# Agent Note:\s*(.+)$/m)?.[1]?.trim() || filename.slice(11, -3)
  const statusLine = raw.match(/^Status:\s*(.+)$/m)?.[1]?.trim() || lifecycle
  const status = statusLine.startsWith('rejected') ? 'rejected' : statusLine.startsWith('proposed') ? 'proposed' : 'implemented'
  const archivedDate = raw.match(/^Archived:\s*(.+)$/m)?.[1]?.trim() || ''
  const problem = raw.match(/## Problem\n+([\s\S]*?)(?=\n## |$)/)?.[1]?.replace(/\s+/g, ' ').trim() || ''
  const body = raw.replace(/^# Agent Note:.*\n+Status:.*\n+(?:Archived:.*\n+)?/m, '')
  notes.push({ date, title, status, statusLine, lifecycle, category, archived, archivedDate, source: rel, summary: problem.slice(0, 360), html: markdownToHtml(body) })
}
notes.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))

const groupLabels = { Knowledge: '知识治理', Review: 'Review', Docs: '文档系统', Architecture: '架构简化', Delivery: '交付', Quality: '质量', Media: '视觉证据', Other: '其他' }
const categoryLabels = { feature: 'Feature', architecture: 'Architecture', 'bug-fix': 'Bug fix', process: 'Process', simplification: 'Simplification', testing: 'Testing' }

const commonStyles = `
:root{color-scheme:dark;--bg:#080b10;--panel:#0f141d;--panel2:#151c27;--ink:#edf2f8;--muted:#8d99a8;--line:#273142;--blue:#55a6ff;--green:#33d17a;--red:#ff5b68;--amber:#f5b942;--radius:18px;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 50% -15%,#14243c 0,transparent 34rem),var(--bg);color:var(--ink);line-height:1.6}button,input,select{font:inherit;color:inherit}.shell{width:min(1440px,calc(100% - 40px));margin:auto}.eyebrow{font:700 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.18em;color:var(--blue)}.site-nav{height:66px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ffffff12}.brand{font-weight:750;letter-spacing:-.02em}.brand span{color:var(--blue)}.site-nav a{color:var(--muted);text-decoration:none;margin-left:22px;font-size:14px}.site-nav a.active,.site-nav a:hover{color:var(--ink)}.hero{padding:80px 0 54px;max-width:900px}.hero h1{font-size:clamp(42px,6.6vw,84px);line-height:.96;letter-spacing:-.065em;margin:14px 0 26px}.hero p{font-size:clamp(17px,2vw,22px);max-width:760px;color:#b8c2ce}.metrics{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.metric{background:#ffffff08;border:1px solid #ffffff12;border-radius:999px;padding:8px 14px;color:var(--muted);font-size:13px}.metric b{color:var(--ink);margin-right:4px}.toolbar{position:sticky;top:0;z-index:30;background:#080b10e8;backdrop-filter:blur(18px);border-block:1px solid #ffffff12;padding:14px 0}.controls{display:flex;gap:10px;align-items:center;overflow-x:auto}.control{border:1px solid #ffffff18;background:#111722;border-radius:12px;min-height:42px;padding:0 13px;outline:none}.control:focus{border-color:var(--blue);box-shadow:0 0 0 3px #55a6ff20}.search{min-width:270px;flex:1}.pill{cursor:pointer;white-space:nowrap}.pill:hover{background:#192232}.count{margin-left:auto;color:var(--muted);font:12px ui-monospace,monospace;white-space:nowrap}.markdown{color:#c9d2dc;font-size:14px}.markdown h2,.markdown h3,.markdown h4{color:var(--ink);line-height:1.25;margin:1.7em 0 .6em}.markdown h2{font-size:20px}.markdown h3{font-size:16px}.markdown p{margin:.75em 0}.markdown code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;background:#05070b;border:1px solid #ffffff12;padding:2px 5px;border-radius:6px}.markdown pre{padding:15px;overflow:auto;background:#05070b;border:1px solid #ffffff12;border-radius:12px}.markdown pre code{border:0;padding:0;background:none}.markdown blockquote{margin:1em 0;padding:1px 15px;border-left:3px solid var(--blue);background:#55a6ff0a;color:#b8c7d8}.markdown hr{border:0;border-top:1px solid var(--line);margin:24px 0}.markdown .source-link{color:#7db9ff;text-decoration:underline;text-decoration-color:#7db9ff55}.table-row{font:12px ui-monospace,monospace;white-space:pre-wrap;background:#ffffff05;padding:4px 8px}.footer{padding:70px 0 46px;color:#647184;font-size:12px;border-top:1px solid #ffffff0e;margin-top:80px}@media(max-width:640px){.shell{width:min(100% - 24px,1440px)}.hero{padding:52px 0 38px}.site-nav a{margin-left:12px}.search{min-width:210px}}
`

function pageHead(title, extraStyles='') {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escapeHtml(title)}</title><style>${commonStyles}${extraStyles}</style></head>`
}

function nav(active) {
  return `<nav class="site-nav"><div class="brand"><span>DSH</span> / Agent Explorer</div><div><a class="${active==='skills'?'active':''}" href="skills.html">Skills</a><a class="${active==='timeline'?'active':''}" href="timeline.html">Timeline</a></div></nav>`
}

const skillsStyles = `
.group-strip{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:30px}.group-dot{border:1px solid #ffffff12;background:#ffffff06;border-radius:999px;padding:7px 12px;color:var(--muted);font-size:12px}.skills-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;padding-top:36px}.skill-card{background:linear-gradient(145deg,#121925,#0d121a);border:1px solid #ffffff14;border-radius:22px;overflow:hidden;box-shadow:0 16px 50px #0005}.skill-card[hidden]{display:none}.card-top{padding:24px}.skill-id{font:11px ui-monospace,monospace;color:#71b4ff}.skill-card h2{font-size:25px;line-height:1.15;letter-spacing:-.035em;margin:10px 0 9px}.skill-card .desc{color:#9ca9b8;font-size:14px;min-height:68px}.flow{display:flex;gap:0;overflow-x:auto;margin:20px 0 4px;padding-bottom:4px}.flow-step{min-width:112px;max-width:150px;position:relative;padding:31px 10px 8px 0;font-size:11px;color:#b7c1cd}.flow-step:before{content:attr(data-n);position:absolute;top:0;left:0;width:23px;height:23px;border-radius:50%;display:grid;place-items:center;background:#16263a;border:1px solid #3779b8;color:#83c4ff;font:10px ui-monospace,monospace}.flow-step:not(:last-child):after{content:"";position:absolute;height:1px;background:#3779b8;top:12px;left:29px;right:6px}.io-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.io{border-radius:12px;background:#ffffff06;padding:12px}.io small{display:block;color:#6d7b8c;text-transform:uppercase;letter-spacing:.12em;font:9px ui-monospace,monospace}.io p{margin:5px 0 0;font-size:12px}.guard{margin:14px 0 0;padding:11px 13px;border-left:2px solid #f5b942;background:#f5b9420a;color:#d9c89d;font-size:12px}.disclose{width:100%;border:0;border-top:1px solid #ffffff10;background:#ffffff03;padding:14px 24px;text-align:left;cursor:pointer;color:#9eabb9}.disclose:hover{background:#ffffff08;color:white}.disclose:after{content:"＋";float:right}.skill-card.open .disclose:after{content:"−"}.source{display:none;padding:8px 24px 25px;border-top:1px solid #ffffff10}.skill-card.open .source{display:block}.source-path{font:10px ui-monospace,monospace;color:#607087;margin:10px 0 18px}@media(max-width:860px){.skills-grid{grid-template-columns:1fr}.skill-card .desc{min-height:0}}`

const skillsGroups = [...new Set(skills.map(s => s.group))]
const skillsCards = skills.map(skill => `<article class="skill-card" data-skill data-search="${escapeHtml(`${skill.name} ${skill.zh} ${skill.description} ${skill.group}`.toLowerCase())}" data-group="${skill.group}"><div class="card-top"><div class="skill-id">${escapeHtml(skill.name)}</div><h2>${escapeHtml(skill.zh)}</h2><p class="desc">${escapeHtml(skill.description)}</p><div class="flow">${skill.work.map((step,i)=>`<div class="flow-step" data-n="${i+1}">${escapeHtml(step)}</div>`).join('')}</div><div class="io-grid"><div class="io"><small>Input</small><p>${escapeHtml(skill.input)}</p></div><div class="io"><small>Output</small><p>${escapeHtml(skill.output)}</p></div></div><p class="guard">${escapeHtml(skill.guard)}</p></div><button class="disclose" aria-expanded="false">展开完整工作协议</button><div class="source"><div class="source-path">${escapeHtml(skill.source)}</div><div class="markdown">${skill.html}</div></div></article>`).join('')

const skillsHtml = `${pageHead('DeepSeek Harness · Skills',skillsStyles)}<body><div class="shell">${nav('skills')}<header class="hero"><div class="eyebrow">Repository-native workflows</div><h1>11 个 Skill，<br>11 种做事方式。</h1><p>这些 Skill 不是功能插件，而是仓库把经验固化成的操作协议：它们规定何时介入、先看什么、按什么顺序执行，以及什么事情绝不能省略。</p><div class="metrics"><span class="metric"><b>${skills.length}</b> Skills</span><span class="metric"><b>${skillsGroups.length}</b> Workflow families</span><span class="metric"><b>0</b> External dependencies</span></div></header><div class="group-strip">${skillsGroups.map(g=>`<span class="group-dot">${escapeHtml(groupLabels[g]||g)}</span>`).join('')}</div></div><div class="toolbar"><div class="shell controls"><input id="search" class="control search" type="search" placeholder="搜索 skill、场景或职责…" aria-label="搜索 skills"><select id="group" class="control" aria-label="按类别筛选"><option value="all">全部类别</option>${skillsGroups.map(g=>`<option value="${g}">${escapeHtml(groupLabels[g]||g)}</option>`).join('')}</select><button id="collapse" class="control pill">全部收起</button><span id="count" class="count">${skills.length} / ${skills.length}</span></div></div><main class="shell"><section class="skills-grid">${skillsCards}</section></main><footer class="footer"><div class="shell">Generated from <code>.agents/skills/*/SKILL.md</code> · Full source embedded · Offline ready</div></footer><script>(()=>{const cards=[...document.querySelectorAll('[data-skill]')],search=document.querySelector('#search'),group=document.querySelector('#group'),count=document.querySelector('#count');function filter(){const q=search.value.trim().toLowerCase(),g=group.value;let n=0;for(const c of cards){const show=(!q||c.dataset.search.includes(q))&&(g==='all'||c.dataset.group===g);c.hidden=!show;if(show)n++}count.textContent=n+' / '+cards.length}search.addEventListener('input',filter);group.addEventListener('change',filter);for(const c of cards)c.querySelector('.disclose').addEventListener('click',e=>{c.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(c.classList.contains('open')))});document.querySelector('#collapse').addEventListener('click',()=>{for(const c of cards){c.classList.remove('open');c.querySelector('.disclose').setAttribute('aria-expanded','false')}})})()</script></body></html>`

const counts = Object.fromEntries(['implemented','rejected','proposed'].map(state=>[state,notes.filter(n=>n.status===state).length]))
const lifecycleCounts = Object.fromEntries(['implemented','archived','proposed','rejected'].map(state=>[state,notes.filter(n=>n.lifecycle===state).length]))
const spanDays = Math.round((Date.parse(notes[notes.length - 1].date) - Date.parse(notes[0].date)) / 86400000) + 1
const notePayload = JSON.stringify(notes).replaceAll('<','\\u003c')
const timelineStyles = `
body:before{content:"";position:fixed;inset:0;background-image:linear-gradient(#ffffff04 1px,transparent 1px),linear-gradient(90deg,#ffffff04 1px,transparent 1px);background-size:48px 48px;mask-image:linear-gradient(to bottom,#0008,transparent 65%);pointer-events:none}.progress{position:fixed;z-index:50;top:0;left:0;height:2px;width:0;background:linear-gradient(90deg,var(--blue),var(--green));box-shadow:0 0 16px #55a6ff}.epochs{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:0 0 54px}.epoch{border-top:2px solid #33445b;padding:13px 8px 8px 0}.epoch b{display:block;font-size:13px}.epoch span{display:block;color:#728094;font-size:11px;margin-top:5px}.legend{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.legend span{font-size:12px;color:var(--muted)}.legend i{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}.legend .implemented{background:var(--green)}.legend .rejected{background:var(--red)}.legend .proposed{background:var(--amber)}.archive-note{margin:25px 0 0;padding:13px 16px;border:1px solid #55a6ff26;background:#55a6ff08;border-radius:12px;color:#91a8c3;font-size:12px}.timeline-wrap{position:relative;padding:48px 0 100px}.timeline-trunk{position:absolute;top:0;bottom:0;left:50%;width:2px;transform:translateX(-1px);background:linear-gradient(to bottom,#55a6ff22,#55a6ff,#33d17a,#55a6ff22);box-shadow:0 0 20px #55a6ff33}.day{position:relative;display:grid;grid-template-columns:1fr 74px 1fr;min-height:72px;margin:0 0 18px}.date-marker{grid-column:2;align-self:start;justify-self:center;position:sticky;top:78px;z-index:5;font:10px ui-monospace,monospace;color:#8899ad;background:#0b1017;border:1px solid #2c3b4e;padding:5px 7px;border-radius:999px;white-space:nowrap}.events{display:contents}.event{position:relative;width:calc(100% - 10px);margin:16px 0;--status:var(--green);--class:#5aa7ff}.event.left{grid-column:1;justify-self:end}.event.right{grid-column:3;justify-self:start}.event[data-status="rejected"]{--status:var(--red)}.event[data-status="proposed"]{--status:var(--amber)}.event[data-category="feature"]{--class:#62a8ff}.event[data-category="architecture"]{--class:#ab82ff}.event[data-category="bug-fix"]{--class:#ff7c89}.event[data-category="process"]{--class:#55c6d8}.event[data-category="simplification"]{--class:#f0a85d}.event[data-category="testing"]{--class:#8ac66a}.event:after{content:"";position:absolute;top:31px;width:47px;height:1px;background:linear-gradient(90deg,var(--class),var(--status))}.event.left:after{right:-47px}.event.right:after{left:-47px;transform:scaleX(-1)}.node{position:absolute;top:24px;width:15px;height:15px;border-radius:50%;background:var(--status);border:4px solid #0a0e14;box-shadow:0 0 0 2px var(--status),0 0 17px color-mix(in srgb,var(--status),transparent 50%);z-index:3}.event.left .node{right:-55px}.event.right .node{left:-55px}.note-card{border:1px solid #ffffff14;border-left:3px solid var(--status);border-radius:17px;background:linear-gradient(145deg,#121923,#0c1118);overflow:hidden;box-shadow:0 14px 45px #0005;transition:.18s ease}.note-card:hover{border-color:#ffffff25;transform:translateY(-1px)}.note-head{display:block;width:100%;border:0;background:none;text-align:left;padding:18px 19px;cursor:pointer}.note-meta{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:9px;font:10px ui-monospace,monospace;color:#75859a;text-transform:uppercase}.badge{border:1px solid #ffffff17;border-radius:999px;padding:2px 7px}.badge.status{color:var(--status);border-color:color-mix(in srgb,var(--status),transparent 67%)}.badge.category{color:var(--class)}.note-head h2{font-size:17px;line-height:1.28;letter-spacing:-.02em;margin:0;color:#e8edf4}.note-head p{font-size:12px;color:#8795a6;margin:9px 0 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.chevron{float:right;color:var(--status);font-size:20px;margin-left:10px}.note-card.open .chevron{transform:rotate(45deg)}.note-detail{display:none;border-top:1px solid #ffffff10;padding:6px 20px 24px}.note-card.open .note-detail{display:block}.source-path{font:10px ui-monospace,monospace;color:#617188;overflow-wrap:anywhere;margin:14px 0}.empty{display:none;text-align:center;padding:100px 0;color:var(--muted)}.empty.show{display:block}.top-button{position:fixed;right:20px;bottom:20px;z-index:40;width:42px;height:42px;border-radius:50%;border:1px solid #ffffff22;background:#131b26;cursor:pointer;box-shadow:0 12px 30px #0008}.top-button:hover{background:#1c2938}.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:940px){.day{grid-template-columns:38px 1fr}.timeline-trunk{left:18px}.date-marker{grid-column:1;transform:rotate(-90deg);transform-origin:center;margin-top:20px}.event.left,.event.right{grid-column:2;width:calc(100% - 28px);justify-self:start;margin-left:28px}.event.left:after,.event.right:after{left:-39px;right:auto;width:39px;transform:none}.event.left .node,.event.right .node{left:-47px;right:auto}.epochs{grid-template-columns:1fr}.epoch{display:grid;grid-template-columns:100px 1fr;gap:10px}.epoch span{margin:0}.note-head h2{font-size:16px}}@media(max-width:560px){.timeline-wrap{padding-top:30px}.day{grid-template-columns:26px 1fr}.timeline-trunk{left:12px}.date-marker{display:none}.event.left,.event.right{margin-left:20px;width:calc(100% - 20px)}.event.left:after,.event.right:after{left:-27px;width:27px}.event.left .node,.event.right .node{left:-35px}.note-head{padding:15px}.note-head p{display:none}.note-detail{padding-inline:15px}.epochs{margin-bottom:30px}}
`

const timelineHtml = `${pageHead('DeepSeek Harness · Evolution Timeline',timelineStyles)}<body><div id="progress" class="progress"></div><div class="shell">${nav('timeline')}<header class="hero"><div class="eyebrow">${notes.length} recorded decisions · ${spanDays} days</div><h1>Harness 是怎样<br>长成今天的。</h1><p>从事件溯源与微内核骨架，到工具、会话、协作、Web 界面和生产化约束。每个节点都来自真实 Agent Note；绿色是落地，红色是拒绝，琥珀色仍在提案中。</p><div class="metrics"><span class="metric"><b>${notes.length}</b> Notes</span><span class="metric"><b>${counts.implemented}</b> Implemented</span><span class="metric"><b>${counts.rejected}</b> Rejected</span><span class="metric"><b>${counts.proposed}</b> Proposed</span><span class="metric"><b>${lifecycleCounts.archived}</b> Archived</span></div><div class="archive-note">Archived 节点保持绿色，因为它们记录已经落地的决策；“Archived” 仅表示它们是冻结的历史快照，不再是当前行为的权威来源。</div></header><section class="epochs"><div class="epoch"><b>06.11—06.30</b><span>核心骨架：事件溯源、微内核、会话、工具与能力 seam</span></div><div class="epoch"><b>07.01—07.16</b><span>Agent 能力：Skill、MCP、Plan、Subagent、Sandbox、Harness loop</span></div><div class="epoch"><b>07.17—07.31</b><span>产品界面：TUI / Web、命令、队列、搜索、可观察性</span></div><div class="epoch"><b>08.01—08.10</b><span>模块化与协作：Preset、Agent Teams、Provider、工作流与调度</span></div><div class="epoch"><b>08.11—08.19</b><span>生产化：边界收紧、跨平台、性能、错误语义和交付治理</span></div></section><div class="legend"><span><i class="implemented"></i>Implemented / Archived</span><span><i class="rejected"></i>Rejected</span><span><i class="proposed"></i>Proposed</span></div></div><div class="toolbar"><div class="shell controls"><input id="search" class="control search" type="search" placeholder="搜索 title、problem 或 proposal…" aria-label="搜索 notes"><select id="status" class="control"><option value="all">全部状态</option><option value="implemented">已落地</option><option value="rejected">已拒绝</option><option value="proposed">提案中</option></select><select id="lifecycle" class="control"><option value="all">全部生命周期</option><option value="implemented">Active implemented</option><option value="archived">Archived</option><option value="proposed">Proposed</option><option value="rejected">Rejected</option></select><select id="category" class="control"><option value="all">全部类别</option>${Object.entries(categoryLabels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><button id="collapse" class="control pill">全部收起</button><span id="count" class="count">${notes.length} / ${notes.length}</span></div></div><main class="shell"><div id="timeline" class="timeline-wrap"><div class="timeline-trunk"></div></div><div id="empty" class="empty">没有匹配的 Agent Note。</div></main><button class="top-button" id="top" title="回到顶部" aria-label="回到顶部">↑</button><footer class="footer"><div class="shell">Generated from <code>.agents/notes/</code> · Full English Agent Note bodies embedded · Offline ready</div></footer><script type="application/json" id="notes-data">${notePayload}</script><script>(()=>{const notes=JSON.parse(document.querySelector('#notes-data').textContent),timeline=document.querySelector('#timeline'),search=document.querySelector('#search'),status=document.querySelector('#status'),lifecycle=document.querySelector('#lifecycle'),category=document.querySelector('#category'),count=document.querySelector('#count'),empty=document.querySelector('#empty');const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));for(const n of notes)n.search=(n.title+' '+n.summary+' '+n.statusLine+' '+n.category+' '+n.html.replace(/<[^>]+>/g,' ')).toLowerCase();function render(){const q=search.value.trim().toLowerCase(),s=status.value,l=lifecycle.value,c=category.value,visible=notes.filter(n=>(!q||n.search.includes(q))&&(s==='all'||n.status===s)&&(l==='all'||n.lifecycle===l)&&(c==='all'||n.category===c));const groups=new Map;for(const n of visible){if(!groups.has(n.date))groups.set(n.date,[]);groups.get(n.date).push(n)}let index=0;timeline.innerHTML='<div class="timeline-trunk"></div>'+[...groups].map(([date,items])=>'<section class="day"><div class="date-marker">'+date.slice(5)+'</div><div class="events">'+items.map(n=>{const side=index++%2?'right':'left';return '<article class="event '+side+'" data-status="'+n.status+'" data-category="'+n.category+'"><span class="node"></span><div class="note-card"><button class="note-head" aria-expanded="false"><span class="chevron">＋</span><span class="note-meta"><span>'+n.date+'</span><span class="badge status">'+esc(n.status)+'</span><span class="badge category">'+esc(n.category)+'</span>'+(n.archived?'<span class="badge">archived</span>':'')+'</span><h2>'+esc(n.title)+'</h2><p>'+esc(n.summary||n.statusLine)+'</p></button><div class="note-detail"><div class="source-path">'+esc(n.source)+'</div><div class="markdown" data-html="'+encodeURIComponent(n.html)+'"></div></div></div></article>'}).join('')+'</div></section>').join('');for(const card of timeline.querySelectorAll('.note-card'))card.querySelector('.note-head').addEventListener('click',e=>{const open=card.classList.toggle('open'),detail=card.querySelector('[data-html]');if(open&&!detail.dataset.loaded){detail.innerHTML=decodeURIComponent(detail.dataset.html);detail.dataset.loaded='1'}e.currentTarget.setAttribute('aria-expanded',String(open))});count.textContent=visible.length+' / '+notes.length;empty.classList.toggle('show',!visible.length)}for(const el of [search,status,lifecycle,category])el.addEventListener(el===search?'input':'change',render);document.querySelector('#collapse').addEventListener('click',()=>{for(const card of timeline.querySelectorAll('.note-card.open')){card.classList.remove('open');card.querySelector('.note-head').setAttribute('aria-expanded','false')}});document.querySelector('#top').addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));addEventListener('scroll',()=>{const max=document.documentElement.scrollHeight-innerHeight;document.querySelector('#progress').style.width=(max?scrollY/max*100:0)+'%'});render()})()</script></body></html>`

await mkdir(outDir, { recursive: true })
await writeFile(path.join(outDir, 'skills.html'), skillsHtml)
await writeFile(path.join(outDir, 'timeline.html'), timelineHtml)
console.log(JSON.stringify({ output: outDir, skills: skills.length, notes: notes.length, lifecycleCounts, statusCounts: counts }, null, 2))