# Pothole Edge AI Detection Backend

Backend server for the Smart Car Pothole Detection System with MongoDB integration.

## Features

- **MongoDB Integration**: Local MongoDB connection for storing pothole detection data
- **RESTful API**: Complete API for managing detections, repair tickets, and device status
- **Real-time Updates**: Socket.IO integration for live data streaming from Jetson Nano
- **Device Management**: Track multiple Jetson Nano devices and their status

## Prerequisites

- Node.js 18+ 
- MongoDB (local installation or MongoDB Atlas)
- Jetson Nano with pothole.pt model loaded

## Installation

```bash
cd backend
npm install
```

## Configuration

Create a `.env` file (already provided) or modify the existing one:

```env
MONGODB_URI=mongodb://localhost:27017/pothole_detection
PORT=5000
FRONTEND_URL=http://localhost:5173
DEVICE_ID=JETSON-001
```

## Running the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## API Endpoints

### Detections

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/detections` | Submit new pothole detection |
| GET | `/api/detections` | Get all detections |
| GET | `/api/detections/stats` | Get detection statistics |
| GET | `/api/detections/latest` | Get latest detections |
| GET | `/api/detections/realtime` | Get real-time data including live stream |
| POST | `/api/detections/:id/forward` | Forward detection to PWD |

### Live Streaming

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/live/status` | Get live streaming status |
| GET | `/api/live/devices` | Get active streaming devices |
| GET | `/api/live/frame/:deviceId` | Get latest frame from device |
| POST | `/api/live/stream` | HTTP fallback for live stream |
| GET | `/api/live/events/:deviceId` | SSE endpoint for live updates |

### Repair Tickets

| Method | Endpoint | Description |
|--------|----------                   |-------------|
| GET    | `/api/tickets`              | Get all repair tickets |
| GET    | `/api/tickets/stats`        | Get ticket statistics |
| GET    | `/api/tickets/:id`          | Get single ticket |
| PATCH  | `/api/tickets/:id/status` | Update ticket status |
| PATCH  | `/api/tickets/:id/assign` | Assign crew to ticket |

### Devices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | Get all devices |
| GET | `/api/devices/:deviceId` | Get device status |
| POST | `/api/devices/status` | Update device status |
| POST | `/api/devices/:deviceId/heartbeat` | Device heartbeat |

## Jetson Nano Integration

### Sending Detection Data

```python
import requests

# Send pothole detection
detection_data = {
    "deviceId": "JETSON-001",
    "type": "Severe Pothole",
    "severity": "high",
    "confidence": 92.5,
    "location": "Main Street, Sector 14",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "boundingBox": {
        "x": 35,
        "y": 55,
        "width": 18,
        "height": 12
    }
}

response = requests.post(
    "http://<server-ip>:5000/api/detections",
    json=detection_data
)
print(response.json())
```

### Sending Device Status

```python
import requests

# Send device status update
status_data = {
    "deviceId": "JETSON-001",
    "temperature": 52,
    "cpuUsage": 65,
    "memoryUsage": 40,
    "signalStrength": 85,
    "mpuStatus": "Active",
    "cameraStatus": "Active",
    "gpsStatus": "Active",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "vehicleSpeed": 35,
    "inferenceRate": 30
}

response = requests.post(
    "http://<server-ip>:5000/api/devices/status",
    json=status_data
)
print(response.json())
```

## Socket.IO Events

### Client Events (Listen)
- `newDetection` - New pothole detected
- `newTicket` - New repair ticket created
- `ticketUpdated` - Ticket status changed
- `deviceStatus` - Device status update
- `liveStream` - Live video stream with detections
- `liveDetections` - Real-time detection data only
- `deviceConnected` - Device came online
- `deviceDisconnected` - Device went offline

### Server Events (Emit)
- `registerDevice` - Register a Jetson Nano device
- `watchDevice` - Subscribe to specific device stream
- `liveStream` - Stream video frame with detections
- `deviceStatusUpdate` - Update device status
- `getActiveDevices` - Request list of active devices

## Running the Jetson Nano Detection

Use the `pth.py` script to run the YOLOv8 pothole detection model on Jetson Nano:

```bash
# Basic usage (default camera and model)
python pth.py

# With custom options
python pth.py --model pothole.pt --server http://192.168.1.100:5000 --device JETSON-001 --camera 0

# Headless mode (no display)
python pth.py --headless
```

### pth.py Options

| Option | Default | Description |
|--------|---------|-------------|
| `--model` | `pothole.pt` | Path to YOLOv8 model file |
| `--server` | `http://localhost:5000` | Backend server URL |
| `--device` | `JETSON-001` | Device identifier |
| `--camera` | `0` | Camera index |
| `--headless` | `false` | Run without display |

### Required Python Packages (Jetson Nano)

```bash
pip install ultralytics opencv-python requests python-socketio[client]
# Optional for GPS
pip install pyserial
```

## Data Models

### PotholeDetection
```javascript
{
  detectionId: String,
  deviceId: String,
  type: String,
  severity: 'low' | 'medium' | 'high',
  confidence: Number,
  location: String,
  gps: { latitude: Number, longitude: Number },
  boundingBox: { x, y, width, height },
  imagePath: String,
  forwarded: Boolean,
  detectedAt: Date
}
```

### RepairTicket
```javascript
{
  ticketId: String,
  hazardType: String,
  severity: 'Low' | 'Medium' | 'High',
  location: String,
  gps: String,
  estimatedCost: Number,
  status: String,
  vehicleId: String,
  assignedCrew: String
}
```

### DeviceStatus
```javascript
{
  deviceId: String,
  isOnline: Boolean,
  temperature: Number,
  cpuUsage: Number,
  memoryUsage: Number,
  signalStrength: Number,
  mpuStatus: String,
  cameraStatus: String,
  inferenceRate: Number
}
```

## License

ISC
