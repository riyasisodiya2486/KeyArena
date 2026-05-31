import {
  pgTable, text, timestamp, integer, real,
  boolean, jsonb, uuid, index, uniqueIndex, pgEnum,
} from "drizzle-orm/pg-core";

// Enums
export const raceModeEnum   = pgEnum("race_mode",   ["solo", "multiplayer", "competition"]);
export const difficultyEnum = pgEnum("difficulty",  ["easy", "medium", "hard", "code"]);
export const raceStatusEnum = pgEnum("race_status", ["waiting", "countdown", "racing", "finished"]);

// ── 1. Auth tables (required by NextAuth DrizzleAdapter) ──────────────────────
export const users = pgTable("users", {
  id:            uuid("id").primaryKey().defaultRandom(),
  name:          text("name"),
  email:         text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image:         text("image"),
  username:      text("username").unique(),
  createdAt:     timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt:     timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id:                uuid("id").primaryKey().defaultRandom(),
  userId:            uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type:              text("type").notNull(),
  provider:          text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token:     text("refresh_token"),
  access_token:      text("access_token"),
  expires_at:        integer("expires_at"),
  id_token:          text("id_token"),
});

export const sessions = pgTable("sessions", {
  id:           uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("session_token").notNull().unique(),
  userId:       uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires:      timestamp("expires", { mode: "date" }).notNull(),
});

// ── 2. Passages Table (Defined here so raceSessions can reference it) ─────────
export const passages = pgTable("passages", {
  id:         uuid("id").primaryKey().defaultRandom(),
  text:       text("text").notNull(),
  author:     text("author").default("Unknown"),
  length:     integer("length").notNull(), // character count
  difficulty: difficultyEnum("difficulty").default("medium").notNull(),
  createdAt:  timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ── 3. Race Sessions Table ───────────────────────────────────────────────────
export const raceSessions = pgTable("race_sessions", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  passageId:    uuid("passage_id").references(() => passages.id, { onDelete: "set null" }),
  mode:         raceModeEnum("mode").default("solo").notNull(),
  difficulty:   difficultyEnum("difficulty").default("medium").notNull(),
  wpm:          real("wpm"),
  accuracy:     real("accuracy"),
  timeTakenMs:  integer("time_taken_ms"),
  keystrokeLog: jsonb("keystroke_log"), // AI analytics: full keystroke log per race
  completedAt:  timestamp("completed_at", { mode: "date" }),
  createdAt:    timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ── 4. Rooms Table (For Multiplayer) ──────────────────────────────────────────
export const rooms = pgTable("rooms", {
  id:          uuid("id").primaryKey().defaultRandom(),
  code:        text("code").notNull().unique(), // Room join code
  status:      raceStatusEnum("status").default("waiting").notNull(),
  passageId:   uuid("passage_id").references(() => passages.id),
  createdAt:   timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ── 5. Competitions Table ─────────────────────────────────────────────────────
export const competitions = pgTable("competitions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  title:       text("title").notNull(),
  description: text("description"),
  startTime:   timestamp("start_time", { mode: "date" }).notNull(),
  endTime:     timestamp("end_time", { mode: "date" }).notNull(),
  createdAt:   timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});