import os
import socket
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
app.secret_key = "SECRET_KEY"

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400

        try:
            save_file(file)
            return jsonify({"success": True, "filename": file.filename})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # For normal GET or fallback
    return render_template('index.html')

def save_file(file):
    upload_folder = os.path.join(app.root_path, "static/upload/")
    os.makedirs(upload_folder, exist_ok=True)
    file_path = os.path.join(upload_folder, file.filename)
    file.save(file_path)

if __name__ == '__main__':
    host_ip4 = socket.gethostbyname(socket.gethostname())
    app.run(host=str(host_ip4), port=5000, debug=True)

    # app.run(debug=True) # Use this for local machine only
