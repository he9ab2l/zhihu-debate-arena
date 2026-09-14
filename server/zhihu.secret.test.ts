import { describe, expect, it } from "vitest";
import { fetchQuota } from "./zhihu";

describe("知乎开放平台服务端密钥", () => {
  it.skipIf(!process.env.ZHIHU_ACCESS_SECRET?.trim())("可以通过轻量 quota 接口完成鉴权且只返回结构化额度", async () => {
    const result = await fetchQuota();
    expect(result.ok).toBe(true);
    expect(result.reason).toBeNull();
    expect(Array.isArray(result.items)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(process.env.ZHIHU_ACCESS_SECRET ?? "__missing__");
  }, 20_000);
});
