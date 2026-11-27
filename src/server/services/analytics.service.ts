import { createHash } from "node:crypto";
import { prisma } from "../db";
import { logger } from "../infra/logger";

/** 统计事件类型 */
type AnalyticsEventType = "page_view" | "download" | "install";

/** 安装类型 */
export type InstallType = "install" | "update";

/** 单日/单周/单月趋势数据 */
export interface AnalyticsPoint {
  /** 桶标识：日期、周起始日期或 YYYY-MM */
  date: string;
  /** 图表展示标签 */
  label: string;
  pv: number;
  uv: number;
  downloads: number;
  installs: number;
}

/** 渠道/设备等分布项 */
export interface AnalyticsBreakdown {
  name: string;
  count: number;
}

/** 应用维度排行 */
export interface AnalyticsTopApp {
  id: string;
  name: string;
  slug: string;
  pv: number;
  downloads: number;
  installs: number;
}

/** 趋势粒度 */
export type AnalyticsGranularity = "day" | "week" | "month";

/** 数据概览 */
export interface AnalyticsOverview {
  days: number;
  range: { start: string; end: string };
  granularity: AnalyticsGranularity;
  totals: {
    pv: number;
    uv: number;
    downloads: number;
    installs: number;
    newInstalls: number;
    updates: number;
    uniqueDevices: number;
  };
  series: AnalyticsPoint[];
  channels: AnalyticsBreakdown[];
  devices: AnalyticsBreakdown[];
  systems: AnalyticsBreakdown[];
  topApps: AnalyticsTopApp[];
  hasData: boolean;
}

/** 统计算入范围 */
export interface AnalyticsRangeInput {
  /** 预设天数：7 / 30 / 90 / 365 */
  days?: number;
  /** 自定义开始日期 YYYY-MM-DD */
  start?: string;
  /** 自定义结束日期 YYYY-MM-DD */
  end?: string;
  developerId?: string | null;
}

/** 记录事件时的公共上下文 */
interface EventContext {
  ip: string;
  ipHash: string;
  visitorId: string;
  userAgent: string;
  channel: string;
  refererHost: string;
}

/** 趋势桶 */
interface RangeBucket {
  key: string;
  label: string;
  start: number;
  end: number;
}

/** 解析后的时间范围 */
interface ResolvedRange {
  start: Date;
  end: Date;
  days: number;
  granularity: AnalyticsGranularity;
  buckets: RangeBucket[];
}

/** 页面浏览去重窗口（毫秒） */
const PAGE_VIEW_DEDUPE_MS = 60_000;
/** 安装上报去重窗口（毫秒） */
const INSTALL_DEDUPE_MS = 5 * 60_000;
/** 允许的预设天数 */
const PRESET_DAYS = [7, 30, 90, 365];
/** 自定义范围最长时间（天） */
const MAX_RANGE_DAYS = 731;
/** 简单去重缓存，避免刷新或重试造成重复计数 */
const dedupeCache = new Map<string, number>();

/** 常见爬虫 UA 关键字 */
const BOT_PATTERN = /bot|crawl|spider|slurp|bingpreview|headless|python-requests|curl\//i;

/** 按天格式化（东八区） */
const dayFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" });
/** 按月格式化（东八区） */
const monthFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
});

/**
 * 读取客户端 IP：优先 X-Real-IP，其次取 X-Forwarded-For 最后一跳。
 * @param request HTTP 请求
 * @returns IP 文本，最长 200 字符
 */
export function clientIpFromRequest(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 200);

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const nearest = hops[hops.length - 1];
    if (nearest) return nearest.slice(0, 200);
  }

  return "local";
}

/**
 * 生成稳定的哈希标识。
 * @param value 原始文本
 * @param length 截取长度
 * @returns 十六进制哈希
 */
function hashValue(value: string, length = 32): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

/**
 * 提取渠道标识：优先 ?from=，其次 utm_source。
 * @param url 请求地址
 * @returns 最长 64 字符的渠道名
 */
