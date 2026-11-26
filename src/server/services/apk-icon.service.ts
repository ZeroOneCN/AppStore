import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import sharp from "sharp";
import yauzl from "yauzl";

/** 图标输出尺寸 */
const ICON_SIZE = 512;

/** 自适应图标画布尺寸（dp） */
const ADAPTIVE_SIZE = 108;

/** Android 密度目录排序权重，数值越大越清晰 */
const DENSITY_WEIGHT: Record<string, number> = {
  ldpi: 1,
  mdpi: 2,
  hdpi: 3,
  xhdpi: 4,
  xxhdpi: 5,
  xxxhdpi: 6,
  nodpi: 7,
  anydpi: 8,
};

/** 图标文件基础名匹配 */
const ICON_BASENAME = /^(ic_launcher|ic_launcher_round|app_icon|icon|logo)(_|$)/i;

/** AXML 属性 */
interface AxmlAttribute {
  name: string;
  typedValue: { value: unknown; type: string | null; rawType: number | null };
}

/** AXML 节点 */
interface AxmlNode {
  nodeName: string;
  attributes?: AxmlAttribute[];
  childNodes?: AxmlNode[];
}

/** AXML 文档解析器（复用 app-info-parser 内置实现） */
interface AxmlParser {
  parse(): AxmlNode;
}

/** resources.arsc 解析结果：@7F0C0000 → 资源路径或数值 */
type ResourceMap = Record<string, string | string[]>;

const requireInternal = createRequire(import.meta.url);
const BinaryXmlParser = requireInternal("app-info-parser/src/xml-parser/binary") as new (
  buffer: Buffer,
) => AxmlParser;
const ResourceFinder = requireInternal("app-info-parser/src/resource-finder") as new () => {
  processResourceTable(buffer: Buffer): ResourceMap;
};

/**
 * 读取 APK 内全部文件条目与大小。
 * @param filePath APK 绝对路径
 * @returns 文件名到解压后大小的映射
 */
function listZipEntries(filePath: string): Promise<Map<string, number>> {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) {
        reject(error ?? new Error("无法打开 APK"));
        return;
      }

      const entries = new Map<string, number>();
      let settled = false;
      const finish = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        try {
          zip.close();
        } catch {
          // 已关闭时忽略
        }
        fn();
      };

      zip.on("error", (zipError) => finish(() => reject(zipError)));
      zip.on("end", () => finish(() => resolve(entries)));
      zip.on("entry", (entry: yauzl.Entry) => {
        if (!entry.fileName.endsWith("/")) {
          entries.set(entry.fileName, entry.uncompressedSize);
        }
        zip.readEntry();
      });
      zip.readEntry();
    });
  });
}

/**
 * 批量读取 APK 内指定文件的内容，未命中的条目忽略。
 * @param filePath APK 绝对路径
 * @param names 需要读取的文件名集合
 * @returns 文件名到内容的映射
 */
function readZipEntries(filePath: string, names: Set<string>): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    if (names.size === 0) {
      resolve(new Map());
      return;
    }

    yauzl.open(filePath, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) {
        reject(error ?? new Error("无法打开 APK"));
        return;
      }

      const result = new Map<string, Buffer>();
      let settled = false;
      const finish = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        try {
          zip.close();
        } catch {
          // 已关闭时忽略
        }
        fn();
      };

      zip.on("error", (zipError) => finish(() => reject(zipError)));
      zip.on("end", () => finish(() => resolve(result)));
      zip.on("entry", (entry: yauzl.Entry) => {
        if (!names.has(entry.fileName)) {
          zip.readEntry();
          return;
        }

        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            zip.readEntry();
            return;
          }
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("end", () => {
            result.set(entry.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
          stream.on("error", () => zip.readEntry());
        });
      });
      zip.readEntry();
    });
  });
}

/**
 * 计算密度权重：目录名带 xxxhdpi 等标识，anydpi 视为矢量优先。
 * @param name APK 内路径
 * @returns 排序权重
 */
