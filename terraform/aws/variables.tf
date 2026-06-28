variable "region" {
  description = "The AWS region where resources will be provisioned."
  type        = string
  default     = "us-east-1"
}

variable "repository_name_backend" {
  description = "Name of the ECR repository for the backend image."
  type        = string
  default     = "career-backend"
}

variable "repository_name_frontend" {
  description = "Name of the ECR repository for the frontend image."
  type        = string
  default     = "career-frontend"
}

variable "backend_service_name" {
  description = "Name of the AWS App Runner backend service."
  type        = string
  default     = "career-backend"
}

variable "frontend_service_name" {
  description = "Name of the AWS App Runner frontend service."
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
