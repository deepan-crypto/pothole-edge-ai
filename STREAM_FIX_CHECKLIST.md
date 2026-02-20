# Video Stream Fix - Troubleshooting Checklist

## Problem
Video frames from Jetson Nano aren't reaching the Vercel frontend.

## Solution Implemented
✅ **Backend (Node.js/Render):** Now explicitly relays frames from Jetson to all frontend clients
✅ **Socket.IO:** Improved CORS and transport configuration for WebSocket + polling fallback
✅ **Frontend (React):** Now listens for both 'stream' (new) and 'liveStream' (legacy) events

---

## What to Check Before Running

### 1. **Jetson Nano Script (pth.py)**
- [ ] Verify the server URL is correct (should be your Render backend URL)
  ```bash
  # Run this on Jetson to test:
  python pth.py --server https://your-render-backend.onrender.com
  ```
- [ ] Check camera is available: `ls /dev/video*`
- [ ] Verify YOLOv8 model file exists: `ls pothole.pt`

### 2. **Backend Server (Render)**
- [ ] Restart the backend server after code changes
- [ ] Check backend logs for:
  ```
  ✅ Client connected: [socket-id]
  ✅ Device "JETSON-001" registered: [socket-id]
  🎥 Received liveStream from Jetson "JETSON-001"
  ```
- [ ] Verify environment variables:
  - `FRONTEND_URL` should be `https://pothole-edge-ai.vercel.app`
  - `MONGODB_URI` for database
  - `PORT` (should be 5000 or configured)

### 3. **Frontend (Vercel)**
- [ ] Open browser console (F12 → Console tab)
- [ ] Look for these messages:
  ```
  ✅ Connected to backend: [socket-id]
  📹 Received stream from backend: {...}
  ```
- [ ] If you see CORS errors, it means backend isn't allowing your Vercel domain

### 4. **Network & CORS**
- [ ] Backend CORS allows: `https://pothole-edge-ai.vercel.app`
- [ ] Backend uses HTTPS (not HTTP) since your frontend is HTTPS
- [ ] WebSocket and polling transports are enabled
- [ ] No mixed content warnings in browser console

---

## Step-by-Step Testing

### Test 1: Backend Connection Status
```bash
# SSH into your Render dashboard and check logs:
# You should see real-time connection logs when Jetson connects
```

### Test 2: Frontend Connection
1. Open https://pothole-edge-ai.vercel.app
2. Right-click → Inspect → Open Console tab
3. Should see: `✅ Connected to backend: [socket-id]`
4. Look for any errors starting with "CORS" or "Failed to connect"

### Test 3: Frame Streaming
1. Ensure Jetson is running (see "Jetson Nano Script" below)
2. Frontend console should show:
   ```
   📹 Received stream from backend: {deviceId: "JETSON-001", frame: "...", ...}
   ```
3. If nothing appears, check:
   - Is Jetson actually sending frames? (Check Jetson console logs)
   - Is backend receiving them? (Check server logs)
   - Is backend broadcasting them? (Check for io.emit('stream', data))

---

## How to Run Jetson Script

### Local Testing (USB Camera on PC)
```bash
python pth.py --server http://localhost:5000 --device JETSON-001 --camera 0
```

### Production (Real Jetson Nano)
```bash
python pth.py --server https://pothole-edge-ai.onrender.com --device JETSON-001 --camera 0
```

### With SSH (If Remote)
```bash
# From your computer:
ssh jetson@jetson.local
cd /path/to/pothole-edge-ai
python pth.py --server https://pothole-edge-ai.onrender.com
```

---

## Common Issues & Fixes

### Issue: "No Connection" on Frontend
**Solution:**
1. Check backend is running and has updated code
2. Verify FRONTEND_URL environment variable is set correctly
3. Clear browser cache: Ctrl+Shift+R
4. Check browser console for CORS errors

### Issue: Jetson Shows "Connected" but No Frames Appear
**Solution:**
1. Check if camera is accessible: `python -c "import cv2; cap = cv2.VideoCapture(0); print(cap.isOpened())"`
2. Verify model file: `ls pothole.pt` exists
3. Reduce frame quality to test: Edit pth.py line where it says `quality=40` → change to `quality=30`
4. Check frame size isn't too large: Should be 640×480 max

### Issue: "Mixed Content" Error
**Solution:**
- Ensure you're using HTTPS URLs everywhere
- Backend URL should be `https://...onrender.com` (not http)
- Frontend is already at `https://...vercel.app`

### Issue: CORS Error in Browser Console
**Solution:**
1. Verify Vercel domain is in backend CORS allowedOrigins
2. Add to backend: `https://pothole-edge-ai.vercel.app`
3. Restart backend server
4. Wait 30 seconds and refresh browser

---

## Real-Time Monitoring

### Backend Console (Render Dashboard)
Watch for these logs appearing every frame:
```
🎥 Received liveStream from Jetson "JETSON-001"
```

### Frontend Console (Browser DevTools)
Watch for these logs appearing every frame:
```
📹 Received stream from backend: {...}
```

### If You See Nothing:
The data is stopping somewhere. Check each link:
```
Jetson (pth.py) → Backend (server.js) → Frontend (useSocket.js)
```

---

## Frame Quality Optimization

Current setting: quality=40 (lower = smaller file, faster, blurrier)

To adjust quality in `pth.py` (line ~346):
```python
# Current
'frame': self.encode_frame(frame, quality=40),

# Try higher quality (larger file, slower)
'frame': self.encode_frame(frame, quality=60),

# Or lower for speed (smaller, blurrier)
'frame': self.encode_frame(frame, quality=25),
```

---

## Verify Code Changes Were Applied

Check that these changes exist in your code:

**backend/server.js:**
- Should have `io.emit('stream', data)` when receiving liveStream
- Should have Socket.IO transport: `['websocket', 'polling']`
- Should have `maxHttpBufferSize: 1e7`

**frontend/src/hooks/useSocket.js:**
- Should have listener: `socket.on('stream', (data) => {...})`
- Should set `setLiveFrame(data)`

---

## Next Steps If Still Not Working

1. **Check backend logs in Render dashboard** - Look for actual connection logs
2. **Test with simple test client** - Create a minimal Socket.IO client to verify backend sends data
3. **Check firewall/network** - Some networks block WebSocket; polling fallback should work
4. **Monitor bandwidth** - Large frames might timeout; reduce quality=40 → quality=25
5. **Enable debug logging** - Add console.logs in pth.py and frontend to trace data flow

