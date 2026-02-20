"""
demo_webcam.py — Laptop Webcam Demo Streamer
============================================
Use this to test the live feed on your Vercel dashboard WITHOUT a Jetson Nano.
It streams your laptop webcam in real-time to the backend, which forwards it
to the frontend. No YOLO model required.

Usage:
    python demo_webcam.py
    python demo_webcam.py --server https://pothole-edge-ai.onrender.com
    python demo_webcam.py --server http://localhost:5000   (for local backend)

Install dependencies:
    pip install opencv-python python-socketio[client] requests
"""

import cv2
import time
import base64
import random
import argparse
import threading
import requests

try:
    import socketio
except ImportError:
    import subprocess
    subprocess.check_call(['pip', 'install', 'python-socketio[client]'])
    import socketio

# ── Config ────────────────────────────────────────────────────────────────────
DEVICE_ID   = 'DEMO-LAPTOP-001'
FRAME_SKIP  = 3       # Send every Nth frame (~10 fps at 30fps camera)
JPEG_QUALITY = 50     # 0–100 (lower = smaller file, faster)
# ──────────────────────────────────────────────────────────────────────────────

FAKE_DETECTION_TYPES = [
    'Severe Pothole', 'Asphalt Crack', 'Minor Pothole',
    'Manhole Depression', 'Surface Damage'
]

