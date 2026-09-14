import { describe, expect, it } from "vitest";
import { buildDebate, sourceStatus } from "./zhihu";

describe("知乎思辩台辩题生成器", () => {
  it("在没有真实搜索结果时明确标记为演示模式且不伪造证据", () => {
    const brief = buildDebate("普通人要不要读研", []);
    expect(brief.source).toBe("demo");
    expect(brief.evidence).toEqual([]);
    expect(brief.sourceNote).toContain("不展示伪造的知乎论据");
    expect(brief.rounds).toHaveLength(3);
    expect(brief.synthesis.decisionChecks.length).toBeGreaterThan(1);
  });

  it("将真实搜索结果保留原文链接并生成可核验来源", () => {
    const brief = buildDebate("AI 时代的学习方式", [
      {
        id: "q-1",
        title: "学习方式的变化",
        excerpt: "先做小实验，再根据反馈补知识。",
        url: "https://www.zhihu.com/question/123",
        authorName: "答主 A",
        authorBadge: "优秀回答者",
        contentType: "Answer",
        authorityLevel: "2",
        voteUpCount: 100,
        commentCount: 12,
        publishedAt: 1700000000,
        perspective: "支持视角",
      },
      {
        id: "q-2",
        title: "别忽视基础能力",
        excerpt: "复杂问题仍然需要长期积累和完整上下文。",
        url: "https://zhuanlan.zhihu.com/p/456",
        authorName: "答主 B",
        authorBadge: "",
        contentType: "Article",
        authorityLevel: "1",
        voteUpCount: 80,
        commentCount: 8,
        publishedAt: 1700000000,
        perspective: "质疑视角",
      },
    ]);
    expect(brief.source).toBe("zhihu");
    expect(brief.evidence[0].url).toContain("zhihu.com");
    expect(brief.rounds[0].pro.evidenceIds).toContain("q-1");
    expect(brief.rounds[0].con.evidenceIds).toContain("q-2");
    expect(brief.sourceNote).toContain("打开原文核验上下文");
  });

  it("默认不向客户端暴露凭证，只返回配置状态", () => {
    const status = sourceStatus();
    expect(Object.keys(status)).toEqual(["configured", "provider", "note"]);
    expect(JSON.stringify(status)).not.toContain("ACCESS_SECRET");
  });
});
