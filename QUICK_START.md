# Quick Start - Video Stream Fix

## 🚀 Deploy the Fix (5 minutes)

### Step 1: Push Backend Code to Render
```bash
# Commit and push the backend changes
cd backend
git add .
git commit -m "Fix: Add stream relay for frontend video feed"
git push origin main
# Render auto-deploys ~2 minutes
```

### Step 2: Push Frontend Code to Vercel
```bash
# Commit and push the frontend changes
cd frontend
git add .
git commit -m "Fix: Add stream event listener for live video"
git push origin main
# Vercel auto-deployed ~1-2 minutes
```

### Step 3: Restart Jetson Script
```bash
# SSH into Jetson Nano
ssh jetson@jetson.local

# Kill old process (if running)
pkill -f pth.py

# Start with correct server URL (use HTTPS!)
python pth.py --server https://pothole-edge-ai.onrender.com --device JETSON-001 --camera 0

# You should see:
# ✅ Connecting to server: https://pothole-edge-ai.onrender.com
# Connected to backend server!
# ✅ Device "JETSON-001" registered: [socket-id]
```

---

## ✅ Verify in 30 Seconds

### Check Backend (Render)
1. Go to https://dashboard.render.com
2. Click on your backend service
3. Go to "Logs" tab
4. Should see:
   ```
   ✅ Device "JETSON-001" registered
   🎥 Received liveStream from Jetson "JETSON-001"
   🎥 Received liveStream from Jetson "JETSON-001"
   ```

### Check Frontend (Browser)
1. Open https://pothole-edge-ai.vercel.app
2. Press F12 (open DevTools)
3. Go to "Console" tab
4. Should see:
   ```
   ✅ Connected to backend: [socket-id]
   📹 Received stream from backend: {deviceId: "JETSON-001", ...}
   📹 Received stream from backend: {deviceId: "JETSON-001", ...}
   ```

### Check Video Appears
1. Look at the LiveVideoFeed component
2. Should show live video with detection boxes
3. FPS counter should be updating
4. "LIVE" indicator should be green and pulsing

---

## 🧪 Test Without Jetson (Optional)

If Jetson isn't ready yet, test the connection:

```bash
# Install socketio if needed
pip install python-socketio

# Test 1: Send frames from your computer
python test_socket_client.py --server https://pothole-edge-ai.onrender.com --type jetson --frames 5

# Test 2: Listen for frames
python test_socket_client.py --server https://pothole-edge-ai.onrender.com --type frontend --listen 30

# Should see:
# 📹 [1] Received 'stream' event from Jetson: TEST-JETSON-001
# 📹 [2] Received 'stream' event from Jetson: TEST-JETSON-001
```

---

## 🆘 If Video Still Doesn't Appear

### Debug Checklist

```bash
# 1. Check Jetson is connected
ssh jetson@jetson.local
ps aux | grep pth.py  # Should show running process

# 2. Check Jetson can reach backend
curl -v https://pothole-edge-ai.onrender.com

# 3. Check backend logs
# Go to: https://dashboard.render.com → [service] → Logs
# Search for: "JETSON-001"

# 4. Check frontend console
# Browser F12 → Console tab
# Look for any errors (red messages)

# 5. Test with local backend
# python pth.py --server http://localhost:5000 --device LOCAL-TEST
# Then: python test_socket_client.py --server http://localhost:5000 --type frontend
```

---

## 📊 What Changed

**Backend:** Now immediately broadcasts frames from Jetson to all frontend clients
**Frontend:** Now listens for 'stream' events and displays them
**Jetson:** Optimized frame quality for better performance

---

## 💡 Pro Tips

1. **Frame Quality Adjustment** (if video is blurry or too large):
   ```python
   # In pth.py, line ~351:
   'frame': self.encode_frame(frame_resized, quality=50),  # Change this number
   # 30 = small & fast, 70 = large & clear
   ```

2. **See Real-Time Logs**:
   ```bash
   # Render backend
   curl -H "Authorization: Bearer $RENDER_API_KEY" \
     https://api.render.com/v1/services/[service-id]/logs?limit=100

   # Or just watch dashboard
   ```

3. **Restart Services Cleanly**:
   ```bash
   # Jetson
   pkill -f pth.py
   sleep 2
   nohup python pth.py --server https://... > pth.log 2>&1 &

   # Backend: Go to Render dashboard → Manual Deploy
   # Frontend: Go to Vercel dashboard → Redeploy
   ```

---

## ⏱️ Expected Timeline

- Push changes: **2 minutes**
- Backend deploys: **2-3 minutes**
- Frontend deploys: **1-2 minutes**
- Jetson reconnects: **5 seconds**
- Video appears: **Immediately after step 3**

**Total: ~7-10 minutes**

