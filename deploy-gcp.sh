#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# ==============================================================================
# GCP Deployment Script for AI Career Intelligence Platform
# ==============================================================================
# Please fill in your GCP configuration details below before running the script.
# ==============================================================================

GCP_PROJECT_ID="YOUR_GCP_PROJECT_ID"
GCP_REGION="us-central1"
REPO_NAME="ai-career-platform"
SERVICE_NAME_BACKEND="career-backend"
SERVICE_NAME_FRONTEND="career-frontend"

# Supabase details (Required for building the frontend Next.js bundles)
SUPABASE_URL="YOUR_SUPABASE_URL"
SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"

# Optional: Set this if you want to pass Backend Env Variables directly during deploy
# (Alternatively, configure them in the GCP Console after deployment)
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""

echo "=== Starting GCP Cloud Run Deployment Pipeline ==="

# 1. Verification of Tools
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed. Please install it first: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

if [ "$GCP_PROJECT_ID" = "YOUR_GCP_PROJECT_ID" ]; then
    echo "Error: Please edit this script and configure your GCP_PROJECT_ID."
    exit 1
fi

if [ "$SUPABASE_URL" = "YOUR_SUPABASE_URL" ]; then
    echo "Error: Please edit this script and configure your SUPABASE_URL and SUPABASE_ANON_KEY."
    exit 1
fi

# 2. Configure gcloud project
echo "Setting gcloud project context to: $GCP_PROJECT_ID..."
gcloud config set project "$GCP_PROJECT_ID"

# 3. Create Artifact Registry Repository (if not exists)
echo "Checking/creating Artifact Registry repository '$REPO_NAME' in '$GCP_REGION'..."
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$GCP_REGION" &> /dev/null; then
    gcloud artifacts repositories create "$REPO_NAME" \
        --repository-format=docker \
        --location="$GCP_REGION" \
        --description="Docker repository for AI Career Platform"
else
    echo "Artifact Registry repository '$REPO_NAME' already exists."
fi

# 4. Build and Push Backend to Artifact Registry using Cloud Build
echo "Building and pushing Backend image..."
BACKEND_TAG="$GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/$REPO_NAME/backend:latest"
gcloud builds submit --tag "$BACKEND_TAG" ./backend

# 5. Deploy Backend to Google Cloud Run
echo "Deploying Backend to Google Cloud Run..."
gcloud run deploy "$SERVICE_NAME_BACKEND" \
    --image "$BACKEND_TAG" \
    --region "$GCP_REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 8000 \
    --set-env-vars="SUPABASE_URL=$SUPABASE_URL,SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY,OPENAI_API_KEY=$OPENAI_API_KEY,ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"

# 6. Retrieve Backend Service URL dynamically
BACKEND_URL=$(gcloud run services describe "$SERVICE_NAME_BACKEND" --region "$GCP_REGION" --format 'value(status.url)')
echo "Backend deployed successfully. URL: $BACKEND_URL"

# 7. Build and Push Frontend to Artifact Registry (Passing Backend URL as Build Argument)
echo "Building and pushing Frontend image..."
FRONTEND_TAG="$GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/$REPO_NAME/frontend:latest"
gcloud builds submit --tag "$FRONTEND_TAG" \
    --build-arg="NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL" \
    --build-arg="NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" \
    --build-arg="NEXT_PUBLIC_API_URL=$BACKEND_URL" \
    ./frontend

# 8. Deploy Frontend to Google Cloud Run
echo "Deploying Frontend to Google Cloud Run..."
gcloud run deploy "$SERVICE_NAME_FRONTEND" \
    --image "$FRONTEND_TAG" \
    --region "$GCP_REGION" \
    --platform managed \
    --allow-unauthenticated \
    --port 3000

FRONTEND_URL=$(gcloud run services describe "$SERVICE_NAME_FRONTEND" --region "$GCP_REGION" --format 'value(status.url)')

# 9. Update Backend CORS Allowed Origins to include Frontend's production URL
echo "Updating Backend CORS allowed origins with Frontend URL: $FRONTEND_URL..."
gcloud run services update "$SERVICE_NAME_BACKEND" \
    --region "$GCP_REGION" \
    --update-env-vars="ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000,$FRONTEND_URL"

echo "========================================================"
echo "Deployment Complete!"
echo "Backend URL:  $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo "========================================================"