function densityWeight(name: string): number {
  const match = /res\/[^/]*-([a-z]+)(?:-v\d+)?\//.exec(name);
  return match ? (DENSITY_WEIGHT[match[1]] ?? 0) : 0;
}

/**
 * 判断路径是否为位图。
 * @param name APK 内路径
 * @returns 是位图返回 true
 */
function isBitmap(name: string): boolean {
  return /\.(png|webp|jpe?g)$/i.test(name);
}

/**
 * 判断路径是否为 XML（矢量图、自适应图标或图层列表）。
 * @param name APK 内路径
 * @returns 是 XML 返回 true
 */
function isXml(name: string): boolean {
  return /\.xml$/i.test(name);
}

/**
 * 判断路径是否为 APK 内的资源文件（兼容 res/9w.png 这类扁平混淆路径）。
 * @param value 资源解析结果
 * @returns 是资源路径返回 true
 */
function isResourcePath(value: string): boolean {
  return /^res\/(?:[^/]+\/)?[^/]+\.(xml|png|webp|jpe?g)$/i.test(value);
}

/**
 * 判断缓冲区是否为浏览器可识别的图片（PNG/JPEG/WebP）。
 * @param buffer 待检测内容
 * @returns 是图片返回 true
 */
export function isSupportedImage(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const png = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const webp =
    buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return png || jpeg || webp;
}

/**
 * 解析 Android 颜色（#RGB / #ARGB / #RRGGBB / #AARRGGBB，兼容缺少 # 的十六进制）。
 * @param value 原始颜色值
 * @returns 颜色与透明度；无法解析返回 null
 */
function parseColor(value: string | null | undefined): { color: string; opacity: number } | null {
  if (!value) return null;
  const raw = value.trim();
  const match = /^#?([0-9a-f]{3,8})$/i.exec(raw);
  if (!match) return null;

  const hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    return parseColor(`#${hex.split("").map((char) => `${char}${char}`).join("")}`);
  }
  if (hex.length === 6) return { color: `#${hex.toUpperCase()}`, opacity: 1 };
  if (hex.length === 8) {
    const alpha = Number.parseInt(hex.slice(0, 2), 16) / 255;
    return { color: `#${hex.slice(2).toUpperCase()}`, opacity: Number(alpha.toFixed(3)) };
  }
  return null;
}

/**
 * 解析资源表中的颜色值（ARGB 整数，可能是负数或十六进制）。
 * @param value 资源表值
 * @returns 颜色与透明度；不是颜色返回 null
 */
function parseColorInt(value: string | null | undefined): { color: string; opacity: number } | null {
  if (!value) return null;
  const raw = value.trim();
  let numeric: number | null = null;
  if (/^-?\d+$/.test(raw)) numeric = Number(raw);
  else if (/^0x[0-9a-f]{1,8}$/i.test(raw)) numeric = Number.parseInt(raw.slice(2), 16);
  if (numeric === null) return null;

  const argb = Number(numeric) >>> 0;
  const alpha = (argb >>> 24) & 0xff;
  const rgb = (argb & 0xffffff).toString(16).padStart(6, "0").toUpperCase();
  return { color: `#${rgb}`, opacity: Number((alpha / 255).toFixed(3)) };
}

/**
 * 将 Android 浮点位模式还原为数值。
 * @param value 无符号 32 位整数
 * @returns 浮点数
 */
function intBitsToFloat(value: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, value >>> 0, true);
  return view.getFloat32(0, true);
}

/**
 * 读取标签中的 android 命名空间属性。
 * @param tag 标签文本
 * @param name 属性名（不含 android:）
 * @returns 属性值或 null
 */
