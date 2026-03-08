import type {
  ArtifactRecord,
  ArtifactSnapshotRecord,
  ProofUnitRecord,
  ActivityEventRecord,
  LedgerEntryRecord,
  ArtifactType,
  FinishCriteria,
  ArtifactStructure,
  RTVResponse,
} from "@shared/schema";

const TOKEN_KEY = "pow_user_token";
const USERID_KEY = "pow_user_id";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getUserId(): string | null {
  return localStorage.getItem(USERID_KEY);
}

export function setUserId(userId: string): void {
  localStorage.setItem(USERID_KEY, userId);
}

export function clearUserId(): void {
  localStorage.removeItem(USERID_KEY);
}

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) throw new Error(data?.error ? JSON.stringify(data.error) : `HTTP ${res.status}`);
  return data as T;
}

export async function issueToken(userId: string): Promise<{ token: string }> {
  return http<{ token: string }>("/auth/issue", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export interface ListArtifactsFilters {
  search?: string;
  type?: ArtifactType;
  status?: "draft" | "complete" | "archived" | "paused" | "all";
  includeArchived?: boolean;
}

export async function listArtifacts(
  limit = 20, 
  cursor: string | null = null,
  filters?: ListArtifactsFilters
): Promise<{ artifacts: ArtifactRecord[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  if (cursor) qs.set("cursor", cursor);
  if (filters?.search) qs.set("search", filters.search);
  if (filters?.type) qs.set("type", filters.type);
  if (filters?.status) qs.set("status", filters.status);
  if (filters?.includeArchived) qs.set("includeArchived", "true");
  return http<{ artifacts: ArtifactRecord[]; nextCursor: string | null }>(`/api/artifacts?${qs.toString()}`);
}

export async function createArtifact(input: {
  title: string;
  type: ArtifactType;
  body: string;
  structure?: Partial<ArtifactStructure>;
  finishCriteria?: FinishCriteria;
  isScopeExpansion?: boolean;
}): Promise<{ artifact: ArtifactRecord }> {
  return http<{ artifact: ArtifactRecord }>("/api/artifacts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type ArtifactGetResponse = 
  | { artifact: ArtifactRecord; body: string; rtv: RTVResponse }
  | { artifact: ArtifactRecord; snapshot: ArtifactSnapshotRecord | null; rtv: RTVResponse };

export async function getArtifact(id: string): Promise<ArtifactGetResponse> {
  return http<ArtifactGetResponse>(`/api/artifacts/${id}`);
}

export async function updateArtifact(id: string, input: Partial<{
  title: string;
  type: ArtifactType;
  body: string;
  structure: Partial<ArtifactStructure>;
  finishCriteria: FinishCriteria;
  isScopeExpansion: boolean;
}>): Promise<{ artifact: ArtifactRecord }> {
  return http<{ artifact: ArtifactRecord }>(`/api/artifacts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function listProofUnits(id: string): Promise<{ proofUnits: ProofUnitRecord[] }> {
  return http<{ proofUnits: ProofUnitRecord[] }>(`/api/artifacts/${id}/proof-units`);
}

export async function addProofUnit(id: string, input: { 
  mode: ProofUnitRecord["mode"]; 
  proofType: ProofUnitRecord["proofType"]; 
  note?: string 
}): Promise<{ proofUnit: ProofUnitRecord }> {
  return http<{ proofUnit: ProofUnitRecord }>(`/api/artifacts/${id}/proof-units`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function completeArtifact(id: string, input: { 
  finishSummary: string; 
  body?: string 
}): Promise<{ artifact: ArtifactRecord; snapshotId: string; rtv: RTVResponse }> {
  return http<{ artifact: ArtifactRecord; snapshotId: string; rtv: RTVResponse }>(`/api/artifacts/${id}/complete`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function reviseArtifact(id: string, input: { title?: string }): Promise<{ artifact: ArtifactRecord }> {
  return http<{ artifact: ArtifactRecord }>(`/api/artifacts/${id}/revise`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getSnapshot(id: string, snapshotId: string): Promise<{ snapshot: ArtifactSnapshotRecord }> {
  return http<{ snapshot: ArtifactSnapshotRecord }>(`/api/artifacts/${id}/snapshot/${snapshotId}`);
}

export async function archiveArtifact(id: string): Promise<{ artifact: ArtifactRecord }> {
  return http<{ artifact: ArtifactRecord }>(`/api/artifacts/${id}/archive`, {
    method: "POST",
  });
}

export async function restoreArtifact(id: string): Promise<{ artifact: ArtifactRecord }> {
  return http<{ artifact: ArtifactRecord }>(`/api/artifacts/${id}/restore`, {
    method: "POST",
  });
}

export async function pauseArtifact(id: string, reason: string): Promise<{ artifact: ArtifactRecord }> {
  return http<{ artifact: ArtifactRecord }>(`/api/artifacts/${id}/pause`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function resumeArtifact(id: string): Promise<{ artifact: ArtifactRecord }> {
  return http<{ artifact: ArtifactRecord }>(`/api/artifacts/${id}/resume`, {
    method: "POST",
  });
}

export async function listActivityEvents(
  limit = 50, 
  cursor: string | null = null
): Promise<{ events: ActivityEventRecord[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  if (cursor) qs.set("cursor", cursor);
  return http<{ events: ActivityEventRecord[]; nextCursor: string | null }>(`/api/activity?${qs.toString()}`);
}

export interface ListLedgerFilters {
  projectId?: string;
  terminalSource?: string;
  artifactId?: string;
  eventType?: string;
  actorId?: string;
}

export async function listLedgerEntries(
  limit = 50,
  cursor: string | null = null,
  filters?: ListLedgerFilters
): Promise<{ entries: LedgerEntryRecord[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  if (cursor) qs.set("cursor", cursor);
  if (filters?.projectId) qs.set("projectId", filters.projectId);
  if (filters?.terminalSource) qs.set("terminalSource", filters.terminalSource);
  if (filters?.artifactId) qs.set("artifactId", filters.artifactId);
  if (filters?.eventType) qs.set("eventType", filters.eventType);
  if (filters?.actorId) qs.set("actorId", filters.actorId);
  return http<{ entries: LedgerEntryRecord[]; nextCursor: string | null }>(`/api/ledger/entries?${qs.toString()}`);
}

export async function getLedgerEntry(id: string): Promise<{ entry: LedgerEntryRecord }> {
  return http<{ entry: LedgerEntryRecord }>(`/api/ledger/entries/${id}`);
}

export async function getLedgerLineage(artifactId: string): Promise<{ entries: LedgerEntryRecord[] }> {
  return http<{ entries: LedgerEntryRecord[] }>(`/api/ledger/lineage/${artifactId}`);
}

export async function verifyLedgerEntry(id: string): Promise<{ entry: LedgerEntryRecord; computedHash: string; valid: boolean }> {
  return http<{ entry: LedgerEntryRecord; computedHash: string; valid: boolean }>(`/api/ledger/verify/${id}`);
}
