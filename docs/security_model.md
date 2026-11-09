# Cloud Security Architecture & Threat Model

## 1. Zero-Trust Security Tenets

The Secure Digital Document Vault adheres to the principle: *"Never trust, always verify."*

| Layer | Threat Vector | Mitigation Strategy |
|---|---|---|
| **Client** | Token Theft / XSS | Tokens stored in `sessionStorage` (cleared on browser tab close). No long-lived local disk credentials. |
| **API** | Man-in-the-Middle (MITM) | Strict HTTPS TLS 1.3 encryption. Unencrypted HTTP is completely rejected. |
| **Identity** | Credential Stuffing & Weak Passwords | Amazon Cognito password policy: min 8 characters, uppercase, numbers, mandatory email OTP verification. |
| **Authorization** | Broken Object Level Authorization (BOLA/IDOR) | Lambda extracts the authenticated user's `sub` directly from the validated Cognito JWT claims context (`event.requestContext.authorizer`). It never trusts client-supplied query parameters for user identity. |
| **Storage** | S3 Public Exposure / Leaks | S3 Block Public Access (all 4 flags enabled). No public bucket policies. All files are encrypted at rest with Server-Side Encryption (`AES256`/KMS). |
| **File Uploads** | Malicious File Upload & Zip Bombs | Server-side MIME type whitelist (`application/pdf`, `image/png`, `image/jpeg`, `docx`, `txt`). Strict 10MB maximum file size limit. File names sanitized against directory traversal. |
| **Sharing** | Leaked Sharing Links | Opaque UUID share tokens with strict TTL and server-side manual revocation flag. When valid, issues an ultra-short 2-minute pre-signed download URL. |
| **Auditing** | Non-Repudiation | Centralized DynamoDB Activity Log capturing user IP, user-agent, timestamp, event type, and outcome. |

---

## 2. Least-Privilege IAM Execution Policy

The Lambda execution role adheres strictly to least privilege:
- S3 access is restricted only to the specific vault bucket ARN: `arn:aws:s3:::<vault-bucket>/*`
- DynamoDB access is restricted only to the 3 application tables: `Vault_Documents`, `Vault_Shares`, and `Vault_ActivityLogs`.
- No wildcard `*` permissions are granted on data modification APIs.
