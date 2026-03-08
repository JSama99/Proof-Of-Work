import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { db } from "./db";
import { eq, desc, and, lt, sql, ilike, or, ne } from "drizzle-orm";
import {
  artifacts,
  artifactSnapshots,
  proofUnits,
  userStates,
  activityEvents,
  ledgerEntries,
  type Artifact,
  type ArtifactSnapshot,
  type ProofUnit,
  type UserState,
  type ActivityEvent,
  type LedgerEntry,
  type ArtifactRecord,
  type ArtifactSnapshotRecord,
  type ProofUnitRecord,
  type ActivityEventRecord,
  type LedgerEntryRecord,
  type ArtifactStructure,
  type FinishCriteria,
  type ArtifactType,
  type ActivityEventType,
  type LedgerEventType,
  type RTVTag,
  type RTVResponse,
  DEFAULT_STRUCTURE,
} from "@shared/schema";

function toArtifactRecord(a: Artifact): ArtifactRecord {
  return {
    id: a.id,
    userId: a.userId,
    title: a.title,
    type: a.type as ArtifactType,
    structure: a.structure as ArtifactStructure,
    body: a.body,
    status: a.status as "draft" | "complete" | "archived" | "paused",
    isScopeExpansion: a.isScopeExpansion,
    pauseReason: a.pauseReason ?? undefined,
    pausedAt: a.pausedAt?.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    completedAt: a.completedAt?.toISOString(),
    finalSnapshotId: a.finalSnapshotId ?? undefined,
    finishCriteria: a.finishCriteria as FinishCriteria | undefined,
    finishSummary: a.finishSummary ?? undefined,
    rtvTags: a.rtvTags as RTVTag[] | undefined,
    parentArtifactId: a.parentArtifactId ?? undefined,
    parentSnapshotId: a.parentSnapshotId ?? undefined,
  };
}

function toActivityEventRecord(e: ActivityEvent): ActivityEventRecord {
  return {
    id: e.id,
    userId: e.userId,
    artifactId: e.artifactId ?? undefined,
    eventType: e.eventType as ActivityEventType,
    metadata: e.metadata as ActivityEventRecord["metadata"],
    createdAt: e.createdAt.toISOString(),
  };
}

function toSnapshotRecord(s: ArtifactSnapshot): ArtifactSnapshotRecord {
  return {
    artifactId: s.artifactId,
    snapshotId: s.snapshotId,
    frozenAt: s.frozenAt.toISOString(),
    title: s.title,
    type: s.type as ArtifactType,
    structure: s.structure as ArtifactStructure,
    body: s.body,
    finishCriteria: s.finishCriteria as FinishCriteria | undefined,
    finishSummary: s.finishSummary ?? undefined,
    isScopeExpansion: s.isScopeExpansion,
  };
}

function toProofUnitRecord(p: ProofUnit): ProofUnitRecord {
  return {
    id: p.id,
    userId: p.userId,
    artifactId: p.artifactId,
    mode: p.mode as "operator" | "steward",
    proofType: p.proofType as "ship" | "decide" | "document" | "automate" | "review",
    note: p.note ?? undefined,
    createdAt: p.createdAt.toISOString(),
  };
}

function toLedgerEntryRecord(e: LedgerEntry): LedgerEntryRecord {
  return {
    id: e.id,
    projectId: e.projectId ?? undefined,
    workspaceId: e.workspaceId ?? undefined,
    terminalSource: e.terminalSource,
    artifactType: e.artifactType ?? undefined,
    artifactId: e.artifactId ?? undefined,
    eventType: e.eventType as LedgerEventType,
    actorId: e.actorId,
    parentArtifactId: e.parentArtifactId ?? undefined,
    artifactHash: e.artifactHash ?? undefined,
    modelId: e.modelId ?? undefined,
    modelVersion: e.modelVersion ?? undefined,
    permissionScope: e.permissionScope ?? undefined,
    signature: e.signature ?? undefined,
    metadata: e.metadata as Record<string, unknown> | undefined,
    createdAt: e.createdAt.toISOString(),
  };
}