function androidAttr(tag: string, name: string): string | null {
  const match = new RegExp(`android:${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag);
  return match ? match[1].trim() : null;
}

/**
 * 将二进制 XML 节点序列化为可读 XML 片段，资源引用保持原样以便后续用资源表解析。
 * @param node AXML 节点
 * @returns XML 字符串
 */
function axmlToXml(node: AxmlNode): string {
  const attributes = (node.attributes ?? [])
    .map((attribute) => {
      const typed = attribute.typedValue;
      let value: string | null = null;

      if (typed.type === "rgb8" || typed.type === "rgb4" || typed.type === "argb8" || typed.type === "argb4") {
        value = `#${String(typed.value)}`;
      } else if (typed.rawType === 4 && typeof typed.value === "number") {
        value = String(intBitsToFloat(typed.value));
      } else if (typed.value !== null && typed.value !== undefined) {
        value = String(typed.value);
      }

      if (value === null) return "";
      return `android:${attribute.name}="${value.replace(/"/g, "&quot;")}"`;
    })
    .filter(Boolean)
    .join(" ");

  if (node.nodeName === "#cdata") {
    return (node.attributes?.[0]?.typedValue.value as string) ?? "";
  }

  const children = (node.childNodes ?? []).map((child) => axmlToXml(child)).join("");
  const open = attributes ? `<${node.nodeName} ${attributes}>` : `<${node.nodeName}>`;

  if (node.nodeName === "#document") return children;
  if (children === "" && (node.nodeName === "gradient" || node.nodeName === "path")) {
    return open.replace(/>$/, " />");
  }
  return `${open}${children}</${node.nodeName}>`;
}

/**
 * 将 APK 内的二进制/文本 XML 解码为可读 XML。
 * @param buffer XML 文件内容
 * @returns XML 字符串；无法解析返回 null
 */
function decodeAxml(buffer: Buffer): string | null {
  const asText = buffer.toString("utf8");
  if (asText.trimStart().startsWith("<")) return asText;
  try {
    return axmlToXml(new BinaryXmlParser(buffer).parse());
  } catch {
    return null;
  }
}

/**
 * 在 AXML 节点树中按标签名查找第一个节点。
 * @param node 根节点
 * @param name 标签名
 * @returns 命中的节点或 null
 */
function findNode(node: AxmlNode, name: string): AxmlNode | null {
  if (node.nodeName === name) return node;
  for (const child of node.childNodes ?? []) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return null;
}

/**
 * 读取 AndroidManifest 中 application 的图标资源引用（icon 优先，其次 roundIcon）。
 * @param manifest AndroidManifest.xml 内容
 * @returns 资源引用列表
 */
function readApplicationIconRefs(manifest: Buffer): string[] {
  try {
    const document = new BinaryXmlParser(manifest).parse();
    const application = findNode(document, "application");
    if (!application) return [];

    const refs: string[] = [];
    for (const attribute of application.attributes ?? []) {
      if (attribute.name !== "icon" && attribute.name !== "roundIcon") continue;
      const value = attribute.typedValue.value;
      if (typeof value === "string" && value.trim()) refs.push(value.trim());
    }
    return refs;
  } catch {
    return [];
  }
}

/**
 * 解析 resources.arsc 资源表。
 * @param resourceTable resources.arsc 内容
 * @returns 资源 ID 到路径/数值的映射
 */
function loadResourceMap(resourceTable: Buffer | undefined): ResourceMap {
  if (!resourceTable) return {};
  try {
    return new ResourceFinder().processResourceTable(resourceTable);
  } catch {
    return {};
  }
}

/**
 * 将资源引用解析为候选文件路径或数值。
 * 支持 resourceId、@type/name 两种引用形式。
 * @param reference 资源引用
 * @param map 资源表映射
 * @param entries APK 条目
 * @returns 候选值列表
 */