export function channelFromUrl(url: URL): string {
  const raw = url.searchParams.get("from") ?? url.searchParams.get("utm_source") ?? "";
  return raw.trim().slice(0, 64);
}

/**
 * 提取来源域名，忽略同站来源。
 * @param referer Referer 头
 * @param requestUrl 当前请求地址
 * @returns 来源域名，无法解析时为空
 */
export function refererHostFrom(referer: string | null, requestUrl: URL): string {
  if (!referer) return "";
  try {
    const host = new URL(referer).host;
    return host && host !== requestUrl.host ? host.slice(0, 120) : "";
  } catch {
    return "";
  }
}

/**
 * 构造事件公共上下文。
 * @param request HTTP 请求
 * @param channel 显式渠道
 * @param referer 显式来源地址
 * @returns 事件上下文
 */
function buildContext(request: Request, channel: string, referer: string | null): EventContext {
  const url = new URL(request.url);
  const ip = clientIpFromRequest(request);
  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 400);
  const day = dayFormatter.format(new Date());

  // 渠道优先取显式值或当前地址，其次从来源页面地址中解析
  let resolvedChannel = (channel || channelFromUrl(url)).slice(0, 64);
  if (!resolvedChannel && referer) {
    try {
      resolvedChannel = channelFromUrl(new URL(referer));
    } catch {
      resolvedChannel = "";
    }
  }

  return {
    ip,
    ipHash: hashValue(ip, 32),
    visitorId: hashValue(`${ip}|${userAgent}|${day}`, 32),
    userAgent,
    channel: resolvedChannel,
    refererHost: refererHostFrom(referer, url),
  };
}

/**
 * 判断去重缓存是否仍有效。
 * @param key 去重键
 * @param windowMs 时间窗口
 * @returns 命中返回 true
 */
function isDuplicate(key: string, windowMs: number): boolean {
  const now = Date.now();
  const last = dedupeCache.get(key);
  if (last && now - last < windowMs) return true;
  dedupeCache.set(key, now);

  // 简单清理，避免长期运行后缓存无限增长
  if (dedupeCache.size > 5000) {
    for (const [entryKey, timestamp] of dedupeCache) {
      if (now - timestamp > INSTALL_DEDUPE_MS) dedupeCache.delete(entryKey);
    }
  }
  return false;
}

/**
 * 写入事件，失败仅记录日志，不影响主流程。
 * @param data 事件字段
 * @returns 无
 */
