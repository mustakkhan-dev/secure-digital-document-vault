variable "aws_region" {
  description = "The AWS Region where resources will be provisioned."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name identifier"
  type        = string
  default     = "secure-doc-vault"
}

variable "alert_email" {
  description = "Email address to receive document expiry reminders"
  type        = string
  default     = "student@example.com"
}
