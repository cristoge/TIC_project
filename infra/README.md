# Infrastructure (Terraform)

Two independent Terraform configurations, each with its own state:

| Directory | Contents | Lifetime |
|-----------|----------|----------|
| `auth/` | Cognito user pool and app client | Always deployed (free at this size); needed to run the backend locally with real tokens |
| `app/` | VPC, RDS, S3, SQS, Lambdas, API Gateway, AgentCore Runtime | Only for the demo, then `terraform destroy` (not written yet) |

Region `eu-central-1`. Terraform 1.17 (`mise exec terraform@1.17.0 -- terraform ...`), AWS provider `~> 6.0` (locked in `.terraform.lock.hcl`). State is local (`terraform.tfstate`, git-ignored): enough for a single-person portfolio; a shared setup would use an S3 backend.

## Auth: Cognito with a single user

Only an administrator can create users (open sign-up is off), and users cannot change their email.

```bash
cd infra/auth
terraform init
terraform apply                      # creates the user pool and the app client

POOL=$(terraform output -raw user_pool_id)
EMAIL=you@example.com
aws cognito-idp admin-create-user --region eu-central-1 --user-pool-id "$POOL" --username "$EMAIL" \
  --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true --message-action SUPPRESS
aws cognito-idp admin-set-user-password --region eu-central-1 --user-pool-id "$POOL" --username "$EMAIL" \
  --password '<at least 12 chars, upper, lower and a number>' --permanent
```

The user is created outside Terraform on purpose: a password in Terraform would end up in the state file.

### Use it from the local backend

```bash
export COGNITO_ISSUER=$(terraform -chdir=infra/auth output -raw issuer)
export COGNITO_CLIENT_ID=$(terraform -chdir=infra/auth output -raw app_client_id)
cd backend
TOKEN=$(uv run python -m scripts.get_token you@example.com)   # asks for the password
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/me
```