function resolveValues(reference: string, map: ResourceMap, entries: Map<string, number>): string[] {
  const value = reference.trim();
  if (!value) return [];

  if (value.startsWith("resourceId:")) {
    const key = `@${value.replace(/^resourceId:0x/i, "").toUpperCase()}`;
    const found = map[key];
    if (Array.isArray(found)) return [...new Set(found.filter(Boolean))];
    return found ? [found] : [];
  }

  const typed = /^@(\w+)\/(.+)$/.exec(value);
  if (typed) {
    const [, type, base] = typed;
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^res/${type}[^/]*/${escaped}\\.(xml|png|webp|jpe?g)$`, "i");
    return [...entries.keys()].filter((name) => pattern.test(name));
  }

  return [value];
}

/**
 * 图标候选排序：XML（矢量/自适应）优先，其次按密度与体积降序。
 * @param names 候选路径
 * @param entries APK 条目
 * @returns 排序后的路径
 */
function sortIconCandidates(names: string[], entries: Map<string, number>): string[] {
  return [...new Set(names)].sort((a, b) => {
    const xmlDiff = Number(isBitmap(a)) - Number(isBitmap(b));
    if (xmlDiff !== 0) return xmlDiff;
    const weightDiff = densityWeight(b) - densityWeight(a);
    if (weightDiff !== 0) return weightDiff;
    return (entries.get(b) ?? 0) - (entries.get(a) ?? 0);
  });
}

/**
 * 将 Android vector drawable 转换为 SVG 片段。
 * 支持 group 的平移/缩放/旋转与 path 的填充、描边。
 * @param xml vector drawable 内容
 * @returns SVG 片段与视口尺寸；解析失败返回 null
 */
function vectorToSvg(xml: string): { svg: string; width: number; height: number } | null {
  const viewportWidth = Number.parseFloat(androidAttr(xml, "viewportWidth") ?? "0");
  const viewportHeight = Number.parseFloat(androidAttr(xml, "viewportHeight") ?? "0");
  const fallbackWidth = Number.parseFloat(androidAttr(xml, "width") ?? "0");
  const fallbackHeight = Number.parseFloat(androidAttr(xml, "height") ?? "0");

  const width =
    viewportWidth > 0 && viewportWidth < 10000
      ? viewportWidth
      : fallbackWidth > 0
        ? fallbackWidth
        : ADAPTIVE_SIZE;
  const height =
    viewportHeight > 0 && viewportHeight < 10000
      ? viewportHeight
      : fallbackHeight > 0
        ? fallbackHeight
        : ADAPTIVE_SIZE;

  /** 单个 path 转 SVG */
  const pathToSvg = (tag: string, transform: string): string | null => {
    const d = androidAttr(tag, "pathData");
    if (!d) return null;

    const fill = parseColor(androidAttr(tag, "fillColor"));
    const stroke = parseColor(androidAttr(tag, "strokeColor"));
    const fillAlpha = androidAttr(tag, "fillAlpha");
    const strokeWidth = androidAttr(tag, "strokeWidth");
    const fillType = androidAttr(tag, "fillType");

    const attributes: string[] = [`d="${d}"`];
    attributes.push(`fill="${fill ? fill.color : "none"}"`);
    if (fill && fill.opacity < 1) attributes.push(`fill-opacity="${fill.opacity}"`);
    if (fillAlpha) attributes.push(`fill-opacity="${fillAlpha}"`);
    if (stroke) {
      attributes.push(`stroke="${stroke.color}"`);
      if (stroke.opacity < 1) attributes.push(`stroke-opacity="${stroke.opacity}"`);
      attributes.push(`stroke-width="${strokeWidth ?? "1"}"`);
    }
    if (fillType === "evenOdd") attributes.push(`fill-rule="evenodd"`);
    if (transform) attributes.push(`transform="${transform}"`);

    return `<path ${attributes.join(" ")} />`;
  };

  const parts: string[] = [];
  const groupBlocks = xml.match(/<group\b[\s\S]*?<\/group>/gi) ?? [];

  for (const block of groupBlocks) {
    const openTag = /<group\b[^>]*>/i.exec(block)?.[0] ?? "";
    const translateX = Number.parseFloat(androidAttr(openTag, "translateX") ?? "0");
    const translateY = Number.parseFloat(androidAttr(openTag, "translateY") ?? "0");
    const scaleX = Number.parseFloat(androidAttr(openTag, "scaleX") ?? "1");
    const scaleY = Number.parseFloat(androidAttr(openTag, "scaleY") ?? "1");
    const rotation = Number.parseFloat(androidAttr(openTag, "rotation") ?? "0");
    const pivotX = Number.parseFloat(androidAttr(openTag, "pivotX") ?? "0");
    const pivotY = Number.parseFloat(androidAttr(openTag, "pivotY") ?? "0");

    const transforms: string[] = [];
    if (translateX || translateY) transforms.push(`translate(${translateX} ${translateY})`);
    if (scaleX !== 1 || scaleY !== 1) transforms.push(`scale(${scaleX} ${scaleY})`);
    if (rotation) transforms.push(`rotate(${rotation} ${pivotX} ${pivotY})`);

    const pathTags = block.match(/<path\b[^>]*\/?>/gi) ?? [];
    for (const pathTag of pathTags) {
      const path = pathToSvg(pathTag, transforms.join(" "));
      if (path) parts.push(path);
    }
  }

  const withoutGroups = groupBlocks.reduce((acc, block) => acc.replace(block, ""), xml);
  const rootPaths = withoutGroups.match(/<path\b[^>]*\/?>/gi) ?? [];
  for (const pathTag of rootPaths) {
    const path = pathToSvg(pathTag, "");
    if (path) parts.push(path);
  }

  if (parts.length === 0) return null;
  return { svg: `<g>${parts.join("")}</g>`, width, height };
}

/**
 * 将 Android <gradient> 标签转换为 SVG 渐变定义与填充矩形。
 * @param gradientTag gradient 标签文本
 * @param id 渐变 ID
 * @returns 定义与矩形片段；无法解析返回 null
 */
function gradientToSvg(gradientTag: string, id: string): { def: string; rect: string } | null {
  const type = androidAttr(gradientTag, "type") ?? "linear";
  const start = parseColor(androidAttr(gradientTag, "startColor"));
  const center = parseColor(androidAttr(gradientTag, "centerColor"));
  const end = parseColor(androidAttr(gradientTag, "endColor"));

  if (!start && !center && !end) return null;

  const stops: string[] = [];
  if (start) stops.push(`<stop offset="0" stop-color="${start.color}" stop-opacity="${start.opacity}" />`);
  if (center) stops.push(`<stop offset="0.5" stop-color="${center.color}" stop-opacity="${center.opacity}" />`);
  if (end) stops.push(`<stop offset="1" stop-color="${end.color}" stop-opacity="${end.opacity}" />`);

  if (type === "radial") {
    const cx = Number.parseFloat(androidAttr(gradientTag, "centerX") ?? "0.5");
    const cy = Number.parseFloat(androidAttr(gradientTag, "centerY") ?? "0.5");
    const radiusText = androidAttr(gradientTag, "gradientRadius") ?? "0.5";
    const radius = radiusText.endsWith("%")
      ? Number.parseFloat(radiusText) / 100
      : Number.parseFloat(radiusText);
    const def = `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${Number.isFinite(radius) && radius > 0 ? radius : 0.5}" gradientUnits="objectBoundingBox">${stops.join("")}</radialGradient>`;
    return { def, rect: `<rect x="0" y="0" width="108" height="108" fill="url(#${id})" />` };
  }

  const angle = Number.parseFloat(androidAttr(gradientTag, "angle") ?? "0") * (Math.PI / 180);
  const dx = Math.cos(angle) / 2;
  const dy = -Math.sin(angle) / 2;
  const def = `<linearGradient id="${id}" x1="${(0.5 - dx).toFixed(4)}" y1="${(0.5 - dy).toFixed(4)}" x2="${(0.5 + dx).toFixed(4)}" y2="${(0.5 + dy).toFixed(4)}" gradientUnits="objectBoundingBox">${stops.join("")}</linearGradient>`;
  return { def, rect: `<rect x="0" y="0" width="108" height="108" fill="url(#${id})" />` };
}

