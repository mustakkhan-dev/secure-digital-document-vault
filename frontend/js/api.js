import { CONFIG } from './config.js';
import { getAuthToken, logout } from './auth.js';

// Local storage key for demo mock data when running in offline preview
const MOCK_STORAGE_KEY = 'vault_mock_documents';
const MOCK_ACTIVITY_KEY = 'vault_mock_activities';
const MOCK_SHARES_KEY = 'vault_mock_shares';

function getMockDocs() {
  const data = localStorage.getItem(MOCK_STORAGE_KEY);
  if (!data) {
    const initial = [
      {
        docId: 'DOC#1a2b3c-demo',
        fileName: 'BTech_Degree_Certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 1425000,
        category: 'Education',
        description: 'Original University Degree Certificate',
        uploadedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        expiryDate: '2028-12-31',
        status: 'ACTIVE',
      },
      {
        docId: 'DOC#4d5e6f-demo',
        fileName: 'Passport_Scan.pdf',
        fileType: 'application/pdf',
        fileSize: 2840000,
        category: 'Identity',
        description: 'International travel document',
        uploadedAt: new Date(Date.now() - 86400000 * 12).toISOString(),
        expiryDate: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0], // Expiring in 14 days!
        status: 'ACTIVE',
      },
      {
        docId: 'DOC#7g8h9i-demo',
        fileName: 'Driving_License.png',
        fileType: 'image/png',
        fileSize: 950000,
        category: 'Identity',
        description: 'State Transport Driving Permit',
        uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        expiryDate: new Date(Date.now() + 86400000 * 45).toISOString().split('T')[0],
        status: 'ACTIVE',
      },
    ];
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
}

function logMockActivity(eventType, details, status = 'SUCCESS') {
  const current = JSON.parse(localStorage.getItem(MOCK_ACTIVITY_KEY) || '[]');
  current.unshift({
    timestamp: new Date().toISOString(),
    eventType,
    status,
    ipAddress: '127.0.0.1 (Local Client)',
    userAgent: navigator.userAgent.substring(0, 50) + '...',
    details,
  });
  localStorage.setItem(MOCK_ACTIVITY_KEY, JSON.stringify(current.slice(0, 50)));
}

/**
 * Fetch documents list
 */
