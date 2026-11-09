# Database Schema & Data Models: Secure Digital Document Vault

## 1. DynamoDB Tables Architecture

We utilize an On-Demand Amazon DynamoDB multi-table design (tailored for beginner clarity and audit compliance in college project evaluation).

---

### Table 1: `Vault_Documents`
Stores primary document metadata and ownership.

- **Primary Key**:
  - Partition Key (`PK`): `userId` (String, e.g., Cognito `sub` UUID)
  - Sort Key (`SK`): `docId` (String, e.g., `DOC#<uuid>`)
- **Global Secondary Index (GSI)**: `ExpiryIndex`
  - GSI Partition Key: `status` (String, e.g., `ACTIVE`)
  - GSI Sort Key: `expiryDate` (String, ISO-8601: `YYYY-MM-DD`)
- **Attributes**:
  | Attribute | Type | Description |
  |---|---|---|
  | `userId` | String | Owner's Cognito User UUID (Identity subject) |
  | `docId` | String | Unique document identifier (`DOC#<uuid>`) |
  | `fileName` | String | Sanitized original file name (e.g., `degree_cert.pdf`) |
  | `fileType` | String | MIME type (e.g., `application/pdf`, `image/jpeg`) |
  | `fileSize` | Number | File size in bytes (max 10MB enforced) |
  | `s3Key` | String | S3 storage key: `vault/<userId>/<docId>/<fileName>` |
  | `category` | String | `Education`, `Identity`, `Financial`, `Medical`, `Other` |
  | `description` | String | Optional user notes or description |
  | `uploadedAt` | String | ISO-8601 upload timestamp |
  | `expiryDate` | String | Optional expiration date (`YYYY-MM-DD`), e.g., for Passport/Driving License |
  | `status` | String | `ACTIVE` \| `DELETED` |
  | `reminded` | Boolean | Flag to prevent repeated spam notifications for the same interval |

---

### Table 2: `Vault_Shares`
Stores time-limited, revocable document sharing records.

- **Primary Key**:
  - Partition Key (`PK`): `shareId` (String, cryptographically random UUID token)
- **Attributes**:
  | Attribute | Type | Description |
  |---|---|---|
  | `shareId` | String | Opaque share token passed in sharing URL |
  | `docId` | String | Referenced document UUID |
  | `ownerId` | String | Owner's Cognito User UUID |
  | `fileName` | String | Document filename displayed to recipient |
  | `fileType` | String | Document MIME type |
  | `s3Key` | String | S3 key for generating the temporary download URL |
  | `createdAt` | Number | Unix epoch timestamp (seconds) when share was created |
  | `expiresAt` | Number | Unix epoch timestamp (seconds) when share expires (DynamoDB TTL enabled) |
  | `isRevoked` | Boolean | True if user manually revoked access before expiration |
  | `accessCount` | Number | Counter of successful view/download hits |
  | `maxAccessCount` | Number | Optional limit on total views permitted (e.g. 5) |

---

### Table 3: `Vault_ActivityLogs`
Maintains security audit events for each user.

- **Primary Key**:
  - Partition Key (`PK`): `userId` (String, Cognito user ID)
  - Sort Key (`SK`): `timestamp` (String, ISO-8601, e.g., `2026-10-19T10:30:00.000Z#<uuid>`)
- **Attributes**:
  | Attribute | Type | Description |
  |---|---|---|
  | `userId` | String | Owner identifier |
  | `timestamp` | String | Event timestamp |
  | `eventType` | String | `LOGIN`, `UPLOAD`, `DOWNLOAD`, `SHARE_CREATED`, `SHARE_REVOKED`, `DOC_DELETED`, `UNAUTHORIZED_ACCESS` |
  | `ipAddress` | String | Client IP reported by API Gateway |
  | `userAgent` | String | Client browser/device user-agent string |
  | `status` | String | `SUCCESS` \| `FAILED` |
  | `details` | Map | Event-specific metadata (e.g., `{ docName: "aadhar.pdf", shareDuration: "1 hour" }`) |
