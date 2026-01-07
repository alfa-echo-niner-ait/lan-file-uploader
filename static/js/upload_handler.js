class FileUploader {
    constructor() {
        this.uploadForm = document.getElementById('uploadForm');
        this.fileInput = document.getElementById('fileInput');
        this.uploadList = document.getElementById('uploadList');
        this.dropZone = document.getElementById('dropZone');
        this.totalProgressContainer = document.getElementById('totalProgress');
        this.totalProgressBar = document.getElementById('totalProgressBar');
        this.totalPercent = document.getElementById('totalPercent');
        this.clearCompletedBtn = document.getElementById('clearCompleted');
        this.fileCountEl = document.getElementById('fileCount');
        this.darkModeToggle = document.getElementById('darkModeToggle');

        this.maxConcurrentUploads = 3;
        this.uploadQueue = [];
        this.activeUploads = 0;
        this.xhrControllers = new Map();
        this.fileMetadata = new Map();
        this.startTimes = new Map();
        this.totalBytes = 0;
        this.uploadedBytes = 0;

        this.init();
    }

    init() {
        this.uploadForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.setupDragDrop();
        this.setupPaste();
        this.setupDarkMode();
        this.clearCompletedBtn.addEventListener('click', () => this.clearCompleted());
    }

    setupDragDrop() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, () => {
                this.dropZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, () => {
                this.dropZone.classList.remove('drag-over');
            });
        });

        this.dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length) {
                this.handleFiles(files);
            }
        });

        this.dropZone.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', () => {
            if (this.fileInput.files.length) {
                this.handleFiles(this.fileInput.files);
            }
        });
    }

    setupPaste() {
        document.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            const files = [];
            for (const item of items) {
                if (item.kind === 'file') {
                    files.push(item.getAsFile());
                }
            }
            if (files.length) {
                e.preventDefault();
                this.handleFiles(files);
            }
        });
    }

    setupDarkMode() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const savedTheme = localStorage.getItem('theme');

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.body.classList.add('dark-mode');
        }

        this.darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    handleFiles(files) {
        this.fileInput.files = files;
        this.handleSubmit(new Event('submit'));
    }

    handleSubmit(e) {
        e.preventDefault();
        const files = this.fileInput.files;

        if (!files.length) {
            this.showAlert('Please select at least one file.', 'warning');
            return;
        }

        this.uploadList.innerHTML = '';
        this.totalBytes = 0;
        this.uploadedBytes = 0;
        this.completedCount = 0;
        this.totalFileCount = files.length;

        for (const file of files) {
            this.totalBytes += file.size;
            this.fileMetadata.set(file.name, {
                loaded: 0,
                total: file.size,
                startTime: Date.now()
            });
        }

        this.updateTotalProgress();
        this.totalProgressContainer.classList.remove('d-none');

        for (const file of files) {
            this.uploadQueue.push(file);
        }

        this.processQueue();
    }

    processQueue() {
        while (this.uploadQueue.length > 0 && this.activeUploads < this.maxConcurrentUploads) {
            const file = this.uploadQueue.shift();
            this.startTimes.set(file.name, Date.now());
            this.uploadFile(file);
        }
    }

    uploadFile(file) {
        this.activeUploads++;
        const fileId = 'upload-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const uploadItem = this.createUploadItem(fileId, file);
        this.uploadList.appendChild(uploadItem);

        const formData = new FormData();
        formData.append('file', file);

        const controller = new AbortController();
        this.xhrControllers.set(fileId, controller);

        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                this.updateProgress(fileId, file.name, e.loaded, e.total);
            }
        });

        xhr.addEventListener('load', () => {
            this.handleComplete(fileId, file.name, xhr.status === 200);
        });

        xhr.addEventListener('error', () => {
            this.handleComplete(fileId, file.name, false);
        });

        xhr.addEventListener('abort', () => {
            this.handleComplete(fileId, file.name, false, true);
        });

        xhr.open('POST', '/');
        xhr.send(formData);
    }

    createUploadItem(fileId, file) {
        const div = document.createElement('div');
        div.className = 'upload-item card mb-2';
        div.id = fileId;

        const sizeFormatted = this.formatFileSize(file.size);

        div.innerHTML = `
            <div class="card-body p-2">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div class="d-flex align-items-center gap-2">
                        <span class="file-icon text-muted">📄</span>
                        <div>
                            <div class="fw-semibold file-name text-truncate" style="max-width: 200px;">${this.escapeHtml(file.name)}</div>
                            <small class="text-muted file-size">${sizeFormatted}</small>
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-outline-secondary cancel-btn" title="Cancel" style="display: none;">
                            ✕
                        </button>
                        <button class="btn btn-sm btn-outline-warning retry-btn d-none" title="Retry">
                            ↻
                        </button>
                    </div>
                </div>
                <div class="progress" style="height: 8px;">
                    <div class="progress-bar progress-bar-striped progress-bar-animated"
                         role="progressbar" style="width: 0%">
                    </div>
                </div>
                <div class="d-flex justify-content-between mt-1 align-items-center">
                    <div>
                        <small class="status-text text-muted">Waiting...</small>
                        <small class="speed-text text-muted ms-2 d-none"></small>
                        <small class="eta-text text-muted ms-2 d-none"></small>
                    </div>
                    <small class="percent-text">0%</small>
                </div>
            </div>
        `;

        const cancelBtn = div.querySelector('.cancel-btn');
        const retryBtn = div.querySelector('.retry-btn');

        cancelBtn.addEventListener('click', () => this.cancelUpload(fileId));
        retryBtn.addEventListener('click', () => this.retryUpload(file, fileId));

        return div;
    }

    updateProgress(fileId, fileName, loaded, total) {
        const item = document.getElementById(fileId);
        if (!item) return;

        const metadata = this.fileMetadata.get(fileName);
        if (metadata) {
            this.uploadedBytes += loaded - metadata.loaded;
            metadata.loaded = loaded;
        }

        const percent = Math.round((loaded / total) * 100);
        const progressBar = item.querySelector('.progress-bar');
        const percentText = item.querySelector('.percent-text');
        const speedText = item.querySelector('.speed-text');
        const etaText = item.querySelector('.eta-text');
        const cancelBtn = item.querySelector('.cancel-btn');

        progressBar.style.width = percent + '%';
        progressBar.setAttribute('aria-valuenow', percent);
        percentText.textContent = percent + '%';

        if (cancelBtn.style.display === 'none') {
            cancelBtn.style.display = 'inline-block';
        }

        const elapsed = (Date.now() - this.startTimes.get(fileName)) / 1000;
        if (elapsed > 0.5) {
            const speed = loaded / elapsed;
            const remaining = total - loaded;
            const eta = remaining / speed;

            speedText.textContent = this.formatFileSize(speed) + '/s';
            speedText.classList.remove('d-none');
            etaText.textContent = 'ETA: ' + this.formatTime(eta);
            etaText.classList.remove('d-none');
        }

        this.updateTotalProgress();
    }

    updateTotalProgress() {
        if (this.totalBytes === 0) return;

        const percent = Math.round((this.uploadedBytes / this.totalBytes) * 100);
        this.totalProgressBar.style.width = percent + '%';
        this.totalPercent.textContent = percent + '%';
    }

    updateFileCount() {
        if (this.completedCount >= this.totalFileCount) {
            this.fileCountEl.textContent = `${this.completedCount} / ${this.totalFileCount} files - All uploaded!`;
        } else {
            this.fileCountEl.textContent = `${this.completedCount} / ${this.totalFileCount} files`;
        }
    }

    handleComplete(fileId, fileName, success, cancelled = false) {
        const item = document.getElementById(fileId);
        if (!item) return;

        this.xhrControllers.delete(fileId);
        this.activeUploads--;

        const progressBar = item.querySelector('.progress-bar');
        const statusText = item.querySelector('.status-text');
        const speedText = item.querySelector('.speed-text');
        const etaText = item.querySelector('.eta-text');
        const cancelBtn = item.querySelector('.cancel-btn');
        const retryBtn = item.querySelector('.retry-btn');
        const fileIcon = item.querySelector('.file-icon');

        cancelBtn.remove();
        speedText.remove();
        etaText.remove();

        progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped');

        if (cancelled) {
            progressBar.classList.add('bg-secondary');
            progressBar.style.width = '100%';
            statusText.textContent = 'Cancelled';
            statusText.className = 'status-text text-secondary';
            fileIcon.textContent = '⚫';
            retryBtn.classList.remove('d-none');
        } else if (success) {
            this.completedCount++;
            progressBar.classList.add('bg-success');
            progressBar.style.width = '100%';
            statusText.textContent = 'Completed';
            statusText.className = 'status-text text-success';
            fileIcon.textContent = '✓';
            this.updateFileCount();
        } else {
            progressBar.classList.add('bg-danger');
            statusText.textContent = 'Failed';
            statusText.className = 'status-text text-danger';
            fileIcon.textContent = '✗';
            retryBtn.classList.remove('d-none');
        }

        this.updateTotalProgress();
        this.processQueue();
    }

    retryUpload(file, fileId) {
        const item = document.getElementById(fileId);
        if (!item) return;

        const progressBar = item.querySelector('.progress-bar');
        const statusText = item.querySelector('.status-text');
        const retryBtn = item.querySelector('.retry-btn');
        const fileIcon = item.querySelector('.file-icon');

        progressBar.classList.remove('bg-danger', 'bg-secondary', 'bg-success');
        progressBar.classList.add('progress-bar-striped', 'progress-bar-animated');
        progressBar.style.width = '0%';
        statusText.textContent = 'Retrying...';
        statusText.className = 'status-text text-muted';
        fileIcon.textContent = '📄';
        retryBtn.classList.add('d-none');

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-sm btn-outline-secondary cancel-btn';
        cancelBtn.title = 'Cancel';
        cancelBtn.textContent = '✕';
        cancelBtn.addEventListener('click', () => this.cancelUpload(fileId));
        item.querySelector('.action-buttons').prepend(cancelBtn);

        this.startTimes.set(file.name, Date.now());
        this.uploadQueue.unshift(file);
        this.processQueue();
    }

    cancelUpload(fileId) {
        const controller = this.xhrControllers.get(fileId);
        if (controller) {
            controller.abort();
            this.xhrControllers.delete(fileId);
        }
    }

    clearCompleted() {
        const items = this.uploadList.querySelectorAll('.upload-item');
        items.forEach(item => {
            const statusText = item.querySelector('.status-text');
            if (statusText && (statusText.textContent === 'Completed' || statusText.textContent === 'Cancelled')) {
                item.style.opacity = '0';
                item.style.transform = 'translateX(100%)';
                setTimeout(() => item.remove(), 300);
            }
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatTime(seconds) {
        if (seconds < 60) return Math.round(seconds) + 's';
        if (seconds < 3600) return Math.round(seconds / 60) + 'm';
        return Math.round(seconds / 3600) + 'h';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show text-center mb-3`;
        alertDiv.role = 'alert';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        const cardBody = this.uploadForm.closest('.card-body');
        const firstChild = cardBody.firstElementChild;
        cardBody.insertBefore(alertDiv, firstChild);

        setTimeout(() => {
            alertDiv.classList.remove('show');
            setTimeout(() => alertDiv.remove(), 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new FileUploader();
});
