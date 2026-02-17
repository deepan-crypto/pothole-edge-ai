import { useEffect, useRef, useState } from 'react';
import { Eye, Radio, AlertTriangle } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';

/**
 * LiveVideoFeed Component
 * Displays real-time video feed from Jetson Nano with pothole detection overlays
 */
export default function LiveVideoFeed({ deviceId = 'JETSON-001' }) {
  const { isConnected, liveFrame, watchDevice } = useSocket();
  const canvasRef = useRef(null);
  const [fps, setFps] = useState(0);
  const [detectionCount, setDetectionCount] = useState(0);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  // Watch the device when component mounts
  useEffect(() => {
    if (isConnected && deviceId) {
      watchDevice(deviceId);
    }
  }, [isConnected, deviceId, watchDevice]);

  // Render frame to canvas
  useEffect(() => {
    if (liveFrame && liveFrame.frame && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Create image from base64 frame
      const img = new Image();
      img.onload = () => {
        // Set canvas size to match image
        canvas.width = img.width || 640;
        canvas.height = img.height || 480;
        
        // Draw image
        ctx.drawImage(img, 0, 0);
        
        // Draw detection bounding boxes
        if (liveFrame.detections) {
          liveFrame.detections.forEach(det => {
            const { boundingBox, type, confidence, severity } = det;
            
            // Convert percentage to pixels
            const x = (boundingBox.x / 100) * canvas.width;
            const y = (boundingBox.y / 100) * canvas.height;
            const w = (boundingBox.width / 100) * canvas.width;
            const h = (boundingBox.height / 100) * canvas.height;
            
            // Color based on severity
            const color = severity === 'high' ? '#ef4444' : 
                          severity === 'medium' ? '#eab308' : '#22c55e';
            
            // Draw box
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);
            
            // Draw label background
            const label = `${type} (${confidence}%)`;
            ctx.font = '14px sans-serif';
            const textWidth = ctx.measureText(label).width;
            ctx.fillStyle = color;
            ctx.fillRect(x, y - 22, textWidth + 10, 22);
            
            // Draw label text
            ctx.fillStyle = 'white';
            ctx.fillText(label, x + 5, y - 6);
          });
          
          setDetectionCount(liveFrame.detections.length);
        }
        
        // Calculate FPS
        frameCountRef.current++;
        const now = Date.now();
        if (now - lastTimeRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastTimeRef.current = now;
        }
      };
      
      img.src = `data:image/jpeg;base64,${liveFrame.frame}`;
    }
  }, [liveFrame]);

  return (
    <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl">
      {/* Video Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
              isConnected 
                ? 'bg-green-500/20 border-green-500/30' 
                : 'bg-red-500/20 border-red-500/30'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></div>
              <span className={`text-xs font-medium ${
                isConnected ? 'text-green-400' : 'text-red-400'
              }`}>
                {isConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            <span className="text-sm text-white/80">Device: {deviceId}</span>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/20 rounded-full border border-cyan-500/30">
            <Eye className="w-3 h-3 text-cyan-400" />
            <span className="text-xs font-medium text-cyan-400">AI Active</span>
          </div>
        </div>
      </div>
      
      {/* Video Canvas */}
      <div className="relative aspect-video bg-gradient-to-b from-slate-700 to-slate-800">
        {liveFrame ? (
          <canvas 
            ref={canvasRef}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Radio className="w-12 h-12 text-slate-500 mx-auto mb-4 animate-pulse" />
              <p className="text-slate-400">Waiting for live feed...</p>
              <p className="text-slate-500 text-sm mt-2">
                {isConnected ? 'Connected to server' : 'Connecting...'}
              </p>
            </div>
          </div>
        )}
        
        {/* Timestamp overlay */}
        <div className="absolute bottom-4 left-4 text-white/80 font-mono text-sm bg-black/50 px-3 py-1 rounded">
          {liveFrame?.timestamp ? new Date(liveFrame.timestamp).toLocaleString() : '--'}
        </div>
        
        {/* Stats overlay */}
        <div className="absolute bottom-4 right-4 flex items-center gap-4 text-white/80 text-sm bg-black/50 px-3 py-1 rounded">
          <span>FPS: {liveFrame?.stats?.fps || fps}</span>
          <span>Detections: {detectionCount}</span>
        </div>
        
        {/* Detection alert */}
        {detectionCount > 0 && (
          <div className="absolute top-16 right-4 flex items-center gap-2 px-3 py-2 bg-red-500/20 border border-red-500/50 rounded-lg animate-pulse">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">
              {detectionCount} Hazard{detectionCount > 1 ? 's' : ''} Detected
            </span>
          </div>
        )}
      </div>
      
      {/* Device Stats Bar */}
      {liveFrame?.stats && (
        <div className="p-3 bg-slate-800/50 border-t border-slate-700/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="text-slate-400">
              Temp: <span className="text-white">{liveFrame.stats.temperature?.toFixed(1)}°C</span>
            </span>
            <span className="text-slate-400">
              CPU: <span className="text-white">{liveFrame.stats.cpuUsage?.toFixed(0)}%</span>
            </span>
            <span className="text-slate-400">
              Memory: <span className="text-white">{liveFrame.stats.memoryUsage?.toFixed(0)}%</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Total Detections:</span>
            <span className="text-cyan-400 font-semibold">{liveFrame.stats.detectionCount || 0}</span>
          </div>
        </div>
      )}
    </div>
  );
}
