import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { insertDebate, listPersistedDebates, parsePayload, getPersistedDebate } from "./db";
import { buildDebate, demoBriefs, fetchHot, fetchQuota, hasSecret, searchZhihu, sourceStatus } from "./zhihu";

const demos = demoBriefs();
const createBuckets = new Map<string, { started: number; count: number }>();

function clientKey(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "anonymous").split(",")[0].trim();
}

function canCreate(req: Parameters<typeof clientKey>[0]) {
  const key = clientKey(req);
  const now = Date.now();
  const current = createBuckets.get(key);
  if (!current || now - current.started > 60_000) {
    createBuckets.set(key, { started: now, count: 1 });
    return true;
  }
  if (current.count >= 8) return false;
  current.count += 1;
  return true;
}

function hydrate(row: { payload: string }) {
  return parsePayload(row);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  arena: router({
    status: publicProcedure.query(() => ({ ...sourceStatus(), demoAvailable: true })),

    list: publicProcedure.query(async () => {
      const persisted = await listPersistedDebates(12);
      return [
        ...demos,
        ...persisted.map(hydrate).filter(Boolean),
      ];
    }),

    get: publicProcedure.input(z.object({ id: z.string().min(1).max(64) })).query(async ({ input }) => {
      const demo = demos.find(item => item.id === input.id);
      if (demo) return demo;
      const row = await getPersistedDebate(input.id);
      return row ? hydrate(row) : null;
    }),

    create: publicProcedure.input(z.object({ topic: z.string().trim().min(2, "议题至少需要 2 个字").max(120, "议题最多 120 个字") })).mutation(async ({ input, ctx }) => {
      if (!canCreate(ctx.req)) throw new Error("请求过于频繁，请稍后再试。");
      const search = await searchZhihu(input.topic, 8);
      const brief = buildDebate(input.topic, search.items);
      const ownerOpenId = ctx.user?.openId ?? null;
      await insertDebate({ id: brief.id, topic: brief.topic, source: brief.source, ownerOpenId, payload: JSON.stringify(brief) });
      return { brief, search: { available: search.ok, reason: search.reason, count: search.items.length } };
    }),

    hot: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(30).default(12) }).optional()).query(async ({ input }) => {
      const result = await fetchHot(input?.limit ?? 12);
      return { ...result, configured: hasSecret() };
    }),

    quota: publicProcedure.query(async () => {
      const result = await fetchQuota();
      return { ...result, configured: hasSecret() };
    }),
  }),
});

export type AppRouter = typeof appRouter;
