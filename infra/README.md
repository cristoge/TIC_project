# Infrastructure (Terraform)

Two independent Terraform configurations, each with its own state:

| Directory | Contents | Lifetime |
|-----------|----------|----------|
| `auth/` | Cognito user pool and app client | Always deployed (free at this size); needed to run the backend locally with real tokens |
| `app/` | VPC, RDS, S3, SQS, Lambdas, API Gateway, AgentCore Runtime | Only for the demo, then `terraform destroy` (not written yet) |

Region `eu-south-2` (Madrid) for Cognito. The parked `app/` stack will pick its own region when the AWS migration resumes (the Bedrock reranker is not offered in `eu-south-2`). Terraform 1.17 (`mise exec terraform@1.17.0 -- terraform ...`), AWS provider `~> 6.0` (locked in `.terraform.lock.hcl`). State is local (`terraform.tfstate`, git-ignored): enough for a single-person portfolio; a shared setup would use an S3 backend.

## Auth: Cognito with a single user

Only an administrator can create users (open sign-up is off), and users cannot change their email.

From the repository root:

```bash
terraform -chdir=infra/auth init
terraform -chdir=infra/auth apply    # creates the user pool and the app client

POOL=$(terraform -chdir=infra/auth output -raw user_pool_id)
EMAIL=you@example.com
aws cognito-idp admin-create-user --region eu-south-2 --user-pool-id "$POOL" --username "$EMAIL" \
  --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true --message-action SUPPRESS
read -rs -p "Password (12+ chars, upper, lower, number): " PW; echo   # keeps it out of shell history
aws cognito-idp admin-set-user-password --region eu-south-2 --user-pool-id "$POOL" --username "$EMAIL" \
  --password "$PW" --permanent
unset PW
```

The user is created outside Terraform on purpose: a password in Terraform would end up in the state file.

### Use it from the local backend

From the repository root:

```bash
export COGNITO_ISSUER=$(terraform -chdir=infra/auth output -raw issuer)
export COGNITO_CLIENT_ID=$(terraform -chdir=infra/auth output -raw app_client_id)
cd backend
TOKEN=$(uv run python -m scripts.get_token you@example.com)   # asks for the password
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/me
```