/**
 * 将 layer-list / shape 背景转换为 SVG 片段。
 * @param xml layer-list 或 shape 内容
 * @returns SVG 片段；无法解析返回 null
 */
function layerListToSvg(xml: string): string | null {
  const defs: string[] = [];
  const rects: string[] = [];
  let gradientIndex = 0;

  for (const item of xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [xml]) {
    const solid = /<solid\b[^>]*>/i.exec(item)?.[0];
    const solidColor = solid ? parseColor(androidAttr(solid, "color")) : null;
    if (solidColor) {
      rects.push(
        `<rect x="0" y="0" width="108" height="108" fill="${solidColor.color}" fill-opacity="${solidColor.opacity}" />`,
      );
    }

    for (const gradientTag of item.match(/<gradient\b[^>]*\/?>/gi) ?? []) {
      const gradient = gradientToSvg(gradientTag, `bg-gradient-${gradientIndex++}`);
      if (gradient) {
        defs.push(gradient.def);
        rects.push(gradient.rect);
      }
    }
  }

  if (rects.length === 0) return null;
  return `${defs.length ? `<defs>${defs.join("")}</defs>` : ""}${rects.join("")}`;
}

/**
 * 将 SVG 栅格化为 512×512 PNG。
 * @param svg SVG 字符串
 * @returns PNG 缓冲区
 */
