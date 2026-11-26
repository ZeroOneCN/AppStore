/**
 * OpenAPI 描述的可视化 HTML 渲染器。
 * 浏览器直接访问 /api/openapi 时展示接口文档，工具与脚本仍可拿到 JSON。
 */

/** 渲染所需的松散类型 */
type LooseRecord = Record<string, unknown>;

/** 接口方法顺序 */
const METHOD_ORDER = ["get", "post", "put", "patch", "delete"] as const;

/**
 * HTML 转义，避免描述内容破坏页面结构。
 * @param value 原始文本
 * @returns 转义后的文本
 */
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * 生成锚点 ID。
 * @param method 请求方法
 * @param path 接口路径
 * @returns 安全的锚点
 */
function anchorId(method: string, path: string): string {
  return `${method}-${path}`.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

/**
 * 将类型定义转换为可读文本。
 * @param schema OpenAPI schema
 * @returns 类型文本
 */
function typeLabel(schema: LooseRecord | undefined): string {
  if (!schema) return "—";
  const type = schema.type;
  if (Array.isArray(type)) return type.filter((item) => item !== "null").join(" | ");
  if (typeof type === "string") return type;
  if (schema.$ref) return String(schema.$ref).split("/").pop() ?? "object";
  return "object";
}

/**
 * 解析 $ref 到组件定义。
 * @param schema 原始 schema
 * @param spec 完整描述
 * @returns 解析后的 schema
 */
function resolveSchema(schema: LooseRecord | undefined, spec: LooseRecord): LooseRecord {
  if (!schema) return {};
  const ref = schema.$ref;
  if (typeof ref === "string") {
    const name = ref.split("/").pop() ?? "";
    const schemas = ((spec.components as LooseRecord | undefined)?.schemas ?? {}) as LooseRecord;
    return (schemas[name] as LooseRecord | undefined) ?? {};
  }
  return schema;
}

/** 路径参数行 */
interface ParameterRow {
  name: string;
  location: string;
  required: boolean;
  type: string;
  description: string;
}

/**
 * 提取接口参数。
 * @param operation 接口定义
 * @param spec 完整描述
 * @returns 参数行
 */
function buildParameters(operation: LooseRecord, spec: LooseRecord): ParameterRow[] {
  const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];
  return parameters.map((item) => {
    const parameter = item as LooseRecord;
    const schema = resolveSchema(parameter.schema as LooseRecord | undefined, spec);
    const enumValues = Array.isArray(schema.enum) ? (schema.enum as unknown[]) : [];
    const baseType = typeLabel(schema);
    return {
      name: String(parameter.name ?? ""),
      location: String(parameter.in ?? "query"),
      required: Boolean(parameter.required),
      type: enumValues.length > 0 ? `${baseType}（${enumValues.join(" / ")}）` : baseType,
      description: String(parameter.description ?? ""),
    };
  });
}

