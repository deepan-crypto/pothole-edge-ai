"""
Pothole Detection Script for Jetson Nano
Runs YOLOv8 model and sends live detection data to backend server

Usage: python pth.py [--server SERVER_URL] [--device DEVICE_ID] [--camera CAMERA_INDEX]
"""

import cv2
import time
import json
import base64
import argparse
import threading
from datetime import datetime
from queue import Queue

try:
    from ultralytics import YOLO
except ImportError:
    print("Installing ultralytics...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'ultralytics'])
    from ultralytics import YOLO

try:
    import requests
except ImportError:
    print("Installing requests...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'requests'])
    import requests

try:
    import socketio
except ImportError:
    print("Installing python-socketio...")
    import subprocess
    subprocess.check_call(['pip', 'install', 'python-socketio[client]'])
    import socketio

# Try to import GPS library (optional)
try:
    import serial
    GPS_AVAILABLE = True
except ImportError:
    GPS_AVAILABLE = False
    print("Warning: pyserial not installed. GPS will use mock data.")


class GPSReader:
    """Read GPS data from serial port (NEO-6M module)"""
    
    def __init__(self, port='/dev/ttyUSB0', baudrate=9600):
        self.port = port
        self.baudrate = baudrate
        self.serial = None
        self.latitude = 28.6139  # Default: Delhi
        self.longitude = 77.2090
        self.speed = 0
        self.running = False
        
    def start(self):
        if GPS_AVAILABLE:
            try:
                self.serial = serial.Serial(self.port, self.baudrate, timeout=1)
                self.running = True
                threading.Thread(target=self._read_loop, daemon=True).start()
                print(f"GPS started on {self.port}")
            except Exception as e:
                print(f"GPS init failed: {e}. Using mock GPS.")
    
    def _read_loop(self):
        while self.running and self.serial:
            try:
                line = self.serial.readline().decode('ascii', errors='ignore')
                if line.startswith('$GPGGA') or line.startswith('$GPRMC'):
                    self._parse_nmea(line)
            except Exception as e:
                pass
    
    def _parse_nmea(self, sentence):
        """Parse NMEA sentence for GPS coordinates"""
        try:
            parts = sentence.split(',')
            if sentence.startswith('$GPRMC') and len(parts) >= 7:
                if parts[2] == 'A':  # Valid fix
                    lat = float(parts[3][:2]) + float(parts[3][2:]) / 60
                    if parts[4] == 'S':
                        lat = -lat
                    lon = float(parts[5][:3]) + float(parts[5][3:]) / 60
                    if parts[6] == 'W':
                        lon = -lon
                    self.latitude = lat
                    self.longitude = lon
                    if parts[7]:
                        self.speed = float(parts[7]) * 1.852  # knots to km/h
        except:
            pass
    
    def get_location(self):
        return {
            'latitude': self.latitude,
            'longitude': self.longitude,
            'speed': self.speed
        }
    
    def stop(self):
        self.running = False
        if self.serial:
            self.serial.close()


class SystemMonitor:
    """Monitor Jetson Nano system stats"""
    
    @staticmethod
    def get_temperature():
        try:
            with open('/sys/devices/virtual/thermal/thermal_zone0/temp', 'r') as f:
                return int(f.read()) / 1000.0
        except:
            return 45.0  # Default temp
    
    @staticmethod
    def get_cpu_usage():
        try:
            with open('/proc/stat', 'r') as f:
                line = f.readline()
                parts = line.split()
                idle = float(parts[4])
                total = sum(float(p) for p in parts[1:])
                return round((1 - idle/total) * 100, 1)
        except:
            return 50.0
    
    @staticmethod
    def get_memory_usage():
        try:
            with open('/proc/meminfo', 'r') as f:
                lines = f.readlines()
                total = int(lines[0].split()[1])
                available = int(lines[2].split()[1])
                return round((1 - available/total) * 100, 1)
        except:
            return 40.0


class PotholeDetector:
    """YOLOv8 Pothole Detection with live streaming to backend"""
    
    # Detection type mapping based on class names (adjust based on your model)
    DETECTION_TYPES = {
        0: 'Severe Pothole',
        1: 'Minor Pothole',
        2: 'Asphalt Crack',
        3: 'Manhole Depression',
        4: 'Road Edge Erosion',
        5: 'Surface Damage',
        6: 'Water Damage',
        'pothole': 'Severe Pothole',
        'crack': 'Asphalt Crack',
        'damage': 'Surface Damage'
    }
    
    def __init__(self, model_path, server_url, device_id, camera_index=0):
        self.model_path = model_path
        self.server_url = server_url.rstrip('/')
        self.device_id = device_id
        self.camera_index = camera_index
        
        # Initialize components
        self.model = None
        self.cap = None
        self.sio = None
        self.gps = GPSReader()
        self.monitor = SystemMonitor()
        
        # State
        self.running = False
        self.connected = False
        self.detection_count = 0
        self.frame_count = 0
        self.fps = 0
        self.last_fps_time = time.time()
        
        # Queue for detections
        self.detection_queue = Queue(maxsize=100)
        
    def load_model(self):
        """Load YOLOv8 model"""
        print(f"Loading model: {self.model_path}")
        try:
            self.model = YOLO(self.model_path)
            # Warm up model
            print("Warming up model...")
            dummy = cv2.imread(self.model_path.replace('.pt', '_dummy.jpg')) if False else None
            if dummy is None:
                dummy = (255 * cv2.resize(cv2.UMat(480, 640, cv2.CV_8UC3), (640, 480))).get() if hasattr(cv2, 'UMat') else None
            print("Model loaded successfully!")
            return True
        except Exception as e:
            print(f"Error loading model: {e}")
            return False
    
    def init_camera(self):
        """Initialize camera capture"""
        print(f"Initializing camera {self.camera_index}...")
        self.cap = cv2.VideoCapture(self.camera_index)
        
        if not self.cap.isOpened():
            print("Error: Could not open camera")
            return False
        
        # Set camera properties
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.cap.set(cv2.CAP_PROP_FPS, 30)
        
        print("Camera initialized successfully!")
        return True
    
    def connect_socket(self):
        """Connect to backend via Socket.IO"""
        print(f"Connecting to server: {self.server_url}")
        
        self.sio = socketio.Client(
            reconnection=True,
            reconnection_attempts=0,  # Infinite
            reconnection_delay=1,
            reconnection_delay_max=5
        )
        
        @self.sio.event
        def connect():
            print("Connected to backend server!")
            self.connected = True
            self.sio.emit('registerDevice', self.device_id)
        
        @self.sio.event
        def disconnect():
            print("Disconnected from server")
            self.connected = False
        
        @self.sio.event
        def connect_error(data):
            print(f"Connection error: {data}")
        
        try:
            self.sio.connect(self.server_url, transports=['websocket', 'polling'])
            return True
        except Exception as e:
            print(f"Socket connection failed: {e}")
            print("Will use HTTP fallback for detections")
            return False
    
    def get_severity(self, confidence, area):
        """Determine severity based on confidence and detection area"""
        if confidence >= 0.85 or area > 0.1:
            return 'high'
        elif confidence >= 0.65 or area > 0.05:
            return 'medium'
        else:
            return 'low'
    
    def get_detection_type(self, class_id, class_name):
        """Get human-readable detection type"""
        if class_id in self.DETECTION_TYPES:
            return self.DETECTION_TYPES[class_id]
        if class_name and class_name.lower() in self.DETECTION_TYPES:
            return self.DETECTION_TYPES[class_name.lower()]
        return 'Surface Damage'
    
    def encode_frame(self, frame, quality=50):
        """Encode frame to base64 JPEG"""
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return base64.b64encode(buffer).decode('utf-8')
    
    def process_frame(self, frame):
        """Run detection on frame"""
        results = self.model(frame, verbose=False, conf=0.5)
        detections = []
        
        height, width = frame.shape[:2]
        
        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    # Get box coordinates
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    confidence = float(box.conf[0])
                    class_id = int(box.cls[0])
                    class_name = result.names.get(class_id, 'pothole')
                    
                    # Calculate normalized coordinates
                    x_norm = x1 / width
                    y_norm = y1 / height
                    w_norm = (x2 - x1) / width
                    h_norm = (y2 - y1) / height
                    area = w_norm * h_norm
                    
                    detection = {
                        'type': self.get_detection_type(class_id, class_name),
                        'confidence': round(confidence * 100, 1),
                        'severity': self.get_severity(confidence, area),
                        'boundingBox': {
                            'x': round(x_norm * 100, 1),
                            'y': round(y_norm * 100, 1),
                            'width': round(w_norm * 100, 1),
                            'height': round(h_norm * 100, 1)
                        },
                        'raw': {
                            'x1': int(x1), 'y1': int(y1),
                            'x2': int(x2), 'y2': int(y2)
                        }
                    }
                    detections.append(detection)
                    
                    # Draw on frame
                    color = (0, 0, 255) if detection['severity'] == 'high' else \
                            (0, 165, 255) if detection['severity'] == 'medium' else (0, 255, 0)
                    cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
                    label = f"{detection['type']} {confidence:.0%}"
                    cv2.putText(frame, label, (int(x1), int(y1)-10), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        return frame, detections
    
    def send_detection_http(self, detection_data):
        """Send detection via HTTP POST"""
        try:
            response = requests.post(
                f"{self.server_url}/api/detections",
                json=detection_data,
                timeout=5
            )
            return response.status_code == 201
        except Exception as e:
            print(f"HTTP send failed: {e}")
            return False
    
    def send_live_data(self, frame, detections, gps_data):
        """Send live detection data to backend"""
        timestamp = datetime.now().isoformat()
        
        # Resize frame to ensure consistent size (640x480)
        frame_resized = cv2.resize(frame, (640, 480))
        
        # Prepare live stream data with optimized quality
        stream_data = {
            'deviceId': self.device_id,
            'timestamp': timestamp,
            'frame': self.encode_frame(frame_resized, quality=50),
            'detections': detections,
            'gps': gps_data,
            'stats': {
                'fps': self.fps,
                'temperature': self.monitor.get_temperature(),
                'cpuUsage': self.monitor.get_cpu_usage(),
                'memoryUsage': self.monitor.get_memory_usage(),
                'detectionCount': self.detection_count
            }
        }
        
        # Send via Socket.IO if connected
        if self.connected and self.sio:
            try:
                self.sio.emit('liveStream', stream_data)
            except Exception as e:
                print(f"❌ Socket emit failed: {e}")
        
        # For each new detection, also send via HTTP for database storage
        for det in detections:
            self.detection_count += 1
            detection_record = {
                'deviceId': self.device_id,
                'type': det['type'],
                'severity': det['severity'],
                'confidence': det['confidence'],
                'location': f"GPS: {gps_data['latitude']:.4f}, {gps_data['longitude']:.4f}",
                'latitude': gps_data['latitude'],
                'longitude': gps_data['longitude'],
                'boundingBox': det['boundingBox'],
                'timestamp': timestamp
            }
            
            # Queue for async sending
            if not self.detection_queue.full():
                self.detection_queue.put(detection_record)
    
    def send_device_status(self):
        """Send periodic device status update"""
        gps_data = self.gps.get_location()
        
        status_data = {
            'deviceId': self.device_id,
            'temperature': self.monitor.get_temperature(),
            'cpuUsage': self.monitor.get_cpu_usage(),
            'memoryUsage': self.monitor.get_memory_usage(),
            'signalStrength': 85,  # Could be read from network interface
            'mpuStatus': 'Active',
            'cameraStatus': 'Active',
            'gpsStatus': 'Active' if GPS_AVAILABLE else 'Mock',
            'latitude': gps_data['latitude'],
            'longitude': gps_data['longitude'],
            'vehicleSpeed': gps_data['speed'],
            'inferenceRate': self.fps
        }
        
        # Send via Socket.IO
        if self.connected and self.sio:
            self.sio.emit('deviceStatusUpdate', status_data)
        
        # Also send via HTTP
        try:
            requests.post(
                f"{self.server_url}/api/devices/status",
                json=status_data,
                timeout=3
            )
        except:
            pass
    
    def detection_sender_thread(self):
        """Background thread to send detections via HTTP"""
        while self.running:
            try:
                if not self.detection_queue.empty():
                    detection = self.detection_queue.get(timeout=1)
                    self.send_detection_http(detection)
                else:
                    time.sleep(0.1)
            except:
                pass
    
    def run(self):
        """Main detection loop"""
        print("\n" + "="*60)
        print("  POTHOLE DETECTION SYSTEM - JETSON NANO")
        print("="*60)
        
        # Initialize
        if not self.load_model():
            return
        if not self.init_camera():
            return
        
        self.gps.start()
        self.connect_socket()
        
        self.running = True
        
        # Start background threads
        sender_thread = threading.Thread(target=self.detection_sender_thread, daemon=True)
        sender_thread.start()
        
        status_interval = 5  # Send status every 5 seconds
        last_status_time = time.time()
        frame_count_for_fps = 0
        fps_start_time = time.time()
        
        print("\nStarting detection loop... Press 'q' to quit\n")
        
        try:
            while self.running:
                ret, frame = self.cap.read()
                if not ret:
                    print("Frame capture failed")
                    time.sleep(0.1)
                    continue
                
                # Process frame
                processed_frame, detections = self.process_frame(frame)
                
                # Calculate FPS
                frame_count_for_fps += 1
                elapsed = time.time() - fps_start_time
                if elapsed >= 1.0:
                    self.fps = round(frame_count_for_fps / elapsed, 1)
                    frame_count_for_fps = 0
                    fps_start_time = time.time()
                
                # Get GPS data
                gps_data = self.gps.get_location()
                
                # Send live data
                self.send_live_data(processed_frame, detections, gps_data)
                
                # Send status periodically
                if time.time() - last_status_time >= status_interval:
                    self.send_device_status()
                    last_status_time = time.time()
                
                # Display frame (optional - disable on headless Jetson)
                cv2.putText(processed_frame, f"FPS: {self.fps}", (10, 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                cv2.putText(processed_frame, f"Detections: {self.detection_count}", (10, 60), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                
                try:
                    cv2.imshow('Pothole Detection', processed_frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
                except:
                    pass  # No display available
                
                # Print status
                if detections:
                    for det in detections:
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] "
                              f"Detected: {det['type']} ({det['confidence']}%) - {det['severity'].upper()}")
                
        except KeyboardInterrupt:
            print("\nStopping...")
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Cleanup resources"""
        self.running = False
        print("Cleaning up...")
        
        if self.cap:
            self.cap.release()
        
        if self.sio and self.connected:
            self.sio.disconnect()
        
        self.gps.stop()
        cv2.destroyAllWindows()
        
        print(f"Session ended. Total detections: {self.detection_count}")


def main():
    parser = argparse.ArgumentParser(description='Pothole Detection for Jetson Nano')
    parser.add_argument('--model', type=str, default='pothole.pt',
                        help='Path to YOLOv8 model file (default: pothole.pt)')
    parser.add_argument('--server', type=str, default='https://pothole-edge-ai.onrender.com/',
                        help='Backend server URL (default: https://pothole-edge-ai.onrender.com/)')
    parser.add_argument('--device', type=str, default='JETSON-001',
                        help='Device ID (default: JETSON-001)')
    parser.add_argument('--camera', type=int, default=0,
                        help='Camera index (default: 0)')
    parser.add_argument('--headless', action='store_true',
                        help='Run without display')
    
    args = parser.parse_args()
    
    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║          Pothole Detection System - Jetson Nano               ║
╠═══════════════════════════════════════════════════════════════╣
║  Model:     {args.model:<48} ║
║  Server:    {args.server:<48} ║
║  Device:    {args.device:<48} ║
║  Camera:    {args.camera:<48} ║
╚═══════════════════════════════════════════════════════════════╝
    """)
    
    detector = PotholeDetector(
        model_path=args.model,
        server_url=args.server,
        device_id=args.device,
        camera_index=args.camera
    )
    
    detector.run()


if __name__ == "__main__":
    main()
