async function rasterizeSvg(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg))
    .resize(ICON_SIZE, ICON_SIZE, { fit: "cover" })
    .png()
    .toBuffer();
}

/**
 * 从候选位图中挑选实际像素面积最大的一张。
 * @param filePath APK 绝对路径
 * @param names 位图候选路径
 * @param limit 最多读取的文件数
 * @returns 最大的位图内容；失败返回 null
 */
async function pickLargestBitmap(
  filePath: string,
  names: string[],
  limit = 6,
): Promise<Buffer | null> {
  const candidates = names.slice(0, limit);
  if (candidates.length === 0) return null;

  const files = await readZipEntries(filePath, new Set(candidates));
  let best: { area: number; buffer: Buffer } | null = null;
  for (const name of candidates) {
    const buffer = files.get(name);
    if (!buffer) continue;
    try {
      const meta = await sharp(buffer).metadata();
      const area = (meta.width ?? 0) * (meta.height ?? 0);
      if (!best || area > best.area) best = { area, buffer };
    } catch {
      // 单个文件无法解码时跳过
    }
  }
  return best?.buffer ?? null;
}

/**
 * 构建自适应图标背景层：支持纯色、渐变/图层 XML 与位图。
 * @param filePath APK 绝对路径
 * @param reference 背景资源引用
 * @param map 资源表映射
 * @param entries APK 条目
 * @returns SVG 片段
 */
async function buildAdaptiveBackground(
  filePath: string,
  reference: string,
  map: ResourceMap,
  entries: Map<string, number>,
): Promise<string> {
  const values = resolveValues(reference, map, entries);
  const paths = sortIconCandidates(values.filter(isResourcePath), entries);

  for (const name of paths.filter(isXml).slice(0, 3)) {
    const buffer = (await readZipEntries(filePath, new Set([name]))).get(name);
    const xml = buffer ? decodeAxml(buffer) : null;
    const fragment = xml ? layerListToSvg(xml) : null;
    if (fragment) return fragment;
  }

  const bitmap = await pickLargestBitmap(filePath, paths.filter(isBitmap));
  if (bitmap) {
    return `<image x="0" y="0" width="108" height="108" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${bitmap.toString("base64")}" />`;
  }

  const color =
    values.map((value) => parseColorInt(value)).find((value) => value !== null) ??
    parseColor(reference) ??
    parseColorInt(reference);
  return `<rect x="0" y="0" width="108" height="108" fill="${color ? color.color : "#FFFFFF"}" fill-opacity="${color ? color.opacity : 1}" />`;
}

/**
 * 构建自适应图标前景层：矢量优先，其次位图。
 * @param filePath APK 绝对路径
 * @param reference 前景资源引用
 * @param map 资源表映射
 * @param entries APK 条目
 * @returns SVG 片段；无法解析返回 null
 */
