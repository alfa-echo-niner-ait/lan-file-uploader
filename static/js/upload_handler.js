class FileUploader {
    constructor() {
        this.uploadList = document.getElementById('uploadList');
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.totalProgressContainer = document.getElementById('totalProgress');
        this.totalProgressBar = document.getElementById('totalProgressBar');
        this.totalPercent = document.getElementById('totalPercent');
        this.clearCompletedBtn = document.getElementById('clearCompleted');
        this.fileCountEl = document.getElementById('fileCount');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.uploadBtnText = document.getElementById('uploadBtnText');
        this.selectedFilesContainer = document.getElementById('selectedFiles');
        this.selectedFilesCount = document.getElementById('selectedFilesCount');
        this.clearSelectionBtn = document.getElementById('clearSelection');

        this.maxConcurrentUploads = 3;
        this.uploadQueue = [];
        this.activeUploads = 0;
        this.xhrControllers = new Map();
        this.startTimes = new Map();
        this.totalBytes = 0;
        this.completedCount = 0;
        this.totalFileCount = 0;
        this.fileProgress = new Map();
        this.fileSizes = new Map();
        this.pendingFiles = null;
        this.isUploading = false;

        this.init();
    }

    init() {
        // Drop zone events
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && !this.isUploading) {
                this.handleFilesSelected(e.dataTransfer.files);
            }
        });

        // Click to browse - stop propagation to prevent dialog reopening
        this.dropZone.addEventListener('click', (e) => {
            if (this.isUploading) return;
            e.stopPropagation();
            this.fileInput.click();
        });

        // File input click - stop propagation
        this.fileInput.addEventListener('click', (e) => {
            if (this.isUploading) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            e.stopPropagation();
        });

        // File input change
        this.fileInput.addEventListener('change', () => {
            if (this.fileInput.files.length > 0 && !this.isUploading) {
                this.handleFilesSelected(this.fileInput.files);
            }
        });

        // Paste to upload
        document.addEventListener('paste', (e) => {
            if (this.isUploading) return;
            const items = e.clipboardData?.items;
            if (!items) return;

            const files = [];
            for (const item of items) {
                if (item.kind === 'file' && item.getAsFile()) {
                    files.push(item.getAsFile());
                }
            }
            if (files.length > 0) {
                e.preventDefault();
                this.handleFilesSelected(files);
            }
        });

        // Upload button click
        this.uploadBtn.addEventListener('click', () => {
            if (this.pendingFiles && !this.isUploading) {
                this.startUpload(this.pendingFiles);
            }
        });

        // Clear selection button
        this.clearSelectionBtn.addEventListener('click', () => {
            if (!this.isUploading) {
                this.clearSelection();
            }
        });

        // Clear completed button
        this.clearCompletedBtn.addEventListener('click', () => this.clearCompleted());
    }

    handleFilesSelected(files) {
        this.pendingFiles = files;
        this.selectedFilesContainer.classList.remove('hidden');
        this.selectedFilesCount.textContent = `${files.length} file${files.length > 1 ? 's' : ''} selected`;
        this.uploadBtn.disabled = false;
        this.uploadBtnText.textContent = `Upload ${files.length} File${files.length > 1 ? 's' : ''}`;
    }

    clearSelection() {
        this.pendingFiles = null;
        this.fileInput.value = '';
        this.selectedFilesContainer.classList.add('hidden');
        this.uploadBtn.disabled = true;
        this.uploadBtnText.textContent = 'Upload Files';
    }

    setUploadingState(isUploading) {
        this.isUploading = isUploading;

        // Disable/enable drop zone
        if (isUploading) {
            this.dropZone.classList.add('opacity-50', 'cursor-not-allowed');
            this.dropZone.classList.remove('hover:border-primary-400', 'hover:bg-gray-50', 'dark:hover:bg-gray-700/50');
        } else {
            this.dropZone.classList.remove('opacity-50', 'cursor-not-allowed');
            this.dropZone.classList.add('hover:border-primary-400', 'hover:bg-gray-50', 'dark:hover:bg-gray-700/50');
        }

        // Disable/enable file input
        this.fileInput.disabled = isUploading;

        // Disable/enable upload button
        this.uploadBtn.disabled = isUploading || !this.pendingFiles;

        // Update button text and icon
        if (isUploading) {
            this.uploadBtn.querySelector('i').className = 'ph ph-spinner animate-spin text-xl';
            this.uploadBtnText.textContent = 'Uploading...';
        } else {
            this.uploadBtn.querySelector('i').className = 'ph ph-upload-simple text-xl';
            this.uploadBtnText.textContent = this.pendingFiles
                ? `Upload ${this.pendingFiles.length} File${this.pendingFiles.length > 1 ? 's' : ''}`
                : 'Upload Files';
        }

        // Show/hide clear selection button
        this.clearSelectionBtn.style.display = isUploading ? 'none' : 'block';
    }

    startUpload(files) {
        // Clear previous uploads and reset state
        this.uploadList.innerHTML = '';
        this.uploadQueue = [...files];
        this.activeUploads = 0;
        this.completedCount = 0;
        this.totalFileCount = files.length;
        this.totalBytes = 0;
        this.xhrControllers.clear();
        this.startTimes.clear();
        this.fileProgress = new Map();
        this.fileSizes = new Map();

        // Calculate total bytes
        for (const file of files) {
            this.totalBytes += file.size;
            this.fileProgress.set(file.name, 0);
            this.fileSizes.set(file.name, file.size);
        }

        // Show total progress and hide selection
        this.totalProgressContainer.classList.remove('hidden');
        this.selectedFilesContainer.classList.add('hidden');
        this.calculateTotalProgress();
        this.updateFileCount();

        // Set uploading state
        this.setUploadingState(true);

        // Start uploading
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
            if (e.lengthComputable && e.total > 0) {
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
        div.className = 'upload-item p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600';
        div.id = fileId;

        const sizeFormatted = this.formatFileSize(file.size);

        div.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                        <i class="ph ph-file text-xl text-primary-600 dark:text-primary-400 file-icon"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[160px] sm:max-w-[200px]" title="${this.escapeHtml(file.name)}">${this.escapeHtml(file.name)}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">${sizeFormatted}</div>
                    </div>
                </div>
                <div class="action-buttons flex items-center gap-2">
                    <button class="cancel-btn p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0" title="Cancel" style="display: none;">
                        <i class="ph ph-x text-lg"></i>
                    </button>
                    <button class="retry-btn hidden p-2 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all" title="Retry">
                        <i class="ph ph-arrow-counter-clockwise text-lg"></i>
                    </button>
                </div>
            </div>
            <div class="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div class="progress-bar h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-300 animate-stripe"
                     style="width: 0%">
                </div>
            </div>
            <div class="flex justify-between items-center mt-2">
                <div class="flex items-center gap-2">
                    <span class="status-text text-sm text-gray-500 dark:text-gray-400">Waiting...</span>
                    <span class="speed-text text-sm text-gray-400 dark:text-gray-500 hidden"></span>
                    <span class="eta-text text-sm text-gray-400 dark:text-gray-500 hidden"></span>
                </div>
                <span class="percent-text text-sm font-medium text-primary-600 dark:text-primary-400">0%</span>
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

        const percent = Math.round((loaded / total) * 100);
        const progressBar = item.querySelector('.progress-bar');
        const percentText = item.querySelector('.percent-text');
        const speedText = item.querySelector('.speed-text');
        const etaText = item.querySelector('.eta-text');
        const cancelBtn = item.querySelector('.cancel-btn');

        progressBar.style.width = percent + '%';
        percentText.textContent = percent + '%';

        if (cancelBtn.style.display === 'none') {
            cancelBtn.style.display = 'flex';
            cancelBtn.classList.remove('opacity-0');
        }

        const elapsed = (Date.now() - this.startTimes.get(fileName)) / 1000;
        if (elapsed > 0.5 && loaded < total) {
            const speed = loaded / elapsed;
            const remaining = total - loaded;
            const eta = remaining / speed;

            speedText.textContent = this.formatFileSize(speed) + '/s';
            speedText.classList.remove('hidden');
            etaText.textContent = 'ETA: ' + this.formatTime(eta);
            etaText.classList.remove('hidden');
        }

        // Track per-file progress for total calculation
        this.fileProgress.set(fileName, loaded);
        this.calculateTotalProgress();
    }

    calculateTotalProgress() {
        if (this.totalBytes === 0) return;

        let totalUploaded = 0;
        for (const [name, bytes] of this.fileProgress) {
            totalUploaded += bytes;
        }

        const percent = Math.round((totalUploaded / this.totalBytes) * 100);
        this.totalProgressBar.style.width = Math.min(percent, 100) + '%';
        this.totalPercent.textContent = Math.min(percent, 100) + '%';
    }

    updateFileCount() {
        if (this.completedCount >= this.totalFileCount) {
            this.fileCountEl.textContent = `${this.completedCount} / ${this.totalFileCount} files - All uploaded!`;
            this.clearCompletedBtn.classList.remove('hidden');
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

        progressBar.classList.remove('animate-stripe');

        if (cancelled) {
            progressBar.classList.add('bg-gray-500');
            progressBar.classList.remove('from-primary-500', 'to-primary-400');
            progressBar.style.width = '100%';
            statusText.textContent = 'Cancelled';
            statusText.className = 'status-text text-gray-500 dark:text-gray-400';
            fileIcon.className = 'ph ph-slash text-xl text-gray-500';
        } else if (success) {
            this.completedCount++;
            progressBar.classList.add('bg-green-500');
            progressBar.classList.remove('from-primary-500', 'to-primary-400');
            progressBar.style.width = '100%';
            statusText.textContent = 'Completed';
            statusText.className = 'status-text text-green-600 dark:text-green-400';
            fileIcon.className = 'ph ph-check-circle text-xl text-green-500';
            this.updateFileCount();
        } else {
            progressBar.classList.add('bg-red-500');
            progressBar.classList.remove('from-primary-500', 'to-primary-400');
            progressBar.style.width = '100%';
            statusText.textContent = 'Failed';
            statusText.className = 'status-text text-red-600 dark:text-red-400';
            fileIcon.className = 'ph ph-x-circle text-xl text-red-500';
            retryBtn.classList.remove('hidden');
            retryBtn.style.display = 'flex';
        }

        // Update total progress - set to full file size on completion
        this.fileProgress.set(fileName, this.fileSizes.get(fileName) || 0);
        this.calculateTotalProgress();

        // Check if all uploads are complete
        if (this.completedCount + this.uploadQueue.length === this.totalFileCount) {
            // All uploads done (including failed/cancelled)
            this.setUploadingState(false);
            if (this.completedCount > 0) {
                showToast(`${this.completedCount} file${this.completedCount > 1 ? 's' : ''} uploaded successfully!`);
            }
            this.clearSelection();
        }

        this.processQueue();
    }

    retryUpload(file, fileId) {
        const item = document.getElementById(fileId);
        if (!item) return;

        const progressBar = item.querySelector('.progress-bar');
        const statusText = item.querySelector('.status-text');
        const retryBtn = item.querySelector('.retry-btn');
        const fileIcon = item.querySelector('.file-icon');

        progressBar.classList.remove('bg-red-500', 'bg-gray-500', 'bg-green-500');
        progressBar.classList.add('from-primary-500', 'to-primary-400');
        progressBar.style.width = '0%';
        progressBar.classList.add('animate-stripe');
        statusText.textContent = 'Retrying...';
        statusText.className = 'status-text text-gray-500 dark:text-gray-400';
        fileIcon.className = 'ph ph-file text-xl text-primary-600 dark:text-primary-400';
        retryBtn.classList.add('hidden');

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-btn p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all';
        cancelBtn.title = 'Cancel';
        cancelBtn.innerHTML = '<i class="ph ph-x text-lg"></i>';
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
        this.clearCompletedBtn.classList.add('hidden');
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
}

document.addEventListener('DOMContentLoaded', () => {
    new FileUploader();
});
