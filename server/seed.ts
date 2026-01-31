import { nanoid } from "nanoid";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { artifacts, proofUnits, userStates, artifactSnapshots } from "@shared/schema";

const DEMO_USER_ID = "demo";

export async function seedDatabase() {
  const existingArtifacts = await db.select().from(artifacts).where(eq(artifacts.userId, DEMO_USER_ID)).limit(1);
  
  if (existingArtifacts.length > 0) {
    console.log("Seed data already exists, skipping...");
    return;
  }
  
  console.log("Seeding database with demo data...");
  
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  
  const artifact1Id = nanoid();
  const artifact2Id = nanoid();
  const artifact3Id = nanoid();
  const artifact4Id = nanoid();
  const snapshotId = nanoid();
  
  await db.insert(artifacts).values([
    {
      id: artifact1Id,
      userId: DEMO_USER_ID,
      title: "Customer Onboarding SOP",
      type: "sop",
      body: `# Customer Onboarding Process

## Overview
This document outlines the standard operating procedure for onboarding new customers to our platform.

## Steps

### 1. Initial Contact
- Send welcome email within 24 hours
- Schedule kickoff call
- Share access credentials

### 2. Platform Setup
- Create customer workspace
- Configure integrations
- Set up user accounts

### 3. Training
- Conduct initial training session (1-2 hours)
- Share documentation and resources
- Assign customer success manager

### 4. Go-Live
- Verify all systems are operational
- Confirm customer is comfortable with the platform
- Schedule 30-day check-in call

## Success Metrics
- Time to first value < 7 days
- Customer satisfaction score > 8/10
- Support tickets < 3 in first month`,
      structure: {
        audience: "internal",
        includesWhy: true,
        reusable: true,
        hasStepsOrProcess: true,
        coordinatesToolsOrAgents: false,
        expressesValues: false,
        thinkingOnly: false,
      },
      status: "draft",
      finishCriteria: {
        doneDefinition: "SOP is complete when all steps are documented and validated by the team",
        checks: [
          "All steps are clearly documented",
          "Success metrics are defined",
          "Process has been tested with at least one customer",
        ],
      },
      createdAt: oneDayAgo,
      updatedAt: oneHourAgo,
    },
    {
      id: artifact2Id,
      userId: DEMO_USER_ID,
      title: "Weekly Planning Checklist",
      type: "checklist",
      body: `# Weekly Planning Checklist

## Monday Morning Routine

- [ ] Review previous week's completed tasks
- [ ] Check calendar for the upcoming week
- [ ] Identify top 3 priorities
- [ ] Block focus time in calendar
- [ ] Review and respond to pending messages

## Daily Standups

- [ ] Share progress on current tasks
- [ ] Flag any blockers
- [ ] Align with team on priorities

## Friday Wrap-up

- [ ] Document completed work
- [ ] Update project status
- [ ] Prepare notes for next week
- [ ] Send weekly summary to stakeholders`,
      structure: {
        audience: "internal",
        includesWhy: false,
        reusable: true,
        hasStepsOrProcess: true,
        coordinatesToolsOrAgents: false,
        expressesValues: false,
        thinkingOnly: false,
      },
      status: "draft",
      finishCriteria: {
        doneDefinition: "Checklist is ready for use when all items are actionable",
        checks: [
          "All checklist items are specific and actionable",
          "Checklist has been used for at least one full week",
        ],
      },
      createdAt: twoDaysAgo,
      updatedAt: twoDaysAgo,
    },
    {
      id: artifact3Id,
      userId: DEMO_USER_ID,
      title: "API Integration Workflow",
      type: "workflow",
      body: `# API Integration Workflow

## Trigger
When a new integration request is submitted via the integrations form.

## Process

### Step 1: Validation
- Validate API credentials
- Check rate limits
- Verify permissions

### Step 2: Configuration
- Set up OAuth flow if required
- Configure webhooks
- Map data fields

### Step 3: Testing
- Run sandbox tests
- Verify data sync
- Check error handling

### Step 4: Deployment
- Deploy to staging
- Run integration tests
- Deploy to production

## Automation Points
- Automated credential validation
- Automated webhook setup
- Automated testing pipeline`,
      structure: {
        audience: "internal",
        includesWhy: false,
        reusable: true,
        hasStepsOrProcess: true,
        coordinatesToolsOrAgents: true,
        expressesValues: false,
        thinkingOnly: false,
      },
      status: "draft",
      finishCriteria: {
        doneDefinition: "Workflow is complete when automation is fully functional",
        checks: [
          "All automation points are implemented",
          "Error handling is comprehensive",
          "Monitoring is in place",
        ],
      },
      createdAt: threeDaysAgo,
      updatedAt: oneDayAgo,
    },
    {
      id: artifact4Id,
      userId: DEMO_USER_ID,
      title: "Team Communication Guidelines",
      type: "principles",
      body: `# Team Communication Guidelines

## Core Principles

### 1. Clarity Over Speed
Take the time to communicate clearly. A well-written message saves time for everyone.

### 2. Assume Positive Intent
When reading messages, assume the sender has good intentions. Tone is hard to convey in text.

### 3. Respect Time Zones
Be mindful of teammates in different time zones. Use async communication when possible.

### 4. Document Decisions
Important decisions should be documented and shared, not just discussed in meetings.

### 5. Default to Transparency
Share information openly unless there's a specific reason for confidentiality.

## Communication Channels

- **Slack**: Quick questions, updates, casual chat
- **Email**: External communication, formal announcements
- **Notion**: Documentation, project planning
- **Video Calls**: Complex discussions, team bonding`,
      structure: {
        audience: "internal",
        includesWhy: true,
        reusable: true,
        hasStepsOrProcess: false,
        coordinatesToolsOrAgents: false,
        expressesValues: true,
        thinkingOnly: false,
      },
      status: "complete",
      finalSnapshotId: snapshotId,
      finishCriteria: {
        doneDefinition: "Guidelines are complete when the team has reviewed and agreed",
        checks: [
          "All team members have reviewed the guidelines",
          "Guidelines are accessible in the team handbook",
        ],
      },
      finishSummary: "Team communication guidelines have been reviewed and approved by all team members. Ready for use.",
      rtvTags: ["internal_leverage"],
      completedAt: oneDayAgo,
      createdAt: threeDaysAgo,
      updatedAt: oneDayAgo,
    },
  ]);
  
  await db.insert(artifactSnapshots).values({
    artifactId: artifact4Id,
    snapshotId: snapshotId,
    frozenAt: oneDayAgo,
    title: "Team Communication Guidelines",
    type: "principles",
    structure: {
      audience: "internal",
      includesWhy: true,
      reusable: true,
      hasStepsOrProcess: false,
      coordinatesToolsOrAgents: false,
      expressesValues: true,
      thinkingOnly: false,
    },
    body: `# Team Communication Guidelines

## Core Principles

### 1. Clarity Over Speed
Take the time to communicate clearly. A well-written message saves time for everyone.

### 2. Assume Positive Intent
When reading messages, assume the sender has good intentions. Tone is hard to convey in text.

### 3. Respect Time Zones
Be mindful of teammates in different time zones. Use async communication when possible.

### 4. Document Decisions
Important decisions should be documented and shared, not just discussed in meetings.

### 5. Default to Transparency
Share information openly unless there's a specific reason for confidentiality.

## Communication Channels

- **Slack**: Quick questions, updates, casual chat
- **Email**: External communication, formal announcements
- **Notion**: Documentation, project planning
- **Video Calls**: Complex discussions, team bonding`,
    finishCriteria: {
      doneDefinition: "Guidelines are complete when the team has reviewed and agreed",
      checks: [
        "All team members have reviewed the guidelines",
        "Guidelines are accessible in the team handbook",
      ],
    },
    finishSummary: "Team communication guidelines have been reviewed and approved by all team members. Ready for use.",
  });

  await db.insert(proofUnits).values([
    {
      id: nanoid(),
      userId: DEMO_USER_ID,
      artifactId: artifact1Id,
      mode: "operator",
      proofType: "document",
      note: "Documented the initial onboarding steps based on customer feedback",
      createdAt: oneHourAgo,
    },
    {
      id: nanoid(),
      userId: DEMO_USER_ID,
      artifactId: artifact1Id,
      mode: "steward",
      proofType: "review",
      note: "Reviewed with the customer success team for accuracy",
      createdAt: now,
    },
    {
      id: nanoid(),
      userId: DEMO_USER_ID,
      artifactId: artifact3Id,
      mode: "operator",
      proofType: "automate",
      note: "Set up automated validation pipeline",
      createdAt: oneDayAgo,
    },
  ]);
  
  await db.insert(userStates).values({
    id: nanoid(),
    userId: DEMO_USER_ID,
    completedArtifacts: "0",
    revisionsCreated: "0",
    modesUsed: ["operator", "steward"],
  });
  
  console.log("Seed data created successfully!");
}