async function buildAdaptiveForeground(
  filePath: string,
  reference: string,
  map: ResourceMap,
  entries: Map<string, number>,
): Promise<string | null> {
  const values = resolveValues(reference, map, entries);
  const paths = sortIconCandidates(values.filter(isResourcePath), entries);

  for (const name of paths.filter(isXml).slice(0, 3)) {
    const buffer = (await readZipEntries(filePath, new Set([name]))).get(name);
    const xml = buffer ? decodeAxml(buffer) : null;
    const vector = xml ? vectorToSvg(xml) : null;
    if (vector) {
      return `<g transform="scale(${ADAPTIVE_SIZE / vector.width} ${ADAPTIVE_SIZE / vector.height})">${vector.svg}</g>`;
    }
  }

  const bitmap = await pickLargestBitmap(filePath, paths.filter(isBitmap));
  if (bitmap) {
    return `<image x="0" y="0" width="108" height="108" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${bitmap.toString("base64")}" />`;
  }

  return null;
}

/**
 * 合成自适应图标：背景层 + 前景层 → 512×512 PNG。
 * @param filePath APK 绝对路径
 * @param xml 自适应图标 XML
 * @param map 资源表映射
 * @param entries APK 条目
 * @returns PNG 缓冲区；无法解析返回 null
 */
async function renderAdaptiveIcon(
  filePath: string,
  xml: string,
  map: ResourceMap,
  entries: Map<string, number>,
): Promise<Buffer | null> {
  const backgroundRef = /<background\b[^>]*android:drawable\s*=\s*"([^"]+)"/i.exec(xml)?.[1];
  const foregroundRef = /<foreground\b[^>]*android:drawable\s*=\s*"([^"]+)"/i.exec(xml)?.[1];

  const background = backgroundRef
    ? await buildAdaptiveBackground(filePath, backgroundRef, map, entries)
    : '<rect x="0" y="0" width="108" height="108" fill="#FFFFFF" />';
  const foreground = foregroundRef
    ? await buildAdaptiveForeground(filePath, foregroundRef, map, entries)
    : null;

  if (!foreground && !background) return null;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108" viewBox="0 0 108 108">${background}${foreground ?? ""}</svg>`;
  return rasterizeSvg(svg);
}

/**
 * 渲染单个图标资源文件（自适应 / 矢量 / 图层列表 / 位图）。
 * @param filePath APK 绝对路径
 * @param name APK 内文件路径
 * @param map 资源表映射
 * @param entries APK 条目
 * @returns PNG 缓冲区；无法解析返回 null
 */
async function renderIconEntry(
  filePath: string,
  name: string,
  map: ResourceMap,
  entries: Map<string, number>,
): Promise<Buffer | null> {
  const buffer = (await readZipEntries(filePath, new Set([name]))).get(name);
  if (!buffer) return null;

  if (isBitmap(name)) {
    try {
      return await sharp(buffer).resize(ICON_SIZE, ICON_SIZE, { fit: "cover" }).png().toBuffer();
    } catch {
      return null;
    }
  }

  const xml = decodeAxml(buffer);
  if (!xml) return null;

  if (/<adaptive-icon\b/i.test(xml)) {
    return renderAdaptiveIcon(filePath, xml, map, entries);
  }

  const vector = vectorToSvg(xml);
  if (vector) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vector.width}" height="${vector.height}" viewBox="0 0 ${vector.width} ${vector.height}">${vector.svg}</svg>`;
    return rasterizeSvg(svg);
  }

  const layers = layerListToSvg(xml);
  if (layers) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108" viewBox="0 0 108 108">${layers}</svg>`;
    return rasterizeSvg(svg);
  }

  return null;
}

/** APK 内可选的图标候选 */
export interface ApkIconCandidate {
  /** 内容哈希，用作稳定标识 */
  id: string;
  /** 展示标签，如“xxxhdpi 超高清 图标” */
  label: string;
  /** 512×512 PNG 内容 */
  buffer: Buffer;
  /** 来源密度权重，数值越大越清晰 */
  weight: number;
}

/** 密度目录对应的中文标签 */
const DENSITY_LABEL: Record<string, string> = {
  ldpi: "ldpi 低清",
  mdpi: "mdpi 标清",
  hdpi: "hdpi 高清",
  xhdpi: "xhdpi 高清",
  xxhdpi: "xxhdpi 超清",
  xxxhdpi: "xxxhdpi 极清",
  nodpi: "固定密度",
  anydpi: "任意密度",
};

