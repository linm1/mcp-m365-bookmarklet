"""serve_https.py — stdlib-only HTTPS static file server for local development.

Usage:
    python scripts/serve_https.py [--cert CERT] [--key KEY] [--port PORT]
                                  [--root ROOT] [--host HOST]

Defaults: cert=localhost+1.pem, key=localhost+1-key.pem, port=3443,
          root=dist, host=0.0.0.0
"""

import argparse
import functools
import os
import ssl
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler with CORS and no-cache headers."""

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header(
            "Cache-Control", "no-store, no-cache, must-revalidate, max-age=0"
        )
        super().end_headers()

    def log_message(self, fmt, *args):  # keep output tidy
        sys.stderr.write(f"{self.address_string()} - {fmt % args}\n")


def main():
    parser = argparse.ArgumentParser(description="HTTPS static file server")
    parser.add_argument("--cert", default="localhost+1.pem")
    parser.add_argument("--key", default="localhost+1-key.pem")
    parser.add_argument("--port", type=int, default=3443)
    parser.add_argument("--root", default="dist")
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    root = os.path.realpath(args.root)

    if not os.path.isdir(root):
        print(
            f"ERROR: root directory '{args.root}' does not exist. "
            "Run 'npm run build' first.",
            file=sys.stderr,
        )
        sys.exit(1)

    for path, flag in ((args.cert, "--cert"), (args.key, "--key")):
        if not os.path.isfile(path):
            print(
                f"ERROR: TLS file '{path}' not found. "
                "Run 'bash scripts/gen_cert.sh' to generate it.",
                file=sys.stderr,
            )
            sys.exit(1)

    handler = functools.partial(NoCacheHandler, directory=root)

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(certfile=args.cert, keyfile=args.key)

    with ThreadingHTTPServer((args.host, args.port), handler) as server:
        server.socket = ctx.wrap_socket(server.socket, server_side=True)
        print(
            f"Serving HTTPS on https://{args.host}:{args.port}/ (root={root})"
        )
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
            sys.exit(0)


if __name__ == "__main__":
    main()
