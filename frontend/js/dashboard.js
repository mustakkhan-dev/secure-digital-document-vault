import { isAuthenticated, getCurrentUser, logout } from './auth.js';
import { fetchDocuments, uploadDocument, getDownloadUrl, deleteDocument, createShareLink } from './api.js';

// Verify authentication before rendering
if (!isAuthenticated()) {
  window.location.href = 'index.html';
}

const currentUser = getCurrentUser();
document.getElementById('userGreeting').textContent = currentUser?.email || currentUser?.name || 'User';
document.getElementById('logoutBtn').onclick = () => logout();

let allDocuments = [];
let selectedDocumentForShare = null;

// UI Elements
const tableBody = document.getElementById('documentsTableBody');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const statTotalDocs = document.getElementById('statTotalDocs');
const statExpiringDocs = document.getElementById('statExpiringDocs');

const uploadModal = document.getElementById('uploadModal');
const openUploadModalBtn = document.getElementById('openUploadModalBtn');
const bannerUploadBtn = document.getElementById('bannerUploadBtn');
const closeUploadModalBtn = document.getElementById('closeUploadModalBtn');
const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const selectedFileInfo = document.getElementById('selectedFileInfo');

const shareModal = document.getElementById('shareModal');
const closeShareModalBtn = document.getElementById('closeShareModalBtn');
const shareSetupSection = document.getElementById('shareSetupSection');
const shareResultSection = document.getElementById('shareResultSection');
const generateShareBtn = document.getElementById('generateShareBtn');
const shareUrlInput = document.getElementById('shareUrlInput');
const copyShareBtn = document.getElementById('copyShareBtn');
const shareExpiryTime = document.getElementById('shareExpiryTime');

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getExpiryBadge(expiryDateStr) {
  if (!expiryDateStr) {
    return '<span class="badge badge-secondary">No Expiry</span>';
  }
  const exp = new Date(expiryDateStr);
  const now = new Date();
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `<span class="badge badge-danger">Expired (${Math.abs(diffDays)}d ago)</span>`;
  } else if (diffDays <= 30) {
    return `<span class="badge badge-warning">Expiring in ${diffDays}d</span>`;
  } else {
    return `<span class="badge badge-success">Valid until ${expiryDateStr}</span>`;
  }
}