class WebcamDemo:
    def __init__(self, server_url, camera_index=0):
        self.server_url = server_url.rstrip('/')
        self.camera_index = camera_index
        self.sio = None
        self.connected = False
        self.running = False
        self.frame_counter = 0
        self.fps = 0.0

    # ── Socket.IO connection ──────────────────────────────────────────────────

    def connect(self):
        self.sio = socketio.Client(
            reconnection=True,
            reconnection_attempts=0,   # infinite
            reconnection_delay=2,
            reconnection_delay_max=10
        )

        @self.sio.event
        def connect():
            print(f'✅ Connected to backend: {self.server_url}')
            self.connected = True
            self.sio.emit('registerDevice', DEVICE_ID)

        @self.sio.event
        def disconnect():
            print('⚠️  Disconnected from backend. Auto-reconnecting...')
            self.connected = False

        @self.sio.event
        def connect_error(data):
            print(f'❌ Connection error: {data}')

        try:
            print(f'🔌 Connecting to {self.server_url} ...')
            self.sio.connect(self.server_url, transports=['websocket', 'polling'])
            return True
        except Exception as e:
            print(f'❌ Could not connect via WebSocket: {e}')
            print('   Will use HTTP fallback for every frame.')
            return False

    # ── Keep-alive ────────────────────────────────────────────────────────────

    def _keep_alive_loop(self):
        """Ping Render every 9 min so it doesn't sleep."""
        print('💓 Keep-alive thread started')
        while self.running:
            for _ in range(540):          # 9 minutes × 60 seconds
                if not self.running:
                    return
                time.sleep(1)
            try:
                r = requests.get(f'{self.server_url}/api/health', timeout=10)
                print(f'💓 Keep-alive ping → {r.status_code}')
            except Exception as e:
                print(f'⚠️  Keep-alive failed: {e}')

    # ── Frame encoding ────────────────────────────────────────────────────────

    def encode_frame(self, frame):
        _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        return base64.b64encode(buf).decode('utf-8')

    # ── Fake detections (random, for demo only) ───────────────────────────────

    def _fake_detections(self):
        """Occasionally generate a fake bounding-box detection for demo purposes."""
        if random.random() > 0.15:   # ~15% of frames have a detection
            return []
        return [{
            'type':       random.choice(FAKE_DETECTION_TYPES),
            'confidence': round(random.uniform(65, 96), 1),
            'severity':   random.choice(['high', 'medium', 'low']),
            'boundingBox': {
                'x':      round(random.uniform(10, 60), 1),
                'y':      round(random.uniform(20, 55), 1),
                'width':  round(random.uniform(10, 25), 1),
                'height': round(random.uniform(8, 18), 1),
            }
        }]

    # ── Draw demo overlay on frame ────────────────────────────────────────────

    def _draw_overlay(self, frame, detections, fps):
        h, w = frame.shape[:2]
        # FPS counter
        cv2.putText(frame, f'FPS: {fps:.1f}', (10, 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.putText(frame, f'Streaming → {self.server_url}', (10, 56),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 220, 255), 1)
        cv2.putText(frame, f'Device: {DEVICE_ID}', (10, 78),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
        # Draw fake bounding boxes
        for det in detections:
            bb = det['boundingBox']
            x1 = int(bb['x'] / 100 * w)
            y1 = int(bb['y'] / 100 * h)
            x2 = x1 + int(bb['width'] / 100 * w)
            y2 = y1 + int(bb['height'] / 100 * h)
            color = (0, 0, 255) if det['severity'] == 'high' else \
                    (0, 165, 255) if det['severity'] == 'medium' else (0, 255, 0)
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            label = f"{det['type']} {det['confidence']}%"
            cv2.putText(frame, label, (x1, y1 - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        # Status dot
        dot_color = (0, 255, 0) if self.connected else (0, 0, 255)
        cv2.circle(frame, (w - 20, 20), 8, dot_color, -1)
        return frame

    # ── Send frame to backend ─────────────────────────────────────────────────

    def _send_frame(self, payload):
        # Primary: WebSocket
        if self.connected and self.sio:
            try:
                self.sio.emit('liveStream', payload)
                return
            except Exception as e:
                print(f'❌ Socket emit failed: {e} — falling back to HTTP')
        # Fallback: HTTP POST
        try:
            requests.post(f'{self.server_url}/api/live/stream',
                          json=payload, timeout=3)
        except Exception:
            pass   # Don't block the camera loop

    # ── Main loop ─────────────────────────────────────────────────────────────

    def run(self):
        cap = cv2.VideoCapture(self.camera_index)
        if not cap.isOpened():
            print(f'❌ Cannot open camera index {self.camera_index}')
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        print(f'📷 Camera {self.camera_index} opened (640×480)')

        self.connect()
        self.running = True

        # Keep-alive thread
        threading.Thread(target=self._keep_alive_loop, daemon=True).start()

        fps_t0 = time.time()
        fps_count = 0
        frame_idx = 0
        total_sent = 0

        print('\n🎬 Streaming started. Press Q in the preview window to quit.\n')

        while self.running:
            ret, frame = cap.read()
            if not ret:
                print('⚠️  Frame capture failed — retrying...')
                time.sleep(0.05)
                continue

            frame_idx += 1

            # FPS calculation
            fps_count += 1
            elapsed = time.time() - fps_t0
            if elapsed >= 1.0:
                self.fps = fps_count / elapsed
                fps_count = 0
                fps_t0 = time.time()

            # Generate fake detections for demo
            detections = self._fake_detections()

            # Draw overlay on local preview
            preview = self._draw_overlay(frame.copy(), detections, self.fps)
            cv2.imshow('Demo Webcam — press Q to quit', preview)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

            # Rate-limit: only send every Nth frame
            if frame_idx % FRAME_SKIP != 0:
                continue

            # Resize & encode
            frame_small = cv2.resize(frame, (640, 480))
            frame_b64 = self.encode_frame(frame_small)

            payload = {
                'deviceId':   DEVICE_ID,
                'timestamp':  time.strftime('%Y-%m-%dT%H:%M:%S'),
                'frame':      frame_b64,
                'detections': detections,
                'gps': {'latitude': 28.6139, 'longitude': 77.2090, 'speed': 0},
                'stats': {
                    'fps':            round(self.fps, 1),
                    'temperature':    38.5,    # fake
                    'cpuUsage':       45.0,    # fake
                    'memoryUsage':    52.0,    # fake
                    'detectionCount': total_sent,
                }
            }

            self._send_frame(payload)
            total_sent += 1

            if total_sent % 30 == 0:
                mode = '🔵 WebSocket' if self.connected else '🟡 HTTP fallback'
                det_count = len(detections)
                print(f'[{time.strftime("%H:%M:%S")}] Sent {total_sent} frames | '
                      f'{mode} | FPS: {self.fps:.1f} | Detections: {det_count}')

        # Cleanup
        self.running = False
        cap.release()
        cv2.destroyAllWindows()
        if self.sio and self.connected:
            self.sio.disconnect()
        print(f'\n✅ Done. Total frames sent: {total_sent}')


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Laptop webcam demo streamer')
    parser.add_argument('--server', default='https://pothole-edge-ai.onrender.com',
                        help='Backend URL (default: Render deployment)')
    parser.add_argument('--camera', type=int, default=0,
                        help='Camera index (default: 0 = built-in webcam)')
    args = parser.parse_args()

    print(f"""
╔══════════════════════════════════════════════════╗
║        Laptop Webcam Demo Streamer               ║
╠══════════════════════════════════════════════════╣
║  Server : {args.server:<39}║
║  Camera : {str(args.camera):<39}║
║  Device : {DEVICE_ID:<39}║
╚══════════════════════════════════════════════════╝
""")

    demo = WebcamDemo(server_url=args.server, camera_index=args.camera)
    demo.run()


if __name__ == '__main__':
    main()