async function insertEvent(data: {
  type: AnalyticsEventType;
  appId?: string | null;
  releaseId?: string | null;
  path?: string;
  channel?: string;
  refererHost?: string;
  ip?: string;
  ipHash?: string;
  visitorId?: string;
  userAgent?: string;
  deviceModel?: string;
  osVersion?: string;
  installType?: string;
  versionCode?: number | null;
}): Promise<void> {
  try {
    await prisma.analyticsEvent.create({ data });
  } catch (error) {
    logger.warn("分析事件写入失败", {
      type: data.type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 记录一次页面浏览（PV），自动跳过爬虫并按访客去重。
 * @param input 页面路径、关联应用与请求
 * @returns 无
 */
export async function recordPageView(input: {
  request: Request;
  path: string;
  appId?: string | null;
  referer?: string | null;
  channel?: string;
}): Promise<void> {
  const ctx = buildContext(input.request, input.channel ?? "", input.referer ?? null);
  if (BOT_PATTERN.test(ctx.userAgent)) return;

  const key = `pv:${ctx.visitorId}:${input.path}`;
  if (isDuplicate(key, PAGE_VIEW_DEDUPE_MS)) return;

  await insertEvent({
    type: "page_view",
    appId: input.appId ?? null,
    path: input.path.slice(0, 200),
    channel: ctx.channel,
    refererHost: ctx.refererHost,
    ip: ctx.ip,
    ipHash: ctx.ipHash,
    visitorId: ctx.visitorId,
    userAgent: ctx.userAgent,
  });
}

/**
 * 记录一次安装包下载事件。
 * @param input 应用、版本与请求
 * @returns 无
 */
export async function recordDownload(input: {
  request: Request;
  appId: string;
  releaseId: string;
  referer?: string | null;
}): Promise<void> {
  const ctx = buildContext(input.request, "", input.referer ?? null);
  await insertEvent({
    type: "download",
    appId: input.appId,
    releaseId: input.releaseId,
    path: new URL(input.request.url).pathname.slice(0, 200),
    channel: ctx.channel,
    refererHost: ctx.refererHost,
    ip: ctx.ip,
    ipHash: ctx.ipHash,
    visitorId: ctx.visitorId,
    userAgent: ctx.userAgent,
  });
}

/**
 * 记录客户端上报的安装或更新结果。
 * @param input 包名、版本、安装类型、设备信息与请求
 * @returns 是否成功关联到应用
 */
export async function recordInstall(input: {
  request: Request;
  packageName: string;
  versionCode: number;
  installType: InstallType;
  deviceModel?: string;
  osVersion?: string;
  channel?: string;
}): Promise<boolean> {
  const app = await prisma.app.findFirst({
    where: { packageName: input.packageName, type: "ANDROID" },
    select: { id: true },
  });
  if (!app) return false;

  const release = await prisma.release.findFirst({
    where: { appId: app.id, versionCode: input.versionCode },
    select: { id: true },
  });

  const ctx = buildContext(input.request, input.channel ?? "", null);
  const key = `install:${ctx.ipHash}:${app.id}:${input.versionCode}:${input.installType}`;
  if (isDuplicate(key, INSTALL_DEDUPE_MS)) return true;

  await insertEvent({
    type: "install",
    appId: app.id,
    releaseId: release?.id ?? null,
    path: "/install-report",
    channel: ctx.channel,
    ip: ctx.ip,
    ipHash: ctx.ipHash,
    visitorId: ctx.visitorId,
    userAgent: ctx.userAgent,
    deviceModel: (input.deviceModel ?? "").slice(0, 120),
    osVersion: (input.osVersion ?? "").slice(0, 80),
    installType: input.installType,
    versionCode: input.versionCode,
  });
  return true;
}

/**
 * 解析 YYYY-MM-DD 为本地日期。
 * @param value 日期文本
 * @param endOfDay 是否取当天结束
 * @returns 日期对象，非法时返回 null
 */
function parseDate(value?: string, endOfDay = false): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * 本地当天零点。
 * @param date 日期
 * @returns 新日期对象
 */
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * 按范围生成趋势桶：短区间按天、中区间按周、长区间按月。
 * @param start 开始时间
 * @param end 结束时间
 * @param granularity 粒度
 * @returns 桶列表
 */
function buildBuckets(start: Date, end: Date, granularity: AnalyticsGranularity): RangeBucket[] {
  const buckets: RangeBucket[] = [];

  if (granularity === "day") {
    const cursor = new Date(start);
    while (cursor <= end) {
      const next = new Date(cursor);
      next.setDate(next.getDate() + 1);
      buckets.push({
        key: dayFormatter.format(cursor),
        label: dayFormatter.format(cursor).slice(5).replace("-", "/"),
        start: cursor.getTime(),
        end: next.getTime() - 1,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return buckets;
  }

  if (granularity === "week") {
    let cursor = new Date(start);
    let index = 0;
    while (cursor <= end) {
      const next = new Date(cursor);
      next.setDate(next.getDate() + 7);
      buckets.push({
        key: `w${index}`,
        label: dayFormatter.format(cursor).slice(5).replace("-", "/"),
        start: cursor.getTime(),
        end: Math.min(next.getTime() - 1, end.getTime()),
      });
      cursor = next;
      index += 1;
    }
    return buckets;
  }

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const monthStart = new Date(cursor);
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const key = monthFormatter.format(cursor);
    buckets.push({
      key,
      label: key.replace("-", "/"),
      start: Math.max(monthStart.getTime(), start.getTime()),
      end: Math.min(next.getTime() - 1, end.getTime()),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

/**
 * 计算事件所属趋势桶的键。
 * @param date 事件时间
 * @param granularity 粒度
 * @param start 统计开始时间
 * @returns 桶键
 */
function bucketKeyFor(date: Date, granularity: AnalyticsGranularity, start: Date): string {
  if (granularity === "day") return dayFormatter.format(date);
  if (granularity === "month") return monthFormatter.format(date);
  const diff = startOfDay(date).getTime() - startOfDay(start).getTime();
  return `w${Math.max(0, Math.floor(diff / (7 * 86_400_000)))}`;
}

/**
 * 解析统计时间范围，支持预设天数与自定义起止日期。
 * @param input 范围输入
 * @returns 起止时间、天数、粒度与桶
 */
function resolveRange(input: AnalyticsRangeInput): ResolvedRange {
  const rangeStart = parseDate(input.start, false);
  const rangeEnd = parseDate(input.end, true);

  let start: Date;
  let end: Date;

  if (rangeStart && rangeEnd) {
    start = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
    end = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
    const spanDays = Math.floor((startOfDay(end).getTime() - start.getTime()) / 86_400_000) + 1;
    if (spanDays > MAX_RANGE_DAYS) {
      start = new Date(startOfDay(end));
      start.setDate(start.getDate() - (MAX_RANGE_DAYS - 1));
    }
  } else {
    const days = input.days && PRESET_DAYS.includes(input.days) ? input.days : 30;
    end = new Date();
    start = startOfDay(new Date());
    start.setDate(start.getDate() - (days - 1));
  }

  const days = Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000) + 1;
  const granularity: AnalyticsGranularity = days <= 62 ? "day" : days <= 200 ? "week" : "month";

  return {
    start,
    end,
    days,
    granularity,
    buckets: buildBuckets(start, end, granularity),
  };
}

/** 空的概览结果 */
function emptyOverview(range: ResolvedRange): AnalyticsOverview {
  return {
    days: range.days,
    range: { start: dayFormatter.format(range.start), end: dayFormatter.format(range.end) },
    granularity: range.granularity,
    totals: { pv: 0, uv: 0, downloads: 0, installs: 0, newInstalls: 0, updates: 0, uniqueDevices: 0 },
    series: range.buckets.map((bucket) => ({
      date: bucket.key,
      label: bucket.label,
      pv: 0,
      uv: 0,
      downloads: 0,
      installs: 0,
    })),
    channels: [],
    devices: [],
    systems: [],
    topApps: [],
    hasData: false,
  };
}

/**
 * 按数量倒序取前 N 项。
 * @param map 名称到数量的映射
 * @param limit 数量上限
 * @returns 分布数组
 */
function topBreakdown(map: Map<string, number>, limit = 8): AnalyticsBreakdown[] {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * 查询统计概览；开发者传入 developerId 时仅统计自己名下的应用。
 * @param input 时间范围与开发者过滤
 * @returns 概览数据
 */
export async function getAnalyticsOverview(input: AnalyticsRangeInput): Promise<AnalyticsOverview> {
  const range = resolveRange(input);

  let appFilter: { in: string[] } | undefined;
  let apps: { id: string; name: string; slug: string }[] = [];
  if (input.developerId) {
    apps = await prisma.app.findMany({
      where: { developerId: input.developerId },
      select: { id: true, name: true, slug: true },
    });
    if (apps.length === 0) return emptyOverview(range);
    appFilter = { in: apps.map((app) => app.id) };
  }

  const uvSet = new Set<string>();
  const deviceSet = new Set<string>();
  const bucketVisitors = new Map<string, Set<string>>();
  const channelMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();
  const systemMap = new Map<string, number>();
  const appMap = new Map<string, { pv: number; downloads: number; installs: number }>();
  const pointMap = new Map<string, AnalyticsPoint>(
    range.buckets.map((bucket) => [
      bucket.key,
      { date: bucket.key, label: bucket.label, pv: 0, uv: 0, downloads: 0, installs: 0 },
    ]),
  );

  let pv = 0;
  let downloads = 0;
  let installs = 0;
  let newInstalls = 0;
  let updates = 0;

  const events = await prisma.analyticsEvent.findMany({
    where: {
      createdAt: { gte: range.start, lte: range.end },
      ...(appFilter ? { appId: appFilter } : {}),
    },
    select: {
      type: true,
      appId: true,
      channel: true,
      refererHost: true,
      visitorId: true,
      deviceModel: true,
      osVersion: true,
      installType: true,
      createdAt: true,
    },
  });

  for (const event of events) {
    const bucketKey = bucketKeyFor(event.createdAt, range.granularity, range.start);
    const point = pointMap.get(bucketKey);

    if (event.type === "page_view") {
      pv += 1;
      if (point) point.pv += 1;
    } else if (event.type === "download") {
      downloads += 1;
      if (point) point.downloads += 1;
    } else if (event.type === "install") {
      installs += 1;
      if (point) point.installs += 1;
      if (event.installType === "update") updates += 1;
      else newInstalls += 1;
      if (event.visitorId) deviceSet.add(event.visitorId);
      const deviceName = event.deviceModel || "未知设备";
      const systemName = event.osVersion || "未知系统";
      deviceMap.set(deviceName, (deviceMap.get(deviceName) ?? 0) + 1);
      systemMap.set(systemName, (systemMap.get(systemName) ?? 0) + 1);
    }

    if (event.visitorId && (event.type === "page_view" || event.type === "download")) {
      uvSet.add(event.visitorId);
      const set = bucketVisitors.get(bucketKey) ?? new Set<string>();
      set.add(event.visitorId);
      bucketVisitors.set(bucketKey, set);
    }

    if (event.type === "page_view" || event.type === "download") {
      const channelName = event.channel || event.refererHost || "直接访问";
      channelMap.set(channelName, (channelMap.get(channelName) ?? 0) + 1);
    }

    if (event.appId) {
      const stat = appMap.get(event.appId) ?? { pv: 0, downloads: 0, installs: 0 };
      if (event.type === "page_view") stat.pv += 1;
      else if (event.type === "download") stat.downloads += 1;
      else if (event.type === "install") stat.installs += 1;
      appMap.set(event.appId, stat);
    }
  }

  const series: AnalyticsPoint[] = [...pointMap.values()].map((point) => ({
    ...point,
    uv: bucketVisitors.get(point.date)?.size ?? 0,
  }));

  if (!input.developerId) {
    const ids = [...appMap.keys()];
    apps = ids.length
      ? await prisma.app.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, slug: true },
        })
      : [];
  }
  const appIndex = new Map(apps.map((app) => [app.id, app]));
  const topApps: AnalyticsTopApp[] = [...appMap.entries()]
    .map(([appId, stat]) => {
      const app = appIndex.get(appId);
      return app ? { id: app.id, name: app.name, slug: app.slug, ...stat } : null;
    })
    .filter((item): item is AnalyticsTopApp => item !== null)
    .sort((a, b) => b.pv + b.downloads + b.installs - (a.pv + a.downloads + a.installs))
    .slice(0, 8);

  return {
    days: range.days,
    range: { start: dayFormatter.format(range.start), end: dayFormatter.format(range.end) },
    granularity: range.granularity,
    totals: {
      pv,
      uv: uvSet.size,
      downloads,
      installs,
      newInstalls,
      updates,
      uniqueDevices: deviceSet.size,
    },
    series,
    channels: topBreakdown(channelMap),
    devices: topBreakdown(deviceMap, 6),
    systems: topBreakdown(systemMap, 6),
    topApps,
    hasData: pv + downloads + installs > 0,
  };
}
