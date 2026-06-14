import {
  pgTable, text, timestamp, integer, real,
  boolean, jsonb, uuid, index, uniqueIndex, pgEnum,
} from "drizzle-orm/pg-core";

export const raceModeEnum   = pgEnum("race_mode", ["solo", "multiplayer", "competition"]);
export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard", "code"]);
export const raceStatusEnum  = pgEnum("race_status", ["waiting", "countdown", "racing", "finished"]);

export const users = pgTable("users", {
  id:            uuid("id").primaryKey().defaultRandom(),
  name:          text("name"),
  email:         text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image:         text("image"),
  username:      text("username").unique(),
  passwordHash:   text("password_hash"),
  createdAt:     timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt:     timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  emailIdx:    uniqueIndex("users_email_idx").on(t.email),
  usernameIdx: index("users_username_idx").on(t.username),
}));

export const accounts = pgTable("accounts", {
  id:                uuid("id").primaryKey().defaultRandom(),
  userId:            uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type:              text("type").notNull(),
  provider:          text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token:     text("refresh_token"),
  access_token:      text("access_token"),
  expires_at:        integer("expires_at"),
  token_type:        text("token_type"),
  scope:             text("scope"),
  id_token:          text("id_token"),
  session_state:     text("session_state"),
}, (t) => ({
  providerIdx: uniqueIndex("accounts_provider_idx").on(t.provider, t.providerAccountId),
}));

export const sessions = pgTable("sessions", {
  id:           uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("session_token").notNull().unique(),
  userId:       uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires:      timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token:      text("token").notNull().unique(),
  expires:    timestamp("expires", { mode: "date" }).notNull(),
});

export const passages = pgTable("passages", {
  id:         uuid("id").primaryKey().defaultRandom(),
  content:    text("content").notNull(),
  wordCount:  integer("word_count").notNull(),
  difficulty: difficultyEnum("difficulty").notNull().default("medium"),
  source:     text("source"),
  language:   text("language").default("en"),
  createdAt:  timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  difficultyIdx: index("passages_difficulty_idx").on(t.difficulty),
}));

export const raceSessions = pgTable("race_sessions", {
  id:            uuid("id").primaryKey().defaultRandom(),
  userId:        uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  passageId:     uuid("passage_id").references(() => passages.id),
  mode:          raceModeEnum("mode").notNull().default("solo"),
  difficulty:    difficultyEnum("difficulty").notNull().default("medium"),
  roomCode:      text("room_code"),
  competitionId: uuid("competition_id"),
  wpm:           real("wpm"),
  rawWpm:        real("raw_wpm"),
  accuracy:      real("accuracy"),
  charsTyped:    integer("chars_typed"),
  errorsCount:   integer("errors_count"),
  timeTakenMs:   integer("time_taken_ms"),
  rank:          integer("rank"),
  keystrokeLog:  jsonb("keystroke_log").$type<KeystrokeEvent[]>(),
  completedAt:   timestamp("completed_at", { mode: "date" }),
  createdAt:     timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  userIdx:      index("race_sessions_user_idx").on(t.userId),
  completedIdx: index("race_sessions_completed_idx").on(t.completedAt),
  wpmIdx:       index("race_sessions_wpm_idx").on(t.wpm),
}));

export const rooms = pgTable("rooms", {
  id:         uuid("id").primaryKey().defaultRandom(),
  code:       text("code").notNull().unique(),
  hostId:     uuid("host_id").notNull().references(() => users.id),
  passageId:  uuid("passage_id").references(() => passages.id),
  status:     raceStatusEnum("status").notNull().default("waiting"),
  maxPlayers: integer("max_players").notNull().default(4),
  isPrivate:  boolean("is_private").notNull().default(true),
  startedAt:  timestamp("started_at", { mode: "date" }),
  finishedAt: timestamp("finished_at", { mode: "date" }),
  createdAt:  timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  codeIdx:   uniqueIndex("rooms_code_idx").on(t.code),
  statusIdx: index("rooms_status_idx").on(t.status),
}));

export const competitions = pgTable("competitions", {
  id:              uuid("id").primaryKey().defaultRandom(),
  title:           text("title").notNull(),
  description:     text("description"),
  passageId:       uuid("passage_id").references(() => passages.id),
  hostId:          uuid("host_id").references(() => users.id),
  status:          raceStatusEnum("status").notNull().default("waiting"),
  maxPlayers:      integer("max_players").notNull().default(500),
  registeredCount: integer("registered_count").notNull().default(0),
  scheduledAt:     timestamp("scheduled_at", { mode: "date" }).notNull(),
  startedAt:       timestamp("started_at", { mode: "date" }),
  finishedAt:      timestamp("finished_at", { mode: "date" }),
  createdAt:       timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const competitionRegistrations = pgTable("competition_registrations", {
  id:            uuid("id").primaryKey().defaultRandom(),
  competitionId: uuid("competition_id").notNull().references(() => competitions.id),
  userId:        uuid("user_id").notNull().references(() => users.id),
  registeredAt:  timestamp("registered_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => ({
  uniqueReg: uniqueIndex("competition_reg_unique_idx").on(t.competitionId, t.userId),
}));

export type KeystrokeEvent = {
  char: string;
  expected: string;
  timestamp: number;
  correct: boolean;
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RaceSession = typeof raceSessions.$inferSelect;
export type NewRaceSession = typeof raceSessions.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type Passage = typeof passages.$inferSelect;
export type Competition = typeof competitions.$inferSelect;