terraform {
  required_version = ">= 1.0.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# 1. Enable Required GCP APIs
resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}

# 2. Create Artifact Registry for Docker Images
resource "google_artifact_registry_repository" "repo" {
  depends_on    = [google_project_service.services]
  location      = var.region
  repository_id = var.repository_id
  description   = "Docker repository for AI Career Platform"
  format        = "DOCKER"
}

# 3. Create GCS Bucket for ChromaDB Vector Persistence
resource "google_storage_bucket" "chromadb_bucket" {
  depends_on                  = [google_project_service.services]
  name                        = "${var.project_id}-chromadb-store"
  location                    = var.region
  force_destroy               = false
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }
}

# 4. Service Accounts for Cloud Run Services
resource "google_service_account" "backend_sa" {
  depends_on   = [google_project_service.services]
  account_id   = "career-backend-sa"
  display_name = "Service Account for Career Intelligence Backend"
}

resource "google_service_account" "frontend_sa" {
  depends_on   = [google_project_service.services]
  account_id   = "career-frontend-sa"
  display_name = "Service Account for Career Intelligence Frontend"
}

# 5. Secret Manager Configuration
resource "google_secret_manager_secret" "supabase_service_role" {
  depends_on = [google_project_service.services]
  secret_id  = "supabase-service-role-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "supabase_service_role_val" {
  secret      = google_secret_manager_secret.supabase_service_role.id
  secret_data = var.supabase_service_role_key
}

resource "google_secret_manager_secret" "openai_key" {
  depends_on = [google_project_service.services]
  secret_id  = "openai-api-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "openai_key_val" {
  secret      = google_secret_manager_secret.openai_key.id
  secret_data = var.openai_api_key
}

resource "google_secret_manager_secret" "anthropic_key" {
  depends_on = [google_project_service.services]
  secret_id  = "anthropic-api-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "anthropic_key_val" {
  secret      = google_secret_manager_secret.anthropic_key.id
  secret_data = var.anthropic_api_key
}

resource "google_secret_manager_secret" "jwt_secret" {
  depends_on = [google_project_service.services]
  secret_id  = "jwt-secret-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "jwt_secret_val" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = var.secret_key
}

# IAM Permissions for Secrets Access
resource "google_secret_manager_secret_iam_member" "backend_secret_access" {
  for_each = {
    supabase  = google_secret_manager_secret.supabase_service_role.id
    openai    = google_secret_manager_secret.openai_key.id
    anthropic = google_secret_manager_secret.anthropic_key.id
    jwt       = google_secret_manager_secret.jwt_secret.id
  }
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend_sa.email}"
}

# IAM Permissions for GCS Bucket Access (ChromaDB mount)
resource "google_storage_bucket_iam_member" "backend_bucket_access" {
  bucket = google_storage_bucket.chromadb_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend_sa.email}"
}

# 6. Cloud Run Backend Service (Deploys with bootstrap image first)
resource "google_cloud_run_v2_service" "backend" {
  depends_on = [
    google_project_service.services,
    google_secret_manager_secret_iam_member.backend_secret_access
  ]
  name     = var.backend_service_name
  location = var.region
  client   = "terraform"

  template {
    service_account = google_service_account.backend_sa.email

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello:latest" # Bootstrap placeholder image
      
      ports {
        container_port = 8000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1024Mi"
        }
      }

      # Mount GCS Bucket to Backend for ChromaDB persistence
      volume_mounts {
        name       = "chromadb-vol"
        mount_path = "/app/chroma_db"
      }

      env {
        name  = "SUPABASE_URL"
        value = var.supabase_url
      }
      env {
        name  = "SUPABASE_ANON_KEY"
        value = var.supabase_anon_key
      }
      env {
        name = "SUPABASE_SERVICE_ROLE_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.supabase_service_role.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "OPENAI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.openai_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.anthropic_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "ALLOWED_ORIGINS"
        value = "http://localhost:3000,http://localhost:8000" # Updated dynamically during frontend build
      }
    }

    volumes {
      name = "chromadb-vol"
      gcs {
        bucket    = google_storage_bucket.chromadb_bucket.name
        read_only = false
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Allow public unauthenticated access to the backend API
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.viewer"
  member   = "allUsers"
}

# 7. Cloud Run Frontend Service (Deploys with bootstrap image first)
resource "google_cloud_run_v2_service" "frontend" {
  depends_on = [
    google_project_service.services,
    google_cloud_run_v2_service.backend
  ]
  name     = var.frontend_service_name
  location = var.region
  client   = "terraform"

  template {
    service_account = google_service_account.frontend_sa.email

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello:latest" # Bootstrap placeholder image
      
      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "NEXT_PUBLIC_SUPABASE_URL"
        value = var.supabase_url
      }
      env {
        name  = "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        value = var.supabase_anon_key
      }
      env {
        name  = "NEXT_PUBLIC_API_URL"
        value = google_cloud_run_v2_service.backend.uri
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Allow public unauthenticated access to the frontend website
resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  location = google_cloud_run_v2_service.frontend.location
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.viewer"
  member   = "allUsers"
}
