import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const debates = mysqlTable("debates", {
  id: varchar("id", { length: 32 }).primaryKey(),
  topic: varchar("topic", { length: 160 }).notNull(),
  source: mysqlEnum("source", ["zhihu", "demo"]).notNull().default("demo"),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }),
  payload: text("payload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Debate = typeof debates.$inferSelect;
export type InsertDebate = typeof debates.$inferInsert;
