#!/usr/bin/env python3
"""Realistic Snake Pro - Local Web Server Runner.

Serves the browser edition so anyone on your Wi-Fi/local network can play,
or for testing before deploying to GitHub Pages/Netlify/Vercel.
"""

import http.server
import socket
import socketserver
import webbrowser
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


def get_local_ip():
    """Find local network IP address to share on local Wi-Fi / Teams."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Suppress verbose terminal log spam
        pass


def main():
    local_ip = get_local_ip()
    url_local = f"http://localhost:{PORT}"
    url_network = f"http://{local_ip}:{PORT}"

    print("=" * 65)
    print(" 🐍 REALISTIC SNAKE PRO - BROWSER SERVER IS LIVE! ")
    print("=" * 65)
    print(f"\n👉 Play on this machine:")
    print(f"   {url_local}")
    print(f"\n👉 Share on MS Teams / WhatsApp (same Wi-Fi / office network):")
    print(f"   {url_network}")
    print("\n🌐 Want a permanent free link for ANYONE in the world?")
    print("   1. GitHub Pages: Push this repo to GitHub and enable Pages in Settings.")
    print("   2. Netlify: Drag & drop the 'web' folder onto https://app.netlify.com/drop")
    print("=" * 65)
    print("Press Ctrl+C to stop the server.\n")

    # Automatically open local browser
    try:
        webbrowser.open(url_local)
    except Exception:
        pass

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
            sys.exit(0)


if __name__ == "__main__":
    main()
