variable "region" {
  description = "AWS region for every resource of the project."
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "Prefix for resource names and the Project tag."
  type        = string
  default     = "study-rag"
}