function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  return "{" + sorted.map((k) => JSON.stringify(k) + ":" + stableStringify((obj as Record<string, unknown>)[k])).join(",") + "}";
}

function computeArtifactHash(data: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(data)).digest("hex");
}

export interface ListLedgerFilters {
  projectId?: string;
  terminalSource?: string;
  artifactId?: string;
  eventType?: string;
  actorId?: string;
}

export interface ListArtifactsFilters {
  search?: string;
  type?: ArtifactType;
  status?: "draft" | "complete" | "archived" | "all";
  includeArchived?: boolean;
}

export interface IStorage {
  listArtifacts(userId: string, limit: number, cursor: string | null, filters?: ListArtifactsFilters): Promise<{ artifacts: ArtifactRecord[]; nextCursor: string | null }>;
  getArtifact(userId: string, id: string): Promise<ArtifactRecord | null>;
  createArtifact(userId: string, input: {
    title: string;
    type: ArtifactType;
    body: string;
    structure?: Partial<ArtifactStructure>;
    finishCriteria?: FinishCriteria;
    isScopeExpansion?: boolean;
  }): Promise<ArtifactRecord>;
  updateArtifact(userId: string, id: string, input: Partial<{
    title: string;
    type: ArtifactType;
    body: string;
    structure: Partial<ArtifactStructure>;
    finishCriteria: FinishCriteria;
    isScopeExpansion: boolean;
  }>): Promise<ArtifactRecord | null>;
  
  listProofUnits(userId: string, artifactId: string): Promise<ProofUnitRecord[]>;
  createProofUnit(userId: string, artifactId: string, input: {
    mode: "operator" | "steward";
    proofType: "ship" | "decide" | "document" | "automate" | "review";
    note?: string;
  }): Promise<ProofUnitRecord>;
  
  completeArtifact(userId: string, id: string, finishSummary: string): Promise<{ artifact: ArtifactRecord; snapshotId: string } | null>;
  reviseArtifact(userId: string, id: string, newTitle?: string): Promise<ArtifactRecord | null>;
  archiveArtifact(userId: string, id: string): Promise<ArtifactRecord | null>;
  restoreArtifact(userId: string, id: string): Promise<ArtifactRecord | null>;
  pauseArtifact(userId: string, id: string, reason: string): Promise<ArtifactRecord | null>;
  resumeArtifact(userId: string, id: string): Promise<ArtifactRecord | null>;
  
  getSnapshot(userId: string, artifactId: string, snapshotId: string): Promise<ArtifactSnapshotRecord | null>;
  
  getUserState(userId: string): Promise<{
    completedArtifacts: number;
    revisionsCreated: number;
    modesUsed: string[];
  }>;
  
  getRTVStatus(artifact: ArtifactRecord, userId: string): Promise<RTVResponse>;
  
  listActivityEvents(userId: string, limit: number, cursor: string | null): Promise<{ events: ActivityEventRecord[]; nextCursor: string | null }>;
  logActivityEvent(userId: string, eventType: ActivityEventType, artifactId?: string, metadata?: Record<string, any>): Promise<void>;

  recordLedgerEvent(input: {
    terminalSource: string;
    eventType: string;
    actorId: string;
    artifactId?: string;
    artifactType?: string;
    parentArtifactId?: string;
    projectId?: string;
    workspaceId?: string;
    artifactHash?: string;
    modelId?: string;
    modelVersion?: string;
    permissionScope?: string;
    signature?: string;
    metadata?: Record<string, unknown>;
  }): Promise<LedgerEntryRecord>;
  getLedgerEntry(entryId: string): Promise<LedgerEntryRecord | null>;
  listLedgerEntries(limit: number, cursor: string | null, filters?: ListLedgerFilters): Promise<{ entries: LedgerEntryRecord[]; nextCursor: string | null }>;
  getLedgerLineage(artifactId: string): Promise<LedgerEntryRecord[]>;
  verifyLedgerEntry(entryId: string): Promise<{ entry: LedgerEntryRecord; computedHash: string; valid: boolean } | null>;
}

