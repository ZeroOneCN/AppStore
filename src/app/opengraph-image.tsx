import { ImageResponse } from "next/og";

/** 分享图替代文本 */
export const alt = "我的应用仓库 · 个人应用分发中心";

/** 分享图尺寸 */
export const size = { width: 1200, height: 630 };

/** 分享图类型 */
export const contentType = "image/png";

/**
 * 生成社交平台分享卡片图。
 * @returns 1200×630 的 PNG 响应
 */
export default function OpengraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #0b1b4d 0%, #1e51ee 55%, #5b86ff 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1e51ee",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            A
          </div>
          <div style={{ fontSize: 34, letterSpacing: -0.5 }}>AppStore</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 78, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1 }}>
            Personal App Hub
          </div>
          <div style={{ fontSize: 30, opacity: 0.85 }}>
            Apps, releases and web works in one place
          </div>
        </div>
      </div>
    ),
    size,
  );
}
