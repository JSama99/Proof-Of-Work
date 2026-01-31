import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const artifactTypeEnum = z.enum([
  "note", "sop", "checklist", "playbook", "template", 
  "workflow", "spec", "principles", "journal", "other"
]);
export type ArtifactType = z.infer<typeof artifactTypeEnum>;

export const artifactStatusEnum = z.enum(["draft", "complete", "archived"]);
export type ArtifactStatus = z.infer<typeof artifactStatusEnum>;

export const activityEventTypeEnum = z.enum([
  "created", "updated", "proof_added", "completed", "revised", "archived", "restored"
]);
export type ActivityEventType = z.infer<typeof activityEventTypeEnum>;

export const audienceEnum = z.enum(["internal", "external", "unknown"]);
export type Audience = z.infer<typeof audienceEnum>;

export const artifactStructureSchema = z.object({
  audience: audienceEnum,
  includesWhy: z.boolean(),
  reusable: z.boolean(),
  hasStepsOrProcess: z.boolean(),
  coordinatesToolsOrAgents: z.boolean(),
  expressesValues: z.boolean(),
  thinkingOnly: z.boolean(),
});
export type ArtifactStructure = z.infer<typeof artifactStructureSchema>;

export const finishCriteriaSchema = z.object({
  doneDefinition: z.string().min(10).max(300),
  checks: z.array(z.string().min(3).max(120)).min(1).max(20),
  blockers: z.array(z.string().min(3).max(120)).max(10).optional(),
});
export type FinishCriteria = z.infer<typeof finishCriteriaSchema>;

export const proofModeEnum = z.enum(["operator", "steward"]);
export type ProofMode = z.infer<typeof proofModeEnum>;

export const proofTypeEnum = z.enum(["ship", "decide", "document", "automate", "review"]);
export type ProofType = z.infer<typeof proofTypeEnum>;

export const rtvTagEnum = z.enum([
  "internal_leverage", "client_facing_assets", "reusable_knowledge", 
  "automation_systems", "cultural_signaling"
]);
export type RTVTag = z.infer<typeof rtvTagEnum>;

export const artifacts = pgTable("artifacts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  title: text("title").notNull(),
  type: varchar("type", { length: 50 }).notNull().default("note"),
  structure: jsonb("structure").notNull(),
  body: text("body").notNull().default(""),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  finalSnapshotId: varchar("final_snapshot_id", { length: 36 }),
  finishCriteria: jsonb("finish_criteria"),
  finishSummary: text("finish_summary"),
  rtvTags: jsonb("rtv_tags"),
  parentArtifactId: varchar("parent_artifact_id", { length: 36 }),
  parentSnapshotId: varchar("parent_snapshot_id", { length: 36 }),
});

export const artifactSnapshots = pgTable("artifact_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  artifactId: varchar("artifact_id", { length: 36 }).notNull(),
  snapshotId: varchar("snapshot_id", { length: 36 }).notNull(),
  frozenAt: timestamp("frozen_at").defaultNow().notNull(),
  title: text("title").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  structure: jsonb("structure").notNull(),
  body: text("body").notNull(),
  finishCriteria: jsonb("finish_criteria"),
  finishSummary: text("finish_summary"),
});

export const proofUnits = pgTable("proof_units", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  artifactId: varchar("artifact_id", { length: 36 }).notNull(),
  mode: varchar("mode", { length: 20 }).notNull(),
  proofType: varchar("proof_type", { length: 20 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userStates = pgTable("user_states", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  completedArtifacts: text("completed_artifacts").notNull().default("0"),
  revisionsCreated: text("revisions_created").notNull().default("0"),
  modesUsed: jsonb("modes_used").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const activityEvents = pgTable("activity_events", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  artifactId: varchar("artifact_id", { length: 36 }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertArtifactSchema = createInsertSchema(artifacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProofUnitSchema = createInsertSchema(proofUnits).omit({
  id: true,
  createdAt: true,
});

export type Artifact = typeof artifacts.$inferSelect;
export type InsertArtifact = z.infer<typeof insertArtifactSchema>;
export type ArtifactSnapshot = typeof artifactSnapshots.$inferSelect;
export type ProofUnit = typeof proofUnits.$inferSelect;
export type UserState = typeof userStates.$inferSelect;
export type ActivityEvent = typeof activityEvents.$inferSelect;

export interface ArtifactRecord {
  id: string;
  userId: string;
  title: string;
  type: ArtifactType;
  structure: ArtifactStructure;
  body: string;
  status: ArtifactStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  finalSnapshotId?: string;
  finishCriteria?: FinishCriteria;
  finishSummary?: string;
  rtvTags?: RTVTag[];
  parentArtifactId?: string;
  parentSnapshotId?: string;
}

export interface ArtifactSnapshotRecord {
  artifactId: string;
  snapshotId: string;
  frozenAt: string;
  title: string;
  type: ArtifactType;
  structure: ArtifactStructure;
  body: string;
  finishCriteria?: FinishCriteria;
  finishSummary?: string;
}

export interface ProofUnitRecord {
  id: string;
  userId: string;
  artifactId: string;
  mode: ProofMode;
  proofType: ProofType;
  note?: string;
  createdAt: string;
}

export interface RTVResponse {
  eligible: boolean;
  locked: boolean;
  reason: string | null;
  unlock?: {
    unlocked: boolean;
    requirements: {
      completedArtifacts: { have: number; need: number };
      distinctModes: { have: number; need: number };
      revisionsCreated: { have: number; need: number };
    };
  };
  tags: RTVTag[];
}

export interface ActivityEventRecord {
  id: string;
  userId: string;
  artifactId?: string;
  eventType: ActivityEventType;
  metadata?: {
    artifactTitle?: string;
    proofMode?: string;
    proofType?: string;
    oldStatus?: string;
    newStatus?: string;
  };
  createdAt: string;
}

export const DEFAULT_STRUCTURE: ArtifactStructure = {
  audience: "internal",
  includesWhy: false,
  reusable: false,
  hasStepsOrProcess: false,
  coordinatesToolsOrAgents: false,
  expressesValues: false,
  thinkingOnly: false,
};
