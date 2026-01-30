import { nanoid } from "nanoid";
import { db } from "./db";
import { eq, desc, and, lt, sql } from "drizzle-orm";
import {
  artifacts,
  artifactSnapshots,
  proofUnits,
  userStates,
  type Artifact,
  type ArtifactSnapshot,
  type ProofUnit,
  type UserState,
  type ArtifactRecord,
  type ArtifactSnapshotRecord,
  type ProofUnitRecord,
  type ArtifactStructure,
  type FinishCriteria,
  type ArtifactType,
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
    status: a.status as "draft" | "complete",
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

export interface IStorage {
  listArtifacts(userId: string, limit: number, cursor: string | null): Promise<{ artifacts: ArtifactRecord[]; nextCursor: string | null }>;
  getArtifact(userId: string, id: string): Promise<ArtifactRecord | null>;
  createArtifact(userId: string, input: {
    title: string;
    type: ArtifactType;
    body: string;
    structure?: Partial<ArtifactStructure>;
    finishCriteria?: FinishCriteria;
  }): Promise<ArtifactRecord>;
  updateArtifact(userId: string, id: string, input: Partial<{
    title: string;
    type: ArtifactType;
    body: string;
    structure: Partial<ArtifactStructure>;
    finishCriteria: FinishCriteria;
  }>): Promise<ArtifactRecord | null>;
  
  listProofUnits(userId: string, artifactId: string): Promise<ProofUnitRecord[]>;
  createProofUnit(userId: string, artifactId: string, input: {
    mode: "operator" | "steward";
    proofType: "ship" | "decide" | "document" | "automate" | "review";
    note?: string;
  }): Promise<ProofUnitRecord>;
  
  completeArtifact(userId: string, id: string, finishSummary: string): Promise<{ artifact: ArtifactRecord; snapshotId: string } | null>;
  reviseArtifact(userId: string, id: string, newTitle?: string): Promise<ArtifactRecord | null>;
  
  getSnapshot(userId: string, artifactId: string, snapshotId: string): Promise<ArtifactSnapshotRecord | null>;
  
  getUserState(userId: string): Promise<{
    completedArtifacts: number;
    revisionsCreated: number;
    modesUsed: string[];
  }>;
  
  getRTVStatus(artifact: ArtifactRecord, userId: string): Promise<RTVResponse>;
}

export class DatabaseStorage implements IStorage {
  async listArtifacts(userId: string, limit: number, cursor: string | null): Promise<{ artifacts: ArtifactRecord[]; nextCursor: string | null }> {
    let query = db.select().from(artifacts)
      .where(eq(artifacts.userId, userId))
      .orderBy(desc(artifacts.createdAt))
      .limit(limit + 1);
    
    if (cursor) {
      const cursorDate = new Date(cursor);
      query = db.select().from(artifacts)
        .where(and(eq(artifacts.userId, userId), lt(artifacts.createdAt, cursorDate)))
        .orderBy(desc(artifacts.createdAt))
        .limit(limit + 1);
    }
    
    const results = await query;
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
      finishCriteria: input.finishCriteria ?? null,
      createdAt: now,
      updatedAt: now,
    }).returning();
    
    return toArtifactRecord(result[0]);
  }

  async updateArtifact(userId: string, id: string, input: Partial<{
    title: string;
    type: ArtifactType;
    body: string;
    structure: Partial<ArtifactStructure>;
    finishCriteria: FinishCriteria;
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
    
    return result[0] ? { artifact: toArtifactRecord(result[0]), snapshotId } : null;
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
    
    return result[0] ? toArtifactRecord(result[0]) : null;
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
}

export const storage = new DatabaseStorage();
