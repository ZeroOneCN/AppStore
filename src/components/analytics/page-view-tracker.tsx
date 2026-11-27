"use client";

import { useEffect, useRef } from "react";

/**
 * 页面浏览信标：在客户端挂载后上报一次 PV，携带来源与渠道参数。
 * 放在公开页面中即可，不渲染任何可见内容。
 * @param props.path 页面路径
 * @param props.appId 关联应用 ID，可在详情页传入
 * @returns null
 */
export function PageViewTracker({ path, appId }: { path: string; appId?: string | null }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const params = new URLSearchParams(window.location.search);
    const channel = params.get("from") ?? params.get("utm_source") ?? "";

    void fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path,
        appId: appId ?? undefined,
        channel,
        referrer: document.referrer,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [path, appId]);

  return null;
}