export class DatabaseStorage implements IStorage {
  async listArtifacts(userId: string, limit: number, cursor: string | null, filters?: ListArtifactsFilters): Promise<{ artifacts: ArtifactRecord[]; nextCursor: string | null }> {
    const conditions: any[] = [eq(artifacts.userId, userId)];
    
    if (filters?.search) {
      conditions.push(ilike(artifacts.title, `%${filters.search}%`));
    }
    
    if (filters?.type) {
      conditions.push(eq(artifacts.type, filters.type));
    }
    
    if (filters?.status && filters.status !== "all") {
      conditions.push(eq(artifacts.status, filters.status));
    } else if (!filters?.includeArchived && filters?.status !== "archived") {
      conditions.push(ne(artifacts.status, "archived"));
    }
    
    if (cursor) {
      conditions.push(lt(artifacts.createdAt, new Date(cursor)));
    }
    
    const results = await db.select().from(artifacts)
      .where(and(...conditions))
      .orderBy(desc(artifacts.createdAt))
      .limit(limit + 1);
    
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].createdAt.toISOString() : null;
    
    return {
      artifacts: items.map(toArtifactRecord),
      nextCursor,
    };
  }

  async getArtifact(userId: string, id: string): Promise<ArtifactRecord | null> {
    const result = await db.select().from(artifacts)
      .where(and(eq(artifacts.id, id), eq(artifacts.userId, userId)))
      .limit(1);
    
    return result[0] ? toArtifactRecord(result[0]) : null;
  }

  async createArtifact(userId: string, input: {
    title: string;
    type: ArtifactType;
    body: string;
    structure?: Partial<ArtifactStructure>;
    finishCriteria?: FinishCriteria;
    isScopeExpansion?: boolean;
  }): Promise<ArtifactRecord> {
    const id = nanoid();
    const now = new Date();
    const structure = { ...DEFAULT_STRUCTURE, ...input.structure };
    
    const result = await db.insert(artifacts).values({
      id,
      userId,
      title: input.title,
      type: input.type,
      body: input.body,
      structure,
      status: "draft",
      isScopeExpansion: input.isScopeExpansion ?? false,
      finishCriteria: input.finishCriteria ?? null,
      createdAt: now,
      updatedAt: now,
    }).returning();
    
    await this.logActivityEvent(userId, "created", id, { artifactTitle: input.title });
    
    const record = toArtifactRecord(result[0]);
    await this.emitLedgerFromAction(userId, "artifact_created", record);
    
    return record;
  }

  async updateArtifact(userId: string, id: string, input: Partial<{
    title: string;
    type: ArtifactType;
    body: string;
    structure: Partial<ArtifactStructure>;
    finishCriteria: FinishCriteria;
    isScopeExpansion: boolean;
  }>): Promise<ArtifactRecord | null> {
    const existing = await this.getArtifact(userId, id);
    if (!existing) return null;
    if (existing.status === "complete") return null;
    
    const updates: any = { updatedAt: new Date() };
    if (input.title !== undefined) updates.title = input.title;
    if (input.type !== undefined) updates.type = input.type;
    if (input.body !== undefined) updates.body = input.body;
    if (input.structure !== undefined) {
      updates.structure = { ...existing.structure, ...input.structure };
    }
    if (input.finishCriteria !== undefined) updates.finishCriteria = input.finishCriteria;
    if (input.isScopeExpansion !== undefined) updates.isScopeExpansion = input.isScopeExpansion;
    
    const result = await db.update(artifacts)
      .set(updates)
      .where(and(eq(artifacts.id, id), eq(artifacts.userId, userId)))
      .returning();
    
    return result[0] ? toArtifactRecord(result[0]) : null;
  }

  async listProofUnits(userId: string, artifactId: string): Promise<ProofUnitRecord[]> {
    const results = await db.select().from(proofUnits)
      .where(and(eq(proofUnits.artifactId, artifactId), eq(proofUnits.userId, userId)))
      .orderBy(proofUnits.createdAt);
    
    return results.map(toProofUnitRecord);
  }

  async createProofUnit(userId: string, artifactId: string, input: {
    mode: "operator" | "steward";
    proofType: "ship" | "decide" | "document" | "automate" | "review";
    note?: string;
  }): Promise<ProofUnitRecord> {
    const artifact = await this.getArtifact(userId, artifactId);
    if (!artifact) throw new Error("Artifact not found");
    if (artifact.status === "complete") throw new Error("Cannot add proof to completed artifact");
    
    const id = nanoid();
    const result = await db.insert(proofUnits).values({
      id,
      userId,
      artifactId,
      mode: input.mode,
      proofType: input.proofType,
      note: input.note ?? null,
    }).returning();
    
    await this.updateUserState(userId, { mode: input.mode });
    await this.logActivityEvent(userId, "proof_added", artifactId, { 
      artifactTitle: artifact.title,
      proofMode: input.mode,
      proofType: input.proofType,
    });

    await this.emitLedgerFromAction(userId, "decision_checkpoint", artifact, {
      proofMode: input.mode,
      proofType: input.proofType,
      proofNote: input.note,
    });
    
    return toProofUnitRecord(result[0]);
  }

  async completeArtifact(userId: string, id: string, finishSummary: string): Promise<{ artifact: ArtifactRecord; snapshotId: string } | null> {
    const existing = await this.getArtifact(userId, id);
    if (!existing) return null;
    if (existing.status === "complete") return null;
    
    const proofs = await this.listProofUnits(userId, id);
    if (proofs.length === 0) throw new Error("At least one proof unit required");
    
    const snapshotId = nanoid();
    const now = new Date();
    
    const rtvTags = this.assignRTVTags(existing);
    
    await db.insert(artifactSnapshots).values({
      id: nanoid(),
      artifactId: id,
      snapshotId,
      frozenAt: now,
      title: existing.title,
      type: existing.type,
      structure: existing.structure,
      body: existing.body,
      finishCriteria: existing.finishCriteria ?? null,
      finishSummary,
      isScopeExpansion: existing.isScopeExpansion,
    });
    
    const result = await db.update(artifacts)
      .set({
        status: "complete",
        completedAt: now,
        updatedAt: now,
        finalSnapshotId: snapshotId,
        finishSummary,
        rtvTags: rtvTags.length > 0 ? rtvTags : null,
      })
      .where(and(eq(artifacts.id, id), eq(artifacts.userId, userId)))
      .returning();
    
    await this.updateUserState(userId, { completedArtifact: true });
    await this.logActivityEvent(userId, "completed", id, { artifactTitle: existing.title });
    
    if (result[0]) {
      const record = toArtifactRecord(result[0]);
      await this.emitLedgerFromAction(userId, "artifact_approved", record, { snapshotId });
      return { artifact: record, snapshotId };
    }
    return null;
  }

  async reviseArtifact(userId: string, id: string, newTitle?: string): Promise<ArtifactRecord | null> {
    const existing = await this.getArtifact(userId, id);
    if (!existing) return null;
    if (existing.status !== "complete") return null;
    
    let snapshotBody = existing.body;
    if (existing.finalSnapshotId) {
      const snapshot = await this.getSnapshot(userId, id, existing.finalSnapshotId);
      if (snapshot) snapshotBody = snapshot.body;
    }
    
    const revisedId = nanoid();
    const now = new Date();
    const title = newTitle || `${existing.title} (Revised)`;
    
    const result = await db.insert(artifacts).values({
      id: revisedId,
      userId,
      title,
      type: existing.type,
      structure: existing.structure,
      body: snapshotBody,
      status: "draft",
      finishCriteria: existing.finishCriteria ?? null,
      parentArtifactId: id,
      parentSnapshotId: existing.finalSnapshotId ?? null,
      createdAt: now,
      updatedAt: now,
    }).returning();
    
    await this.updateUserState(userId, { revision: true });
    await this.logActivityEvent(userId, "revised", revisedId, { 
      artifactTitle: title,
      oldStatus: existing.status,
    });
    
    if (result[0]) {
      const record = toArtifactRecord(result[0]);
      await this.emitLedgerFromAction(userId, "artifact_revised", record, { parentArtifactId: id });
      return record;
    }
    return null;
  }

  async getSnapshot(userId: string, artifactId: string, snapshotId: string): Promise<ArtifactSnapshotRecord | null> {
    const artifact = await this.getArtifact(userId, artifactId);
    if (!artifact) return null;
    
    const result = await db.select().from(artifactSnapshots)
      .where(and(
        eq(artifactSnapshots.artifactId, artifactId),
        eq(artifactSnapshots.snapshotId, snapshotId)
      ))
      .limit(1);
    
    return result[0] ? toSnapshotRecord(result[0]) : null;
  }

  async getUserState(userId: string): Promise<{
    completedArtifacts: number;
    revisionsCreated: number;
    modesUsed: string[];
  }> {
    const result = await db.select().from(userStates)
      .where(eq(userStates.userId, userId))
      .limit(1);
    
    if (!result[0]) {
      return { completedArtifacts: 0, revisionsCreated: 0, modesUsed: [] };
    }
    
    return {
      completedArtifacts: parseInt(result[0].completedArtifacts) || 0,
      revisionsCreated: parseInt(result[0].revisionsCreated) || 0,
      modesUsed: (result[0].modesUsed as string[]) || [],
    };
  }

  private async updateUserState(userId: string, updates: {
    mode?: string;
    completedArtifact?: boolean;
    revision?: boolean;
  }): Promise<void> {
    const existing = await db.select().from(userStates)
      .where(eq(userStates.userId, userId))
      .limit(1);
    
    if (!existing[0]) {
      const modesUsed = updates.mode ? [updates.mode] : [];
      await db.insert(userStates).values({
        id: nanoid(),
        userId,
        completedArtifacts: updates.completedArtifact ? "1" : "0",
        revisionsCreated: updates.revision ? "1" : "0",
        modesUsed,
      });
      return;
    }
    
    const current = existing[0];
    const updateValues: any = { updatedAt: new Date() };
    
    if (updates.mode) {
      const modes = (current.modesUsed as string[]) || [];
      if (!modes.includes(updates.mode)) {
        modes.push(updates.mode);
        modes.sort();
        updateValues.modesUsed = modes;
      }
    }
    
    if (updates.completedArtifact) {
      updateValues.completedArtifacts = String((parseInt(current.completedArtifacts) || 0) + 1);
    }
    
    if (updates.revision) {
      updateValues.revisionsCreated = String((parseInt(current.revisionsCreated) || 0) + 1);
    }
    
    await db.update(userStates)
      .set(updateValues)
      .where(eq(userStates.userId, userId));
  }

  private assignRTVTags(artifact: ArtifactRecord): RTVTag[] {
    const tags = new Set<RTVTag>();
    const s = artifact.structure;

    if (s.thinkingOnly) return [];
    if (artifact.type === "journal") return [];

    if (s.reusable && s.hasStepsOrProcess && s.audience === "internal") tags.add("internal_leverage");
    if (s.audience === "external") tags.add("client_facing_assets");
    if (s.includesWhy && s.reusable) tags.add("reusable_knowledge");
    if (s.coordinatesToolsOrAgents || (artifact.type === "workflow" && s.hasStepsOrProcess)) tags.add("automation_systems");
    if (s.expressesValues || artifact.type === "principles") tags.add("cultural_signaling");

    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }

  async getRTVStatus(artifact: ArtifactRecord, userId: string): Promise<RTVResponse> {
    if (artifact.status !== "complete") {
      return { eligible: false, locked: false, reason: "not_complete", tags: [] };
    }
    
    if (!artifact.completedAt || !artifact.finalSnapshotId) {
      return { eligible: false, locked: false, reason: "missing_snapshot", tags: [] };
    }
    
    const DAY_MS = 24 * 60 * 60 * 1000;
    const ageDays = (Date.now() - new Date(artifact.createdAt).getTime()) / DAY_MS;
    if (ageDays < 2) {
      return { eligible: false, locked: false, reason: "too_new", tags: artifact.rtvTags || [] };
    }
    
    if (artifact.structure.thinkingOnly) {
      return { eligible: false, locked: false, reason: "thinking_only", tags: [] };
    }
    
    if (artifact.type === "journal") {
      return { eligible: false, locked: false, reason: "journal_excluded", tags: [] };
    }
    
    const state = await this.getUserState(userId);
    const unlocked = state.completedArtifacts >= 5 && state.modesUsed.length >= 2 && state.revisionsCreated >= 1;
    
    return {
      eligible: true,
      locked: !unlocked,
      reason: null,
      unlock: {
        unlocked,
        requirements: {
          completedArtifacts: { have: state.completedArtifacts, need: 5 },
          distinctModes: { have: state.modesUsed.length, need: 2 },
          revisionsCreated: { have: state.revisionsCreated, need: 1 },
        },
      },
      tags: artifact.rtvTags || [],
    };
  }

  async archiveArtifact(userId: string, id: string): Promise<ArtifactRecord | null> {
    const existing = await this.getArtifact(userId, id);
    if (!existing) return null;
    if (existing.status !== "complete") return null;
    
    const result = await db.update(artifacts)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(artifacts.id, id), eq(artifacts.userId, userId)))
      .returning();
    
    if (result[0]) {
      await this.logActivityEvent(userId, "archived", id, { artifactTitle: existing.title });
      const record = toArtifactRecord(result[0]);
      await this.emitLedgerFromAction(userId, "scope_change_acknowledged", record, { action: "archived" });
      return record;
    }
    
    return null;
  }

  async restoreArtifact(userId: string, id: string): Promise<ArtifactRecord | null> {
    const existing = await this.getArtifact(userId, id);
    if (!existing) return null;
    if (existing.status !== "archived") return null;
    
    const result = await db.update(artifacts)
      .set({ status: "complete", updatedAt: new Date() })
      .where(and(eq(artifacts.id, id), eq(artifacts.userId, userId)))
      .returning();
    
    if (result[0]) {
      await this.logActivityEvent(userId, "restored", id, { artifactTitle: existing.title });
    }
    
    return result[0] ? toArtifactRecord(result[0]) : null;
  }

  async pauseArtifact(userId: string, id: string, reason: string): Promise<ArtifactRecord | null> {
    const existing = await this.getArtifact(userId, id);
    if (!existing) return null;
    if (existing.status !== "draft") return null;
    
    const now = new Date();
    const result = await db.update(artifacts)
      .set({ 
        status: "paused", 
        pauseReason: reason,
        pausedAt: now,
        updatedAt: now 
      })
      .where(and(eq(artifacts.id, id), eq(artifacts.userId, userId)))
      .returning();
    
    if (result[0]) {
      await this.logActivityEvent(userId, "paused", id, { artifactTitle: existing.title, pauseReason: reason });
    }
    
    return result[0] ? toArtifactRecord(result[0]) : null;
  }

  async resumeArtifact(userId: string, id: string): Promise<ArtifactRecord | null> {
    const existing = await this.getArtifact(userId, id);
    if (!existing) return null;
    if (existing.status !== "paused") return null;
    
    const result = await db.update(artifacts)
      .set({ 
        status: "draft", 
        pauseReason: null,
        pausedAt: null,
        updatedAt: new Date() 
      })
      .where(and(eq(artifacts.id, id), eq(artifacts.userId, userId)))
      .returning();
    
    if (result[0]) {
      await this.logActivityEvent(userId, "resumed", id, { artifactTitle: existing.title });
    }
    
    return result[0] ? toArtifactRecord(result[0]) : null;
  }

  async listActivityEvents(userId: string, limit: number, cursor: string | null): Promise<{ events: ActivityEventRecord[]; nextCursor: string | null }> {
    const conditions: any[] = [eq(activityEvents.userId, userId)];
    
    if (cursor) {
      conditions.push(lt(activityEvents.createdAt, new Date(cursor)));
    }
    
    const results = await db.select().from(activityEvents)
      .where(and(...conditions))
      .orderBy(desc(activityEvents.createdAt))
      .limit(limit + 1);
    
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].createdAt.toISOString() : null;
    
    return {
      events: items.map(toActivityEventRecord),
      nextCursor,
    };
  }

  async logActivityEvent(userId: string, eventType: ActivityEventType, artifactId?: string, metadata?: Record<string, any>): Promise<void> {
    await db.insert(activityEvents).values({
      id: nanoid(),
      userId,
      artifactId: artifactId ?? null,
      eventType,
      metadata: metadata ?? null,
    });
  }

  async recordLedgerEvent(input: {
    terminalSource: string;
    eventType: string;
    actorId: string;
    artifactId?: string;
    artifactType?: string;
    parentArtifactId?: string;
    projectId?: string;
    workspaceId?: string;
    artifactHash?: string;
    modelId?: string;
    modelVersion?: string;
    permissionScope?: string;
    signature?: string;
    metadata?: Record<string, unknown>;
  }): Promise<LedgerEntryRecord> {
    const id = nanoid();

    const hashPayload: Record<string, unknown> = {
      terminalSource: input.terminalSource,
      eventType: input.eventType,
      actorId: input.actorId,
      artifactId: input.artifactId,
      artifactType: input.artifactType,
      parentArtifactId: input.parentArtifactId,
      artifactHash: input.artifactHash,
      metadata: input.metadata,
    };
    const entryHash = computeArtifactHash(hashPayload);

    const result = await db.insert(ledgerEntries).values({
      id,
      projectId: input.projectId ?? null,
      workspaceId: input.workspaceId ?? null,
      terminalSource: input.terminalSource,
      artifactType: input.artifactType ?? null,
      artifactId: input.artifactId ?? null,
      eventType: input.eventType,
      actorId: input.actorId,
      parentArtifactId: input.parentArtifactId ?? null,
      artifactHash: input.artifactHash ?? null,
      modelId: input.modelId ?? null,
      modelVersion: input.modelVersion ?? null,
      permissionScope: input.permissionScope ?? null,
      signature: entryHash,
      metadata: input.metadata ?? null,
    }).returning();

    return toLedgerEntryRecord(result[0]);
  }

  async getLedgerEntry(entryId: string): Promise<LedgerEntryRecord | null> {
    const result = await db.select().from(ledgerEntries)
      .where(eq(ledgerEntries.id, entryId))
      .limit(1);
    return result[0] ? toLedgerEntryRecord(result[0]) : null;
  }

  async listLedgerEntries(limit: number, cursor: string | null, filters?: ListLedgerFilters): Promise<{ entries: LedgerEntryRecord[]; nextCursor: string | null }> {
    const conditions: any[] = [];

    if (filters?.projectId) conditions.push(eq(ledgerEntries.projectId, filters.projectId));
    if (filters?.terminalSource) conditions.push(eq(ledgerEntries.terminalSource, filters.terminalSource));
    if (filters?.artifactId) conditions.push(eq(ledgerEntries.artifactId, filters.artifactId));
    if (filters?.eventType) conditions.push(eq(ledgerEntries.eventType, filters.eventType));
    if (filters?.actorId) conditions.push(eq(ledgerEntries.actorId, filters.actorId));
    if (cursor) conditions.push(lt(ledgerEntries.createdAt, new Date(cursor)));

    const query = conditions.length > 0
      ? db.select().from(ledgerEntries).where(and(...conditions))
      : db.select().from(ledgerEntries);

    const results = await query
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].createdAt.toISOString() : null;

    return {
      entries: items.map(toLedgerEntryRecord),
      nextCursor,
    };
  }

  async getLedgerLineage(artifactId: string): Promise<LedgerEntryRecord[]> {
    const results = await db.select().from(ledgerEntries)
      .where(or(
        eq(ledgerEntries.artifactId, artifactId),
        eq(ledgerEntries.parentArtifactId, artifactId)
      ))
      .orderBy(ledgerEntries.createdAt);

    return results.map(toLedgerEntryRecord);
  }

  async verifyLedgerEntry(entryId: string): Promise<{ entry: LedgerEntryRecord; computedHash: string; valid: boolean } | null> {
    const result = await db.select().from(ledgerEntries)
      .where(eq(ledgerEntries.id, entryId))
      .limit(1);

    if (!result[0]) return null;

    const entry = result[0];
    const hashPayload: Record<string, unknown> = {
      terminalSource: entry.terminalSource,
      eventType: entry.eventType,
      actorId: entry.actorId,
      artifactId: entry.artifactId,
      artifactType: entry.artifactType,
      parentArtifactId: entry.parentArtifactId,
      artifactHash: entry.artifactHash,
      metadata: entry.metadata,
    };
    const computedHash = computeArtifactHash(hashPayload);
    const valid = computedHash === entry.signature;

    return {
      entry: toLedgerEntryRecord(entry),
      computedHash,
      valid,
    };
  }

  async emitLedgerFromAction(actorId: string, eventType: string, artifact: ArtifactRecord, extra?: Record<string, unknown>): Promise<void> {
    const hash = computeArtifactHash({
      title: artifact.title,
      type: artifact.type,
      body: artifact.body,
      structure: artifact.structure,
    });

    await this.recordLedgerEvent({
      terminalSource: "POW",
      eventType,
      actorId,
      artifactId: artifact.id,
      artifactType: artifact.type,
      parentArtifactId: artifact.parentArtifactId,
      artifactHash: hash,
      metadata: {
        artifactTitle: artifact.title,
        ...extra,
      },
    });

    forwardToInfrastructure(eventType, artifact.type, artifact.title, extra).catch(() => {});
  }
}

const INTENT_MAP: Record<string, string> = {
  artifact_created: "create",
  artifact_approved: "approve",
  artifact_revised: "revise",
  decision_checkpoint: "decide",
  scope_change_acknowledged: "scope_change",
};

async function forwardToInfrastructure(
  eventType: string,
  artifactType: string,
  signal: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const intentType = INTENT_MAP[eventType];
  if (!intentType) return;

  const endpoint = process.env.TALON_INFRA_ENDPOINT;
  const apiKey = process.env.TALON_INFRA_API_KEY;
  const terminalId = process.env.TALON_INFRA_TERMINAL_ID || "pow-ledger";

  if (!endpoint || !apiKey) return;

  const payload = {
    event_type: "IntentCaptured",
    terminal_id: terminalId,
    metadata: {
      intent_type: intentType,
      target_artifact_type: artifactType,
      signal,
      constraints: extra || {},
    },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error(`[POW→Infra] Forward failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error("[POW→Infra] Forward error:", err);
  }
}

export const storage = new DatabaseStorage();
