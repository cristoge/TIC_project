output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "app_client_id" {
  description = "Public id of the app client (COGNITO_CLIENT_ID for the backend)."
  value       = aws_cognito_user_pool_client.app.id
}

output "issuer" {
  description = "Token issuer (COGNITO_ISSUER for the backend); its JWKS is at <issuer>/.well-known/jwks.json."
  value       = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
}
