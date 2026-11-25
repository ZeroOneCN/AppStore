import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError, ERROR_STATUS, isAppError, toErrorResponse } from "../errors";

describe("AppError", () => {
  it("按错误码映射 HTTP 状态", () => {
    for (const [code, status] of Object.entries(ERROR_STATUS)) {
      const error = new AppError(code as keyof typeof ERROR_STATUS, "测试消息");
      expect(error.status).toBe(status);
      expect(error.code).toBe(code);
      expect(isAppError(error)).toBe(true);
    }
  });

  it("非 AppError 不被识别为业务异常", () => {
    expect(isAppError(new Error("x"))).toBe(false);
    expect(isAppError("x")).toBe(false);
  });
});

describe("toErrorResponse", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("业务异常输出对应状态码与错误结构", async () => {
    const response = toErrorResponse(new AppError("NOT_FOUND", "应用不存在"));
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("应用不存在");
  });

  it("未预期异常统一返回 500 且不泄露原始信息", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = toErrorResponse(new Error("数据库连接串 password=123"));
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).not.toContain("password");
  });
});
