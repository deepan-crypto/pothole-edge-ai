"""
Jetson Nano Pothole Detection Client
Sends detection data to the backend server

This script should be run on the Jetson Nano device
"""

import requests
import time
import json
from datetime import datetime
import random  # For demo purposes - replace with actual detection

# Configuration
SERVER_URL = "http://localhost:5000"  # Change to your server IP
DEVICE_ID = "JETSON-001"

class PotholeDetectionClient:
    def __init__(self, server_url, device_id):
        self.server_url = server_url
        self.device_id = device_id
        
    def send_detection(self, detection_data):
        """Send pothole detection to backend"""
        try:
            response = requests.post(
                f"{self.server_url}/api/detections",
                json={
                    "deviceId": self.device_id,
                    **detection_data
                },
                timeout=10
            )
            if response.status_code == 201:
                print(f"Detection sent successfully: {response.json()['data']['detectionId']}")
                return True
            else:
                print(f"Failed to send detection: {response.status_code}")
                return False
        except Exception as e:
            print(f"Error sending detection: {e}")
            return False
    
    def send_device_status(self, temperature, cpu_usage, memory_usage, 
                           signal_strength, latitude, longitude, 
                           vehicle_speed=0, inference_rate=30):
        """Send device status update"""
        try:
            response = requests.post(
                f"{self.server_url}/api/devices/status",
                json={
                    "deviceId": self.device_id,
                    "temperature": temperature,
                    "cpuUsage": cpu_usage,
                    "memoryUsage": memory_usage,
                    "signalStrength": signal_strength,
                    "mpuStatus": "Active",
                    "cameraStatus": "Active",
                    "gpsStatus": "Active",
                    "latitude": latitude,
                    "longitude": longitude,
                    "vehicleSpeed": vehicle_speed,
                    "inferenceRate": inference_rate
                },
                timeout=10
            )
            if response.status_code == 200:
                print("Device status updated")
                return True
            return False
        except Exception as e:
            print(f"Error sending status: {e}")
            return False
    
    def send_heartbeat(self):
        """Send heartbeat to keep device online"""
        try:
            response = requests.post(
                f"{self.server_url}/api/devices/{self.device_id}/heartbeat",
                timeout=5
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Heartbeat failed: {e}")
            return False


def demo_detection_loop():
    """
    Demo function to simulate pothole detections
    Replace this with actual YOLOv8 detection code
    """
    client = PotholeDetectionClient(SERVER_URL, DEVICE_ID)
    
    # Demo detection types
    detection_types = [
        "Severe Pothole",
        "Deep Pothole", 
        "Minor Pothole",
        "Asphalt Crack",
        "Manhole Depression",
        "Road Edge Erosion",
        "Surface Damage"
    ]
    
    # Demo locations (Delhi NCR area)
    locations = [
        ("Main St, Sector 14", 28.6139, 77.2090),
        ("Ring Road, Near Flyover", 28.6145, 77.2085),
        ("MG Road Junction", 28.6152, 77.2078),
        ("Industrial Area Phase 2", 28.6160, 77.2065),
        ("Gandhi Chowk", 28.6168, 77.2052),
        ("NH-48 Service Road", 28.6175, 77.2040),
        ("Civil Lines", 28.6182, 77.2028)
    ]
    
    print(f"Starting Pothole Detection Client...")
    print(f"Server: {SERVER_URL}")
    print(f"Device ID: {DEVICE_ID}")
    print("-" * 50)
    
    detection_count = 0
    
    while True:
        try:
            # Send device status every iteration
            client.send_device_status(
                temperature=random.randint(45, 65),
                cpu_usage=random.randint(40, 85),
                memory_usage=random.randint(30, 60),
                signal_strength=random.randint(70, 95),
                latitude=28.6139 + random.uniform(-0.01, 0.01),
                longitude=77.2090 + random.uniform(-0.01, 0.01),
                vehicle_speed=random.randint(20, 60),
                inference_rate=random.randint(25, 35)
            )
            
            # Simulate random detection (every 5-15 seconds)
            if random.random() > 0.7:  # 30% chance of detection
                location = random.choice(locations)
                severity = random.choice(["low", "medium", "high"])
                det_type = random.choice(detection_types)
                
                detection_data = {
                    "type": det_type,
                    "severity": severity,
                    "confidence": random.uniform(75, 98),
                    "location": location[0],
                    "latitude": location[1] + random.uniform(-0.001, 0.001),
                    "longitude": location[2] + random.uniform(-0.001, 0.001),
                    "boundingBox": {
                        "x": random.randint(10, 60),
                        "y": random.randint(40, 70),
                        "width": random.randint(10, 25),
                        "height": random.randint(8, 15)
                    }
                }
                
                if client.send_detection(detection_data):
                    detection_count += 1
                    print(f"Total detections sent: {detection_count}")
            
            # Wait before next iteration
            time.sleep(random.randint(3, 8))
            
        except KeyboardInterrupt:
            print("\nStopping detection client...")
            break
        except Exception as e:
            print(f"Error in detection loop: {e}")
            time.sleep(5)


if __name__ == "__main__":
    demo_detection_loop()
