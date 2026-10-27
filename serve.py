"""Servidor local de desarrollo sin caché (los cambios se ven al recargar).

Uso:  python serve.py  [puerto]   → http://localhost:5173
"""
import http.server
import os
import sys
import webbrowser

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print(f"Máquinas Eléctricas 3D → {url}  (Ctrl+C para detener)")
        if "--no-browser" not in sys.argv:
            webbrowser.open(url)
        httpd.serve_forever()
