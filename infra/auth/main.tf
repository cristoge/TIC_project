# Cognito user pool for the app. Kept deployed all the time (it costs nothing at this
# size) so the backend can validate real tokens while running locally.
#
# Only an administrator creates users: the app client id is public, and open sign-up
# would let anyone create an account and spend Bedrock on the demo.

resource "aws_cognito_user_pool" "this" {
  name = "${var.project_name}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # You@x.com and you@x.com are the same user. Cannot be changed once the pool exists.
  username_configuration {
    case_sensitive = false
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  deletion_protection = "INACTIVE"
}

resource "aws_cognito_user_pool_client" "app" {
  name         = "${var.project_name}-app"
  user_pool_id = aws_cognito_user_pool.this.id

  # A mobile app cannot keep a secret.
  generate_secret = false

  # USER_PASSWORD_AUTH lets the app (and backend/scripts/get_token.py) sign in with email and password.
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  id_token_validity      = 60
  access_token_validity  = 60
  refresh_token_validity = 30

  token_validity_units {
    id_token      = "minutes"
    access_token  = "minutes"
    refresh_token = "days"
  }

  # The ID token must carry the email claim the backend reads.
  read_attributes = ["email", "email_verified", "name"]

  # Users must not be able to change their email or any attribute that could ever be used for authorization.
  write_attributes = ["name"]
}
