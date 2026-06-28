variable "project_id" {
  description = "The GCP Project ID where resources will be provisioned."
  type        = string
}

variable "region" {
  description = "The GCP region where resources will be provisioned."
  type        = string
  default     = "us-central1"
}

variable "repository_id" {
  description = "The name of the Artifact Registry repository."
  type        = string
  default     = "ai-career-platform"
}

variable "backend_service_name" {
  description = "The name of the backend Cloud Run service."
  type        = string
  default     = "career-backend"
}

variable "frontend_service_name" {
  description = "The name of the frontend Cloud Run service."
  type        = string
  default     = "career-frontend"
}

variable "supabase_url" {
  description = "The URL of the Supabase project."
  type        = string
}

variable "supabase_anon_key" {
  description = "The Anon Public Key of the Supabase project."
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key" {
  description = "The Service Role Key of the Supabase project."
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API Key (optional)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic API Key (optional)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "secret_key" {
  description = "Secret Key for backend JWT token signing."
  type        = string
  default     = "super-secret-production-key-change-me"
  sensitive   = true
}
