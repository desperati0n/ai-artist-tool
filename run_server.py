import os
import json
import base64
import urllib.parse
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 8000
DATA_DIR = "data"
IMAGES_DIR = os.path.join(DATA_DIR, "images")
DATA_FILE = os.path.join(DATA_DIR, "data.json")

class APIHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # 1. Status check endpoint
        if self.path == "/api/status":
            self.send_json({"status": "ok"})
            
        # 2. Load all data (artists, categories, presets)
        elif self.path == "/api/load":
            data = {"artists": [], "categories": [], "presets": []}
            if os.path.exists(DATA_FILE):
                try:
                    with open(DATA_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                except Exception as e:
                    print(f"Error reading metadata file: {e}")
            self.send_json(data)
            
        # 3. Serve local images directly
        elif self.path.startswith("/api/images/"):
            # Extract image filename
            img_name = urllib.parse.unquote(self.path.split("/")[-1])
            img_path = os.path.join(IMAGES_DIR, img_name)
            
            if os.path.exists(img_path):
                try:
                    self.send_response(200)
                    # Simple content-type mapping
                    ext = os.path.splitext(img_name)[1].lower()
                    mime = "image/jpeg"
                    if ext == ".png":
                        mime = "image/png"
                    elif ext == ".gif":
                        mime = "image/gif"
                    elif ext == ".webp":
                        mime = "image/webp"
                        
                    self.send_header("Content-Type", mime)
                    self.send_header("Cache-Control", "max-age=86400") # Cache for a day
                    self.end_headers()
                    with open(img_path, "rb") as f:
                        self.wfile.write(f.read())
                except Exception as e:
                    print(f"Error serving image {img_name}: {e}")
                    self.send_error(500, f"Error serving image: {e}")
            else:
                self.send_error(404, "Image not found")
        else:
            # Fallback to serving static html/js/css files
            super().do_GET()

    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = json.loads(self.rfile.read(content_length).decode('utf-8'))
        except Exception as e:
            print(f"Error parsing POST JSON: {e}")
            self.send_error(400, "Invalid JSON payload")
            return

        # 4. Save metadata (artists list, categories list, presets list)
        if self.path == "/api/save-meta":
            try:
                os.makedirs(DATA_DIR, exist_ok=True)
                with open(DATA_FILE, "w", encoding="utf-8") as f:
                    json.dump(post_data, f, ensure_ascii=False, indent=4)
                self.send_json({"success": True})
            except Exception as e:
                print(f"Error saving metadata: {e}")
                self.send_json({"success": False, "error": str(e)})

        # 5. Save an uploaded cover image (decode base64 and write binary)
        elif self.path == "/api/save-image":
            try:
                os.makedirs(IMAGES_DIR, exist_ok=True)
                img_id = str(post_data["id"])
                
                # Check for format data:image/jpeg;base64,xxxx
                raw_image = post_data["image"]
                ext = ".jpg"
                if raw_image.startswith("data:image/png;base64,"):
                    ext = ".png"
                    img_data = raw_image.replace("data:image/png;base64,", "")
                elif raw_image.startswith("data:image/webp;base64,"):
                    ext = ".webp"
                    img_data = raw_image.replace("data:image/webp;base64,", "")
                elif raw_image.startswith("data:image/gif;base64,"):
                    ext = ".gif"
                    img_data = raw_image.replace("data:image/gif;base64,", "")
                else:
                    # Default/fallback to jpg
                    img_data = raw_image.split(",")[1] if "," in raw_image else raw_image
                
                img_name = f"{img_id}{ext}"
                img_path = os.path.join(IMAGES_DIR, img_name)
                
                with open(img_path, "wb") as f:
                    f.write(base64.b64decode(img_data))
                    
                # Return the server URL path
                self.send_json({"success": True, "url": f"/api/images/{img_name}"})
            except Exception as e:
                print(f"Error saving image: {e}")
                self.send_json({"success": False, "error": str(e)})

        # 6. Delete a cover image file
        elif self.path == "/api/delete-image":
            try:
                img_id = str(post_data["id"])
                deleted = False
                
                # Look for the file with any common image extension
                for ext in [".jpg", ".png", ".webp", ".gif"]:
                    img_path = os.path.join(IMAGES_DIR, f"{img_id}{ext}")
                    if os.path.exists(img_path):
                        os.remove(img_path)
                        deleted = True
                        
                self.send_json({"success": True, "deleted": deleted})
            except Exception as e:
                print(f"Error deleting image: {e}")
                self.send_json({"success": False, "error": str(e)})
        else:
            self.send_error(404, "API endpoint not found")

    def send_json(self, data):
        try:
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*") # Enable CORS for API
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
        except Exception as e:
            print(f"Error sending JSON response: {e}")

if __name__ == "__main__":
    # Ensure data directory structures exist
    os.makedirs(IMAGES_DIR, exist_ok=True)
    
    print("====================================================")
    print("AI Artist Manager Local Server")
    print(f"Open in browser: http://localhost:{PORT}")
    print(f"Storage Directory: {os.path.abspath(DATA_DIR)}")
    print("====================================================")
    
    try:
        server = HTTPServer(("localhost", PORT), APIHandler)
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
    except Exception as e:
        print(f"Server error: {e}")