export async function fetchDocuments() {
  if (CONFIG.enableDemoMode && CONFIG.apiBaseUrl.includes('xxxxxxxxxx')) {
    return { documents: getMockDocs() };
  }

  const token = getAuthToken();
  const res = await fetch(`${CONFIG.apiBaseUrl}/documents`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    logout();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

/**
 * Upload document flow:
 * 1. Request presigned S3 PUT URL from Lambda
 * 2. Upload file directly to S3 via PUT request
 */
export async function uploadDocument(file, metadata) {
  if (CONFIG.enableDemoMode && CONFIG.apiBaseUrl.includes('xxxxxxxxxx')) {
    // Simulate S3 Presigned Upload locally
    const docs = getMockDocs();
    const newDoc = {
      docId: `DOC#${Date.now()}`,
      fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      category: metadata.category || 'Other',
      description: metadata.description || '',
      uploadedAt: new Date().toISOString(),
      expiryDate: metadata.expiryDate || null,
      status: 'ACTIVE',
    };
    docs.unshift(newDoc);
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(docs));
    logMockActivity('UPLOAD', { fileName: newDoc.fileName, category: newDoc.category });
    return { success: true, document: newDoc };
  }

  const token = getAuthToken();

  // Step 1: Request Pre-signed S3 URL
  const step1Res = await fetch(`${CONFIG.apiBaseUrl}/documents/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      category: metadata.category,
      description: metadata.description,
      expiryDate: metadata.expiryDate,
    }),
  });

  if (!step1Res.ok) {
    const err = await step1Res.json();
    throw new Error(err.error || 'Failed to initiate secure upload');
  }

  const { uploadUrl, document: docRecord } = await step1Res.json();

  // Step 2: Upload raw file directly to S3
  const s3UploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!s3UploadRes.ok) {
    throw new Error('Direct S3 upload failed. Please check network and permissions.');
  }

  return { success: true, document: docRecord };
}

/**
 * Request download URL
 */
export async function getDownloadUrl(docId) {
  if (CONFIG.enableDemoMode && CONFIG.apiBaseUrl.includes('xxxxxxxxxx')) {
    logMockActivity('DOWNLOAD', { docId });
    // In demo mode, trigger a synthetic sample file download
    const blob = new Blob(['Demo Secure Digital Document Content for College Viva.'], { type: 'text/plain' });
    return { downloadUrl: URL.createObjectURL(blob), fileName: 'Sample_Vault_Document.txt' };
  }

  const token = getAuthToken();
  const res = await fetch(`${CONFIG.apiBaseUrl}/documents/${encodeURIComponent(docId)}/download`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Failed to retrieve secure download link');
  return res.json();
}

/**
 * Delete document
 */
export async function deleteDocument(docId) {
  if (CONFIG.enableDemoMode && CONFIG.apiBaseUrl.includes('xxxxxxxxxx')) {
    let docs = getMockDocs();
    const target = docs.find((d) => d.docId === docId);
    docs = docs.filter((d) => d.docId !== docId);
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(docs));
    logMockActivity('DOC_DELETED', { docId, fileName: target?.fileName });
    return { success: true };
  }

  const token = getAuthToken();
  const res = await fetch(`${CONFIG.apiBaseUrl}/documents/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Failed to delete document');
  return res.json();
}

/**
 * Create share link
 */
export async function createShareLink(docId, expiryMinutes = 60) {
  if (CONFIG.enableDemoMode && CONFIG.apiBaseUrl.includes('xxxxxxxxxx')) {
    const shareId = `share-${Date.now()}`;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60000).toISOString();
    const shares = JSON.parse(localStorage.getItem(MOCK_SHARES_KEY) || '{}');
    shares[shareId] = {
      shareId,
      docId,
      expiresAt,
      isRevoked: false,
    };
    localStorage.setItem(MOCK_SHARES_KEY, JSON.stringify(shares));
    logMockActivity('SHARE_LINK_CREATED', { docId, shareId, expiryMinutes });
    return { shareId, expiresAt };
  }

  const token = getAuthToken();
  const res = await fetch(`${CONFIG.apiBaseUrl}/shares`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ docId, expiryMinutes }),
  });

  if (!res.ok) throw new Error('Failed to create secure share link');
  return res.json();
}

/**
 * Resolve shared doc (Public endpoint)
 */
export async function resolveShareLink(shareId) {
  if (CONFIG.enableDemoMode && CONFIG.apiBaseUrl.includes('xxxxxxxxxx')) {
    const shares = JSON.parse(localStorage.getItem(MOCK_SHARES_KEY) || '{}');
    const share = shares[shareId];
    if (!share) throw new Error('Share link not found');
    if (share.isRevoked) throw new Error('This share link has been revoked by the owner.');
    if (new Date() > new Date(share.expiresAt)) throw new Error('This share link has expired.');

    const blob = new Blob(['Shared Document Content Preview'], { type: 'text/plain' });
    return {
      fileName: 'Shared_Demo_Document.txt',
      fileType: 'text/plain',
      downloadUrl: URL.createObjectURL(blob),
      expiresAt: share.expiresAt,
    };
  }

  const res = await fetch(`${CONFIG.apiBaseUrl}/shares/${encodeURIComponent(shareId)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to open shared document');
  }
  return res.json();
}

/**
 * Fetch security activity logs
 */
export async function fetchActivityLogs() {
  if (CONFIG.enableDemoMode && CONFIG.apiBaseUrl.includes('xxxxxxxxxx')) {
    const current = JSON.parse(localStorage.getItem(MOCK_ACTIVITY_KEY) || '[]');
    if (current.length === 0) {
      logMockActivity('LOGIN', { method: 'Cognito USER_PASSWORD_AUTH' });
    }
    return { activities: JSON.parse(localStorage.getItem(MOCK_ACTIVITY_KEY) || '[]') };
  }

  const token = getAuthToken();
  const res = await fetch(`${CONFIG.apiBaseUrl}/activity`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Failed to fetch activity logs');
  return res.json();
}
