import { describe, expect, it } from "vitest";
import { signDownloadPath, verifyDownloadSignature } from "../signing.service";

describe("签名服务", () => {
  it("生成的链接可校验通过并带绝对地址", () => {
    const signed = signDownloadPath("release-1");
    expect(signed.url.startsWith("http://127.0.0.1:3000/api/download/release-1?")).toBe(true);
    expect(signed.expiresAt).toBeGreaterThan(Date.now() / 1000);

    const params = new URL(signed.url).searchParams;
    expect(() =>
      verifyDownloadSignature("release-1", params.get("exp"), params.get("sig")),
    ).not.toThrow();
  });

  it("签名被篡改时拒绝", () => {
    const signed = signDownloadPath("release-1");
    const params = new URL(signed.url).searchParams;
    const sig = params.get("sig") ?? "";
    const tampered = `${sig.slice(0, -1)}${sig.endsWith("0") ? "1" : "0"}`;

    expect(() => verifyDownloadSignature("release-1", params.get("exp"), tampered)).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("版本 ID 不符时拒绝", () => {
    const signed = signDownloadPath("release-1");
    const params = new URL(signed.url).searchParams;
    expect(() =>
      verifyDownloadSignature("release-2", params.get("exp"), params.get("sig")),
    ).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("过期链接返回 LINK_EXPIRED", () => {
    const signed = signDownloadPath("release-1", 600, Date.now() - 3600 * 1000);
    const params = new URL(signed.url).searchParams;
    expect(() =>
      verifyDownloadSignature("release-1", params.get("exp"), params.get("sig")),
    ).toThrowError(expect.objectContaining({ code: "LINK_EXPIRED" }));
  });

  it("缺少签名参数返回 VALIDATION_FAILED", () => {
    expect(() => verifyDownloadSignature("release-1", null, null)).toThrowError(
      expect.objectContaining({ code: "VALIDATION_FAILED" }),
    );
  });
});
