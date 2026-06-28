terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# 1. Elastic Container Registry (ECR) for Docker Images
resource "aws_ecr_repository" "backend" {
  name                 = var.repository_name_backend
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = var.repository_name_frontend
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# 2. S3 Bucket for ChromaDB Database Backup/State
resource "aws_s3_bucket" "chromadb_bucket" {
  bucket        = "ai-career-platform-chromadb-${random_id.bucket_suffix.hex}"
  force_destroy = false
}

resource "random_id" "bucket_suffix" {
  byte_length = 6
}

resource "aws_s3_bucket_versioning" "chromadb_versioning" {
  bucket = aws_s3_bucket.chromadb_bucket.id
  versioning_configuration {
    status = "ENABLED"
  }
}

# 3. AWS Secrets Manager for Credentials
resource "aws_secretsmanager_secret" "supabase_service_role" {
  name                    = "supabase-service-role-key"
  recovery_window_in_days = 0 # Forces deletion without waiting
}

resource "aws_secretsmanager_secret_version" "supabase_service_role_val" {
  secret_id     = aws_secretsmanager_secret.supabase_service_role.id
  secret_string = var.supabase_service_role_key
}

resource "aws_secretsmanager_secret" "openai_key" {
  name                    = "openai-api-key"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "openai_key_val" {
  secret_id     = aws_secretsmanager_secret.openai_key.id
  secret_string = var.openai_api_key
}

resource "aws_secretsmanager_secret" "anthropic_key" {
  name                    = "anthropic-api-key"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "anthropic_key_val" {
  secret_id     = aws_secretsmanager_secret.anthropic_key.id
  secret_string = var.anthropic_api_key
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "jwt-secret-key"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "jwt_secret_val" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.secret_key
}

# 4. IAM Roles for App Runner
# Access Role (Allows App Runner to pull from ECR and read Secrets)
resource "aws_iam_role" "apprunner_access_role" {
  name = "apprunner-access-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "build.apprunner.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr_access" {
  role       = aws_iam_role.apprunner_access_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# Instance Role (Allows the running container to access S3 & Secrets Manager)
resource "aws_iam_role" "backend_instance_role" {
  name = "career-backend-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "tasks.apprunner.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "backend_instance_policy" {
  name        = "career-backend-instance-policy"
  description = "Permissions for FastAPI container to access S3 and Secrets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.chromadb_bucket.arn,
          "${aws_s3_bucket.chromadb_bucket.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.supabase_service_role.arn,
          aws_secretsmanager_secret.openai_key.arn,
          aws_secretsmanager_secret.anthropic_key.arn,
          aws_secretsmanager_secret.jwt_secret.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "backend_instance_policy_attach" {
  role       = aws_iam_role.backend_instance_role.name
  policy_arn = aws_iam_policy.backend_instance_policy.arn
}

# 5. AWS App Runner Backend Service
# Note: App Runner requires the ECR image to exist during creation.
# In production pipelines, build and push the image to ECR first, then apply App Runner.
resource "aws_apprunner_service" "backend" {
  service_name = var.backend_service_name

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access_role.arn
    }
    image_repository {
      image_identifier      = "${aws_ecr_repository.backend.repository_url}:latest"
      image_repository_type = "ECR"
      image_configuration {
        port = "8000"
        runtime_environment_variables = {
          SUPABASE_URL              = var.supabase_url
          SUPABASE_ANON_KEY         = var.supabase_anon_key
          SUPABASE_SERVICE_ROLE_KEY = var.supabase_service_role_key
          OPENAI_API_KEY            = var.openai_api_key
          ANTHROPIC_API_KEY         = var.anthropic_api_key
          SECRET_KEY                = var.secret_key
          ALLOWED_ORIGINS           = "http://localhost:3000"
        }
      }
    }
    auto_deployments_enabled = true
  }

  instance_configuration {
    cpu             = "1024" # 1 vCPU
    memory          = "2048" # 2 GB RAM
    instance_role_arn = aws_iam_role.backend_instance_role.arn
  }
}

# 6. AWS App Runner Frontend Service
resource "aws_apprunner_service" "frontend" {
  depends_on   = [aws_apprunner_service.backend]
  service_name = var.frontend_service_name

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access_role.arn
    }
    image_repository {
      image_identifier      = "${aws_ecr_repository.frontend.repository_url}:latest"
      image_repository_type = "ECR"
      image_configuration {
        port = "3000"
        runtime_environment_variables = {
          NEXT_PUBLIC_SUPABASE_URL      = var.supabase_url
          NEXT_PUBLIC_SUPABASE_ANON_KEY = var.supabase_anon_key
          NEXT_PUBLIC_API_URL           = "https://${aws_apprunner_service.backend.service_url}"
        }
      }
    }
    auto_deployments_enabled = true
  }

  instance_configuration {
    cpu    = "1024"
    memory = "2048"
  }
}
