# 📁 LAN File Uploader Flask Webapp

A simple web application built with **Flask**, allowing you to upload files from one device to another over the **same local network**.

---

## ✅ Features

- 🔗 **LAN Access**: Run on your local machine and access it from any other device connected to the same WiFi.
- 📤 **Multiple File Uploads**: Select and upload multiple files at once.
- 🚀 **Concurrent Uploads**: Upload up to 3 files simultaneously for faster transfers.
- 📊 **Real-time Progress**: Individual and total progress bars with live updates.
- 🌙 **Dark Mode**: Toggle dark mode (respects system preference).
- 🖱️ **Drag & Drop**: Drop files directly onto the upload zone.
- 📋 **Paste Support**: Copy files and paste with Ctrl+V.
- ⚡ **Speed & ETA**: See upload speed and estimated time remaining.
- 🔄 **Retry Failed Uploads**: One-click retry for failed or cancelled uploads.
- 🧹 **Clear Completed**: Remove finished uploads from the list.

---

## 🛠️ Installation Guide

### 1. Clone the repository

```bash
git clone https://github.com/alfa-echo-niner-ait/lan-file-uploader.git
cd lan-file-uploader
```

### 2. Create a virtual environment (optional but recommended)

```bash
python -m venv venv
# On Linux/macOS:
source venv/bin/activate
# On Windows:
.\venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Folder Structure

```
lan-file-uploader/
│
├── app.py
├── static/
│   ├── css/
│   │   └── bootstrap.min.css
│   ├── js/
│   │   ├── bootstrap.bundle.min.js
│   │   └── upload_handler.js
│   └── upload/         # Uploaded files will be saved here
│
└── templates/
    └── index.html
```

> 💡 You can download Bootstrap 5 CSS and JS from [getbootstrap.com](https://getbootstrap.com/docs/5.3/getting-started/download/).

### 5. Run the app

```bash
python app.py
```

The app will start on your local IP address, making it accessible from other devices on the same network.

---

## 📲 How to Use

1. Start the app.
2. Open a browser on another device connected to the same network.
3. Go to `http://<your-computer-ip>:5000`.
4. Select files by:
   - Clicking the drop zone to browse
   - Dragging and dropping files
   - Pasting from clipboard (Ctrl+V)
5. Click **Upload** or just drop files to start.
6. Watch real-time progress, speed, and ETA for each file.
7. Use retry buttons if any uploads fail.

---

## 📷 Demo

<div align="center">
  <img src="demo.png" alt="LAN File Uploader Demo" width="600">
</div>

---

## 📝 License

MIT License – feel free to modify and distribute as needed.
