#!/usr/bin/env bash
# One-time IAM setup for the POW Orchestrator to A2A into deployed sub-agents.
set -euo pipefail
PROJECT_ID="${PROJECT_ID:-proof-of-work-497822}"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA="service-${PROJECT_NUMBER}@gcp-sa-aiplatform-re.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA}" \
  --role="roles/aiplatform.user" \
  --condition=None