/**
 * 生成图标候选的可读标签。
 * @param name APK 内资源路径
 * @returns 标签文本
 */
function iconCandidateLabel(name: string): string {
  const match = /res\/[^/]*-([a-z]+)(?:-v\d+)?\//.exec(name);
  const density = match ? DENSITY_LABEL[match[1]] : "";
  if (isXml(name)) {
    return density ? `矢量/自适应（${density}）` : "矢量/自适应图标";
  }
  return density ? `${density} 图标` : "默认图标";
}

/**
 * 从 APK 中提取全部图标候选，兼容位图、矢量图与自适应图标。
 * 清单声明的图标优先，其次按 ic_launcher 等命名扫描；相同渲染结果自动去重。
 * @param filePath APK 绝对路径
 * @returns 512×512 PNG 候选列表，按清晰度降序；无法识别时返回空数组
 */
export async function extractIconCandidates(filePath: string): Promise<ApkIconCandidate[]> {
  try {
    const entries = await listZipEntries(filePath);

    const bootstrap = new Set<string>(["AndroidManifest.xml"]);
    if (entries.has("resources.arsc")) bootstrap.add("resources.arsc");
    const bootstrapFiles = await readZipEntries(filePath, bootstrap);
    const map = loadResourceMap(bootstrapFiles.get("resources.arsc"));

    // 清单声明的图标（icon / roundIcon）优先，其次按命名扫描
    const names: string[] = [];
    const manifest = bootstrapFiles.get("AndroidManifest.xml");
    for (const reference of manifest ? readApplicationIconRefs(manifest) : []) {
      names.push(
        ...sortIconCandidates(
          resolveValues(reference, map, entries).filter(isResourcePath),
          entries,
        ),
      );
    }
    names.push(
      ...sortIconCandidates(
        [...entries.keys()].filter(
          (name) =>
            /^res\/(mipmap|drawable)[^/]*\//i.test(name) &&
            ICON_BASENAME.test(name.split("/").pop() ?? ""),
        ),
        entries,
      ),
    );

    const seenNames = new Set<string>();
    const seenBuffers = new Set<string>();
    const candidates: ApkIconCandidate[] = [];

    for (const name of names) {
      if (seenNames.has(name)) continue;
      seenNames.add(name);
      if (seenNames.size > 24 || candidates.length >= 12) break;

      const buffer = await renderIconEntry(filePath, name, map, entries);
      if (!buffer) continue;

      const id = createHash("sha1").update(buffer).digest("hex").slice(0, 16);
      if (seenBuffers.has(id)) continue;
      seenBuffers.add(id);

      candidates.push({
        id,
        label: iconCandidateLabel(name),
        buffer,
        weight: densityWeight(name),
      });
    }

    const sorted = candidates.sort((a, b) => b.weight - a.weight);
    return sorted.map((candidate, index) => ({
      ...candidate,
      label:
        index === 0
          ? `${candidate.label}（推荐）`
          : candidate.label === "默认图标"
            ? `图标 ${index + 1}`
            : `${candidate.label} ${index + 1}`,
    }));
  } catch {
    return [];
  }
}

/**
 * 从 APK 中提取默认图标（清晰度最高的一张）。
 * @param filePath APK 绝对路径
 * @returns 512×512 PNG 图标；无法识别时返回 null
 */
export async function extractIconFromApk(filePath: string): Promise<Buffer | null> {
  const candidates = await extractIconCandidates(filePath);
  return candidates[0]?.buffer ?? null;
}

/**
 * 将任意图片缓冲统一转换为 512×512 PNG，用于解析器兜底图标。
 * @param buffer 原始图片
 * @returns PNG 缓冲；无法解码时返回 null
 */
export async function normalizeIconBuffer(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer).resize(ICON_SIZE, ICON_SIZE, { fit: "cover" }).png().toBuffer();
  } catch {
    return null;
  }
}
