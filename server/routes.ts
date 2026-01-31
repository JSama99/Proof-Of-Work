import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { signToken, requireUser, getUserId } from "./auth";
import {
  artifactTypeEnum,
  artifactStructureSchema,
  finishCriteriaSchema,
  proofModeEnum,
  proofTypeEnum,
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post("/auth/issue", async (req, res) => {
    try {
      const schema = z.object({ userId: z.string().min(1).max(100) });
      const parsed = schema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid userId" });
      }
      
      const token = signToken(parsed.data.userId);
      res.json({ token });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Internal error" });
    }
  });

  app.get("/api/artifacts", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
      const cursor = (req.query.cursor as string) || null;
      
      const filters: { search?: string; type?: string; status?: string; includeArchived?: boolean } = {};
      if (req.query.search) filters.search = req.query.search as string;
      if (req.query.type) filters.type = req.query.type as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.includeArchived === "true") filters.includeArchived = true;
      
      const result = await storage.listArtifacts(userId, limit, cursor, filters as any);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Internal error" });
    }
  });

  app.post("/api/artifacts", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const schema = z.object({
        title: z.string().min(1).max(500),
        type: artifactTypeEnum,
        body: z.string().max(100000).default(""),
        structure: artifactStructureSchema.partial().optional(),
        finishCriteria: finishCriteriaSchema.optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues });
      }
      
      const artifact = await storage.createArtifact(userId, parsed.data);
      res.json({ artifact });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Internal error" });
    }
  });

  app.get("/api/artifacts/:id", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const artifact = await storage.getArtifact(userId, req.params.id);
      
      if (!artifact) {
        return res.status(404).json({ error: "Artifact not found" });
      }
      
      const rtv = await storage.getRTVStatus(artifact, userId);
      
      if (artifact.status === "complete" && artifact.finalSnapshotId) {
        const snapshot = await storage.getSnapshot(userId, artifact.id, artifact.finalSnapshotId);
        return res.json({ artifact, snapshot, rtv });
      }
      
      res.json({ artifact, body: artifact.body, rtv });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Internal error" });
    }
  });

  app.patch("/api/artifacts/:id", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const schema = z.object({
        title: z.string().min(1).max(500).optional(),
        type: artifactTypeEnum.optional(),
        body: z.string().max(100000).optional(),
        structure: artifactStructureSchema.partial().optional(),
        finishCriteria: finishCriteriaSchema.optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues });
      }
      
      const artifact = await storage.updateArtifact(userId, req.params.id, parsed.data);
      
      if (!artifact) {
        return res.status(404).json({ error: "Artifact not found or cannot be edited" });
      }
      
      res.json({ artifact });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Internal error" });
    }
  });

  app.get("/api/artifacts/:id/proof-units", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const proofUnits = await storage.listProofUnits(userId, req.params.id);
      res.json({ proofUnits });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Internal error" });
    }
  });

  app.post("/api/artifacts/:id/proof-units", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const schema = z.object({
        mode: proofModeEnum,
        proofType: proofTypeEnum,
        note: z.string().max(1000).optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues });
      }
      
      const proofUnit = await storage.createProofUnit(userId, req.params.id, parsed.data);
      res.json({ proofUnit });
    } catch (e: any) {
      if (e.message === "Artifact not found") {
        return res.status(404).json({ error: e.message });
      }
      if (e.message === "Cannot add proof to completed artifact") {
        return res.status(400).json({ error: e.message });
      }
      res.status(500).json({ error: e.message || "Internal error" });
    }
  });

  app.post("/api/artifacts/:id/complete", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const schema = z.object({
        finishSummary: z.string().min(10).max(2000),
        body: z.string().max(100000).optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues });
      }
      
      if (parsed.data.body) {
        await storage.updateArtifact(userId, req.params.id, { body: parsed.data.body });
      }
      
      const result = await storage.completeArtifact(userId, req.params.id, parsed.data.finishSummary);
      
      if (!result) {
        return res.status(404).json({ error: "Artifact not found or already complete" });
      }
      
      const rtv = await storage.getRTVStatus(result.artifact, userId);
      res.json({ artifact: result.artifact, snapshotId: result.snapshotId, rtv });
    } catch (e: any) {
      if (e.message === "At least one proof unit required") {
        return res.status(400).json({ error: e.message });
      }
      res.status(500).json({ error: e.message || "Internal error" });
    }
  });

  app.post("/api/artifacts/:id/revise", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const schema = z.object({
        title: z.string().min(1).max(500).optional(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues });
      }
      
      const artifact = await storage.reviseArtifact(userId, req.params.id, parsed.data.title);
      
      if (!artifact) {
        return res.status(404).json({ error: "Artifact not found or not complete" });
      }
      
      res.json({ artifact });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Internal error" });
    }
  });

  app.get("/api/artifacts/:id/snapshot/:snapshotId", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const snapshot = await storage.getSnapshot(userId, req.params.id, req.params.snapshotId);
      
      if (!snapshot) {
        return res.status(404).json({ error: "Snapshot not found" });
      }
      
      res.json({ snapshot });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Internal error" });
    }
  });

  app.post("/api/artifacts/:id/archive", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const artifact = await storage.archiveArtifact(userId, req.params.id);
      
      if (!artifact) {
        return res.status(404).json({ error: "Artifact not found or cannot be archived" });
      }
      
      res.json({ artifact });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Internal error" });
    }
  });

  app.post("/api/artifacts/:id/restore", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const artifact = await storage.restoreArtifact(userId, req.params.id);
      
      if (!artifact) {
        return res.status(404).json({ error: "Artifact not found or cannot be restored" });
      }
      
      res.json({ artifact });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Internal error" });
    }
  });

  app.get("/api/activity", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const cursor = (req.query.cursor as string) || null;
      
      const result = await storage.listActivityEvents(userId, limit, cursor);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Internal error" });
    }
  });

  return httpServer;
}
