output "ecr_backend_url" {
  description = "The ECR repository URL for the backend image."
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_url" {
  description = "The ECR repository URL for the frontend image."
  value       = aws_ecr_repository.frontend.repository_url
}

output "backend_url" {
  description = "The public URL of the backend App Runner service."
  value       = "https://${aws_apprunner_service.backend.service_url}"
}

output "frontend_url" {
  description = "The public URL of the frontend App Runner service."
  value       = "https://${aws_apprunner_service.frontend.service_url}"
}

output "s3_bucket_name" {
  description = "The name of the S3 bucket created for ChromaDB backup."
  value       = aws_s3_bucket.chromadb_bucket.id
}