/** 请求体字段 */
interface BodyRow {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

/**
 * 提取 JSON 请求体字段。
 * @param operation 接口定义
 * @param spec 完整描述
 * @returns 字段行
 */
function buildBodyFields(operation: LooseRecord, spec: LooseRecord): BodyRow[] {
  const requestBody = operation.requestBody as LooseRecord | undefined;
  if (!requestBody) return [];
  const content = (requestBody.content ?? {}) as LooseRecord;
  const json = (content["application/json"] ?? {}) as LooseRecord;
  const schema = resolveSchema(json.schema as LooseRecord | undefined, spec);
  const properties = (schema.properties ?? {}) as LooseRecord;
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  return Object.entries(properties).map(([name, value]) => {
    const field = value as LooseRecord;
    const enumValues = Array.isArray(field.enum) ? (field.enum as unknown[]) : [];
    return {
      name,
      type: enumValues.length > 0 ? `${typeLabel(field)}（${enumValues.join(" / ")}）` : typeLabel(field),
      required: required.includes(name),
      description: String(field.description ?? ""),
    };
  });
}

/**
 * 按标签分组接口。
 * @param spec 完整描述
 * @returns 分组后的接口列表
 */
function groupOperations(spec: LooseRecord): { tag: string; description: string; items: LooseRecord[] }[] {
  const tagDefinitions = Array.isArray(spec.tags) ? (spec.tags as LooseRecord[]) : [];
  const groups = new Map<string, { tag: string; description: string; items: LooseRecord[] }>();

  for (const definition of tagDefinitions) {
    const name = String(definition.name ?? "");
    groups.set(name, { tag: name, description: String(definition.description ?? ""), items: [] });
  }

  const paths = (spec.paths ?? {}) as LooseRecord;
  for (const [path, pathItem] of Object.entries(paths)) {
    const methods = pathItem as LooseRecord;
    for (const method of METHOD_ORDER) {
      const operation = methods[method] as LooseRecord | undefined;
      if (!operation) continue;
      const tags = Array.isArray(operation.tags) ? (operation.tags as string[]) : [];
      const tag = tags[0] ?? "default";
      if (!groups.has(tag)) groups.set(tag, { tag, description: "", items: [] });
      groups.get(tag)?.items.push({ ...operation, method, path });
    }
  }

  return [...groups.values()].filter((group) => group.items.length > 0);
}

/** 方法徽标颜色 */
const METHOD_STYLE: Record<string, string> = {
  get: "background:#e7f7ee;color:#0a7d3c;",
  post: "background:#e8f0ff;color:#1e51ee;",
  put: "background:#fff4e5;color:#9a5b00;",
  patch: "background:#f3ecff;color:#6b3fd4;",
  delete: "background:#ffecec;color:#c02626;",
};

/**
 * 渲染接口卡片。
 * @param operation 接口定义（含 method/path）
 * @param spec 完整描述
 * @returns HTML 片段
 */
function renderOperation(operation: LooseRecord, spec: LooseRecord): string {
  const method = String(operation.method ?? "get");
  const path = String(operation.path ?? "");
  const id = anchorId(method, path);
  const parameters = buildParameters(operation, spec);
  const bodyFields = buildBodyFields(operation, spec);
  const responses = (operation.responses ?? {}) as LooseRecord;
  const secured = Array.isArray(operation.security) && operation.security.length > 0;

  const parameterTable =
    parameters.length === 0
      ? ""
      : `<div class="table-wrap"><table>
          <thead><tr><th>参数</th><th>位置</th><th>类型</th><th>必填</th><th>说明</th></tr></thead>
          <tbody>${parameters
            .map(
              (row) => `<tr>
                <td><code>${escapeHtml(row.name)}</code></td>
                <td>${escapeHtml(row.location)}</td>
                <td>${escapeHtml(row.type)}</td>
                <td>${row.required ? '<span class="required">是</span>' : '<span class="muted">否</span>'}</td>
                <td>${escapeHtml(row.description) || '<span class="muted">—</span>'}</td>
              </tr>`,
            )
            .join("")}</tbody>
        </table></div>`;

  const bodyTable =
    bodyFields.length === 0
      ? ""
      : `<h4>请求体字段</h4>
        <div class="table-wrap"><table>
          <thead><tr><th>字段</th><th>类型</th><th>必填</th><th>说明</th></tr></thead>
          <tbody>${bodyFields
            .map(
              (row) => `<tr>
                <td><code>${escapeHtml(row.name)}</code></td>
                <td>${escapeHtml(row.type)}</td>
                <td>${row.required ? '<span class="required">是</span>' : '<span class="muted">否</span>'}</td>
                <td>${escapeHtml(row.description) || '<span class="muted">—</span>'}</td>
              </tr>`,
            )
            .join("")}</tbody>
        </table></div>`;

  const responseRows = Object.entries(responses)
    .map(([status, value]) => {
      const response = value as LooseRecord;
      return `<tr>
        <td><span class="status">${escapeHtml(status)}</span></td>
        <td>${escapeHtml(response.description ?? "") || '<span class="muted">—</span>'}</td>
      </tr>`;
    })
    .join("");

  return `<article class="endpoint" id="${id}">
    <div class="endpoint-head">
      <span class="method" style="${METHOD_STYLE[method] ?? ""}">${method.toUpperCase()}</span>
      <code class="path">${escapeHtml(path)}</code>
      <button type="button" class="copy" data-copy="${escapeHtml(path)}">复制</button>
      ${secured ? '<span class="lock">需登录</span>' : ""}
    </div>
    <p class="summary">${escapeHtml(operation.summary ?? "")}</p>
    ${operation.description ? `<p class="desc">${escapeHtml(operation.description)}</p>` : ""}
    ${parameters.length > 0 ? `<h4>查询参数</h4>${parameterTable}` : ""}
    ${bodyTable}
    ${
      responseRows
        ? `<h4>响应</h4><div class="table-wrap"><table>
            <thead><tr><th>状态码</th><th>说明</th></tr></thead>
            <tbody>${responseRows}</tbody>
          </table></div>`
        : ""
    }
  </article>`;
}

/**
 * 渲染完整的 OpenAPI 可视化页面。
 * @param spec OpenAPI 描述
 * @param base 当前部署根地址
 * @returns HTML 字符串
 */
export function renderOpenApiHtml(spec: LooseRecord, base: string): string {
  const info = (spec.info ?? {}) as LooseRecord;
  const groups = groupOperations(spec);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const jsonHref = `${escapeHtml(base)}/api/openapi?format=json`;

  const nav = groups
    .map(
      (group) => `<div class="nav-group">
        <p class="nav-title">${escapeHtml(group.tag)}<span>${group.items.length}</span></p>
        ${group.items
          .map(
            (operation) =>
              `<a href="#${anchorId(String(operation.method), String(operation.path))}">
                <span class="nav-method ${String(operation.method)}">${String(operation.method).toUpperCase()}</span>
                <span class="nav-path">${escapeHtml(operation.path)}</span>
              </a>`,
          )
          .join("")}
      </div>`,
    )
    .join("");

  const content = groups
    .map(
      (group) => `<section class="group">
        <div class="group-head">
          <h2>${escapeHtml(group.tag)}</h2>
          <p>${escapeHtml(group.description)}</p>
        </div>
        ${group.items.map((operation) => renderOperation(operation, spec)).join("")}
      </section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(info.title ?? "API")} · 接口文档</title>
<style>
  :root {
    --bg: #f5f5f7;
    --surface: #ffffff;
    --text: #1d1d1f;
    --muted: #6e6e73;
    --hairline: rgba(0,0,0,.08);
    --brand: #1e51ee;
    --radius: 22px;
  }
  * { box-sizing: border-box; }
  html { color-scheme: light; scroll-behavior: smooth; }
  body {
    margin: 0; color: var(--text); background: var(--bg);
    background-image: radial-gradient(120% 55% at 50% -10%, rgba(30,81,238,.10), rgba(30,81,238,0) 60%);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  a { color: inherit; text-decoration: none; }
  code, pre, .method { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
  .shell { width: 100%; max-width: 1240px; margin: 0 auto; padding: 0 24px; }
  header.hero { padding: 56px 0 24px; }
  .hero-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { width: 34px; height: 34px; border-radius: 9px; }
  .brand strong { font-size: 15px; letter-spacing: -.01em; }
  .hero-links { display: flex; align-items: center; gap: 10px; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    min-height: 38px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--hairline);
    background: rgba(255,255,255,.7); font-size: 13px; font-weight: 500; transition: .18s;
  }
  .btn:hover { background: #fff; }
  .btn.primary { background: var(--brand); border-color: var(--brand); color: #fff; }
  .btn.primary:hover { background: #1a44c9; }
  h1 { margin: 28px 0 10px; font-size: clamp(30px, 4vw, 44px); letter-spacing: -.035em; line-height: 1.08; }
  .lead { margin: 0; max-width: 720px; color: var(--muted); font-size: 15px; line-height: 1.8; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 999px; background: rgba(0,0,0,.04); font-size: 11px; color: #555; }
  .chip b { font-weight: 600; color: var(--text); }
  .base { margin-top: 14px; display: inline-flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 12px; background: #0b0d12; color: #e6e8ee; font-size: 12px; }
  .base code { color: #fff; }
  .base button { border: 0; background: rgba(255,255,255,.12); color: #fff; border-radius: 8px; padding: 4px 8px; font-size: 11px; cursor: pointer; }
  .layout { display: grid; gap: 28px; padding: 18px 0 64px; }
  @media (min-width: 960px) { .layout { grid-template-columns: 232px minmax(0,1fr); align-items: start; } }
  aside.toc { position: sticky; top: 20px; display: none; max-height: calc(100vh - 40px); overflow: auto; padding: 14px; border: 1px solid var(--hairline); border-radius: var(--radius); background: rgba(255,255,255,.7); backdrop-filter: blur(12px); }
  @media (min-width: 960px) { aside.toc { display: block; } }
  .nav-title { display: flex; justify-content: space-between; margin: 12px 8px 6px; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #9a9aa0; }
  .nav-title:first-child { margin-top: 4px; }
  .nav-title span { letter-spacing: 0; }
  aside.toc a { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 9px; font-size: 12px; color: #555; }
  aside.toc a:hover { background: rgba(0,0,0,.04); color: var(--brand); }
  .nav-method { font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 5px; background: #eee; }
  .nav-method.get { background: #e7f7ee; color: #0a7d3c; }
  .nav-method.post { background: #e8f0ff; color: #1e51ee; }
  .nav-method.put { background: #fff4e5; color: #9a5b00; }
  .nav-method.delete { background: #ffecec; color: #c02626; }
  .nav-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, monospace; }
  .group { margin-bottom: 26px; }
  .group-head h2 { margin: 0; font-size: 20px; letter-spacing: -.02em; }
  .group-head p { margin: 6px 0 14px; color: var(--muted); font-size: 13px; }
  .endpoint { padding: 18px; border: 1px solid var(--hairline); border-radius: var(--radius); background: rgba(255,255,255,.86); box-shadow: 0 1px 2px rgba(0,0,0,.03), 0 18px 40px -34px rgba(0,0,0,.4); margin-bottom: 14px; scroll-margin-top: 20px; }
  .endpoint-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .method { font-size: 11px; font-weight: 700; padding: 5px 9px; border-radius: 8px; }
  .path { font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
  .copy { margin-left: auto; border: 1px solid var(--hairline); background: #fff; border-radius: 8px; padding: 4px 9px; font-size: 11px; color: #666; cursor: pointer; }
  .copy:hover { color: var(--brand); border-color: rgba(30,81,238,.35); }
  .lock { font-size: 10px; padding: 4px 8px; border-radius: 999px; background: #eef3ff; color: #1e51ee; }
  .summary { margin: 12px 0 0; font-size: 14px; font-weight: 500; }
  .desc { margin: 6px 0 0; font-size: 12px; line-height: 1.7; color: var(--muted); }
  h4 { margin: 18px 0 8px; font-size: 12px; font-weight: 600; color: #444; }
  .table-wrap { overflow-x: auto; border: 1px solid var(--hairline); border-radius: 12px; }
  table { width: 100%; border-collapse: collapse; min-width: 520px; font-size: 12px; }
  th { text-align: left; font-weight: 500; color: var(--muted); background: rgba(0,0,0,.025); }
  th, td { padding: 9px 12px; border-bottom: 1px solid rgba(0,0,0,.05); vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  code { font-size: 11.5px; background: rgba(0,0,0,.05); padding: 1px 5px; border-radius: 5px; }
  .required { color: #b45309; font-weight: 500; }
  .muted { color: #a1a1a6; }
  .status { font-family: ui-monospace, monospace; font-weight: 600; color: #0a7d3c; }
  footer { border-top: 1px solid var(--hairline); padding: 22px 0 40px; color: #8e8e93; font-size: 11px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  @media (max-width: 640px) { header.hero { padding-top: 36px; } .shell { padding: 0 16px; } .endpoint { padding: 15px; } }
</style>
</head>
<body>
<header class="hero shell">
  <div class="hero-top">
    <div class="brand">
      <img src="/logo.svg" alt="" />
      <strong>应用仓库</strong>
    </div>
    <div class="hero-links">
      <a class="btn" href="/docs">接入指南</a>
      <a class="btn primary" href="${jsonHref}">原始 JSON</a>
    </div>
  </div>

  <h1>${escapeHtml(info.title ?? "API 参考")}</h1>
  <p class="lead">${escapeHtml(info.description ?? "")}</p>
  <div class="meta">
    <span class="chip">版本 <b>${escapeHtml(info.version ?? "1.0.0")}</b></span>
    <span class="chip">接口 <b>${total}</b></span>
    <span class="chip">分组 <b>${groups.length}</b></span>
    <span class="chip">规范 <b>OpenAPI 3.1</b></span>
  </div>
  <div class="base">
    <span>服务器</span>
    <code id="base">${escapeHtml(base)}</code>
    <button type="button" data-copy="${escapeHtml(base)}">复制</button>
  </div>
</header>

<div class="layout shell">
  <aside class="toc">${nav}</aside>
  <main>${content}</main>
</div>

<footer class="shell">
  <span>应用仓库 · API 参考</span>
  <span><a href="/docs">接入文档</a> · <a href="/apps">应用广场</a> · <a href="${jsonHref}">OpenAPI JSON</a></span>
</footer>

<script>
  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) return;
    var button = target.closest("[data-copy]");
    if (!button) return;
    var text = button.getAttribute("data-copy") || "";
    var done = function () {
      var previous = button.textContent;
      button.textContent = "已复制";
      setTimeout(function () { button.textContent = previous; }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      done();
    }
  });
</script>
</body>
</html>`;
}
