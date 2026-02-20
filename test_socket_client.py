#!/usr/bin/env python3
"""
Socket.IO Test Client for Pothole Detection Backend
This script tests if your backend is correctly:
1. Accepting connections
2. Receiving frames from Jetson
3. Broadcasting frames to frontend clients

Usage:
    python test_socket_client.py --server http://localhost:5000
    python test_socket_client.py --server https://pothole-edge-ai.onrender.com
"""

import socketio
import time
import sys
import argparse
import base64
import cv2
import numpy as np

class TestClient:
    def __init__(self, server_url, client_type='frontend'):
        """
        Initialize test client
        
        Args:
            server_url: Backend server URL
            client_type: 'frontend' (listen for frames) or 'jetson' (send test frames)
        """
        self.server_url = server_url.rstrip('/')
        self.client_type = client_type
        self.sio = socketio.Client(
            transports=['websocket', 'polling'],
            reconnection=True,
            reconnection_attempts=5,
            reconnection_delay=1
        )
        self.frame_counter = 0
        self.connected = False
        
        # Setup event handlers
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup Socket.IO event handlers"""
        
        @self.sio.event
        def connect():
            print(f"✅ Connected to {self.server_url}")
            self.connected = True
            
            if self.client_type == 'frontend':
                print("📺 Waiting for frames from Jetson...")
            elif self.client_type == 'jetson':
                print("📡 Registering as Jetson device...")
                self.sio.emit('registerDevice', 'TEST-JETSON-001')
        
        @self.sio.event
        def disconnect():
            print("❌ Disconnected from server")
            self.connected = False
        
        @self.sio.event
        def connect_error(data):
            print(f"❌ Connection error: {data}")
        
        @self.sio.event
        def error(data):
            print(f"❌ Socket error: {data}")
        
        if self.client_type == 'frontend':
            # Listen for frames
            @self.sio.on('stream')
            def on_stream(data):
                self.frame_counter += 1
                print(f"📹 [{self.frame_counter}] Received 'stream' event from Jetson: {data['deviceId']}")
                print(f"    Frame size: {len(data.get('frame', ''))} chars")
                print(f"    Detections: {len(data.get('detections', []))}")
                print(f"    Stats: {data.get('stats', {})}")
            
            @self.sio.on('liveStream')
            def on_livestream(data):
                self.frame_counter += 1
                print(f"📹 [{self.frame_counter}] Received 'liveStream' event from Jetson: {data['deviceId']}")
                print(f"    Frame size: {len(data.get('frame', ''))} chars")
                print(f"    Detections: {len(data.get('detections', []))}")
                print(f"    Stats: {data.get('stats', {})}")
        
        elif self.client_type == 'jetson':
            @self.sio.on('connected')
            def on_connected(data):
                print(f"🔗 Backend confirmed: {data}")
    
    def connect(self):
        """Connect to server"""
        try:
            print(f"🔗 Connecting to {self.server_url}...")
            self.sio.connect(self.server_url)
            return True
        except Exception as e:
            print(f"❌ Failed to connect: {e}")
            return False
    
    def send_test_frames(self, count=10, interval=1):
        """
        Send test video frames (Jetson simulation)
        
        Args:
            count: Number of frames to send
            interval: Seconds between frames
        """
        print(f"📤 Sending {count} test frames...")
        
        for i in range(count):
            try:
                # Create a simple test image
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                
                # Add some colored circles and text
                color = (0, 255, 0) if i % 2 == 0 else (255, 0, 0)
                cv2.circle(frame, (320, 240), 50 + (i * 5), color, -1)
                cv2.putText(frame, f"Test Frame {i+1}", (10, 30),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                
                # Encode to base64
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
                frame_b64 = base64.b64encode(buffer).decode('utf-8')
                
                # Prepare test frame data
                test_data = {
                    'deviceId': 'TEST-JETSON-001',
                    'timestamp': time.time(),
                    'frame': frame_b64,
                    'detections': [
                        {
                            'type': 'Test Pothole',
                            'confidence': 85.5 + (i % 10),
                            'severity': 'high' if i % 3 == 0 else 'medium',
                            'boundingBox': {'x': 25, 'y': 30, 'width': 40, 'height': 35}
                        }
                    ] if i % 2 == 0 else [],
                    'gps': {'latitude': 28.6139, 'longitude': 77.2090, 'speed': 45},
                    'stats': {
                        'fps': 30,
                        'temperature': 45.5,
                        'cpuUsage': 65.0,
                        'memoryUsage': 55.0,
                        'detectionCount': i + 1
                    }
                }
                
                # Send frame
                self.sio.emit('liveStream', test_data)
                print(f"  ✓ Sent frame {i+1}/{count}")
                
                # Wait before sending next
                time.sleep(interval)
            
            except Exception as e:
                print(f"  ❌ Error sending frame {i+1}: {e}")
    
    def listen(self, duration=30):
        \"\"\"
        Listen for frames from Jetson
        
        Args:
            duration: Seconds to listen
        \"\"\"
        print(f"🎧 Listening for {duration} seconds...")
        start_time = time.time()
        
        while time.time() - start_time < duration:
            if not self.connected:
                print("⚠️  Lost connection, attempting to reconnect...")
                time.sleep(2)
            else:
                time.sleep(1)
        
        print(f"✅ Listened for {self.frame_counter} frames")
    
    def disconnect(self):
        \"\"\"Disconnect from server\"\"\"
        if self.connected:
            self.sio.disconnect()
            print("👋 Disconnected")

def main():
    parser = argparse.ArgumentParser(
        description='Test Socket.IO connection to Pothole Detection Backend'
    )
    parser.add_argument(
        '--server',
        default='http://localhost:5000',
        help='Backend server URL (default: http://localhost:5000)'
    )
    parser.add_argument(
        '--type',
        choices=['frontend', 'jetson'],
        default='frontend',
        help='Client type: frontend (listen) or jetson (send)'
    )
    parser.add_argument(
        '--frames',
        type=int,
        default=10,
        help='Number of test frames to send (if type=jetson)'
    )
    parser.add_argument(
        '--listen',
        type=int,
        default=30,
        help='Seconds to listen (if type=frontend)'
    )
    
    args = parser.parse_args()
    
    # Create client
    client = TestClient(args.server, args.type)
    
    # Connect
    if not client.connect():
        sys.exit(1)
    
    # Allow time to stabilize connection
    time.sleep(1)
    
    try:
        if args.type == 'jetson':
            # Send test frames
            client.send_test_frames(count=args.frames)
            time.sleep(2)
            print("✅ Test frames sent!")
        else:
            # Listen for frames
            client.listen(duration=args.listen)
    
    except KeyboardInterrupt:
        print("\n⏸️  Interrupted by user")
    
    finally:
        client.disconnect()

if __name__ == '__main__':
    main()