function renderTable(documents) {
  if (!documents || documents.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          <i class="fas fa-folder-open" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 0.5rem; display: block;"></i>
          No documents found in your vault. Click <strong>Upload Document</strong> to secure your first file.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = documents.map(doc => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <i class="far fa-file-pdf" style="font-size: 1.5rem; color: #dc2626;"></i>
          <div>
            <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(doc.fileName)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(doc.description || '')}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-secondary">${escapeHtml(doc.category || 'Other')}</span></td>
      <td>${formatBytes(doc.fileSize)}</td>
      <td style="color: var(--text-muted); font-size: 0.85rem;">
        ${new Date(doc.uploadedAt).toLocaleDateString()}
      </td>
      <td>${getExpiryBadge(doc.expiryDate)}</td>
      <td><span class="badge badge-success"><i class="fas fa-check"></i> ${escapeHtml(doc.status)}</span></td>
      <td style="text-align: right;">
        <div class="action-btn-group">
          <button class="btn-icon download" onclick="window.downloadDoc('${doc.docId}')" title="Download via Presigned S3 URL">
            <i class="fas fa-arrow-down-to-line"></i>
          </button>
          <button class="btn-icon share" onclick="window.openShareModal('${doc.docId}')" title="Generate Share Token">
            <i class="fas fa-share-nodes"></i>
          </button>
          <button class="btn-icon delete" onclick="window.deleteDoc('${doc.docId}', '${escapeHtml(doc.fileName)}')" title="Delete from S3 and Database">
            <i class="fas fa-trash-can"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function updateStats(docs) {
  statTotalDocs.textContent = docs.length;
  const now = new Date();
  const expiringCount = docs.filter(d => {
    if (!d.expiryDate) return false;
    const exp = new Date(d.expiryDate);
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }).length;
  statExpiringDocs.textContent = expiringCount;
}

function applyFilters() {
  const query = searchInput.value.toLowerCase();
  const cat = categoryFilter.value;

  const filtered = allDocuments.filter(doc => {
    const matchesQuery = doc.fileName.toLowerCase().includes(query) || (doc.description && doc.description.toLowerCase().includes(query));
    const matchesCat = (cat === 'ALL') || (doc.category === cat);
    return matchesQuery && matchesCat;
  });

  renderTable(filtered);
}

searchInput.oninput = applyFilters;
categoryFilter.onchange = applyFilters;

async function loadDocuments() {
  try {
    const res = await fetchDocuments();
    allDocuments = res.documents || [];
    renderTable(allDocuments);
    updateStats(allDocuments);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Download action attached to window
window.downloadDoc = async (docId) => {
  try {
    showToast('Requesting temporary S3 download authorization...', 'info');
    const { downloadUrl, fileName } = await getDownloadUrl(docId);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Download started securely.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// Delete action attached to window
window.deleteDoc = async (docId, fileName) => {
  if (!confirm(`Are you sure you want to permanently delete "${fileName}"? This will erase it from encrypted S3 storage and the metadata database.`)) {
    return;
  }
  try {
    await deleteDocument(docId);
    showToast(`"${fileName}" deleted successfully.`, 'success');
    loadDocuments();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// Share action attached to window
window.openShareModal = (docId) => {
  selectedDocumentForShare = docId;
  shareSetupSection.style.display = 'block';
  shareResultSection.style.display = 'none';
  shareModal.classList.add('active');
};

closeShareModalBtn.onclick = () => shareModal.classList.remove('active');

generateShareBtn.onclick = async () => {
  const duration = Number(document.getElementById('shareDuration').value);
  generateShareBtn.disabled = true;
  generateShareBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Token...';

  try {
    const res = await createShareLink(selectedDocumentForShare, duration);
    const origin = window.location.origin + window.location.pathname.replace('dashboard.html', '');
    const publicUrl = `${origin}shared.html?shareId=${res.shareId}`;

    shareUrlInput.value = publicUrl;
    shareExpiryTime.textContent = new Date(res.expiresAt).toLocaleString();

    shareSetupSection.style.display = 'none';
    shareResultSection.style.display = 'block';
    showToast('Secure sharing link generated!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    generateShareBtn.disabled = false;
    generateShareBtn.innerHTML = '<i class="fas fa-key"></i> Generate Secure Link';
  }
};

copyShareBtn.onclick = () => {
  navigator.clipboard.writeText(shareUrlInput.value);
  showToast('Share link copied to clipboard!', 'success');
};

// Upload Modal & Dropzone handling
openUploadModalBtn.onclick = () => uploadModal.classList.add('active');
if (bannerUploadBtn) {
  bannerUploadBtn.onclick = () => uploadModal.classList.add('active');
}
closeUploadModalBtn.onclick = () => uploadModal.classList.remove('active');

dropzone.onclick = () => fileInput.click();
dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('dragover'); };
dropzone.ondragleave = () => dropzone.classList.remove('dragover');
dropzone.ondrop = (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    fileInput.files = e.dataTransfer.files;
    showSelectedFile(fileInput.files[0]);
  }
};

fileInput.onchange = () => {
  if (fileInput.files.length > 0) {
    showSelectedFile(fileInput.files[0]);
  }
};

function showSelectedFile(file) {
  selectedFileInfo.style.display = 'block';
  selectedFileInfo.textContent = `Selected: ${file.name} (${formatBytes(file.size)})`;
}

uploadForm.onsubmit = async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) {
    showToast('Please select a file to upload', 'error');
    return;
  }

  const submitBtn = document.getElementById('uploadSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Encrypting & Uploading...';

  try {
    const metadata = {
      category: document.getElementById('docCategory').value,
      expiryDate: document.getElementById('docExpiry').value || null,
      description: document.getElementById('docDescription').value || '',
    };

    await uploadDocument(file, metadata);
    showToast('Document securely uploaded to S3 vault!', 'success');
    uploadModal.classList.remove('active');
    uploadForm.reset();
    selectedFileInfo.style.display = 'none';
    loadDocuments();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-lock"></i> Encrypt & Upload to S3';
  }
};

// Initial load
loadDocuments();
