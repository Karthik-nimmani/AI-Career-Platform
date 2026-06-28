output "artifact_registry_url" {
  description = "The URL of the Artifact Registry repository."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.name}"
}

output "backend_url" {
  description = "The public URL of the backend API service."
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  description = "The public URL of the frontend web portal."
  value       = google_cloud_run_v2_service.frontend.uri
}

output "gcs_bucket_name" {
  description = "The name of the GCS bucket created for ChromaDB persistence."
  value       = google_storage_bucket.chromadb_bucket.name
}
