import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

/**
 * Custom hook for Socket.IO connection to backend
 * Handles live stream data from Jetson Nano devices
 */
export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [liveFrame, setLiveFrame] = useState(null);
  const [liveDetections, setLiveDetections] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState({});
  const [activeDevices, setActiveDevices] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    // Create socket connection
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('✅ Connected to backend:', socket.id, 'URL:', BACKEND_URL);
      setIsConnected(true);
      // Request active devices
      socket.emit('getActiveDevices');
    });

    socket.on('connected', (data) => {
      console.log('🔗 Backend connection confirmed:', data);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from backend');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
    });

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    // 🔴 Listen for the relayed 'stream' event from backend
    socket.on('stream', (data) => {
      console.log('📹 Received stream from backend:', data);
      setLiveFrame(data);
      if (data.detections && data.detections.length > 0) {
        setLiveDetections(prev => {
          // Keep last 50 detections
          const newDetections = [...data.detections.map(d => ({
            ...d,
            deviceId: data.deviceId,
            timestamp: data.timestamp,
            id: `${Date.now()}-${Math.random()}`
          })), ...prev];
          return newDetections.slice(0, 50);
        });
      }
    });

    // Legacy support for liveStream
    socket.on('liveStream', (data) => {
      console.log('📹 Received liveStream:', data);
      setLiveFrame(data);
      if (data.detections && data.detections.length > 0) {
        setLiveDetections(prev => {
          // Keep last 50 detections
          const newDetections = [...data.detections.map(d => ({
            ...d,
            deviceId: data.deviceId,
            timestamp: data.timestamp,
            id: `${Date.now()}-${Math.random()}`
          })), ...prev];
          return newDetections.slice(0, 50);
        });
      }
    });

    // Separate detection events
    socket.on('liveDetections', (data) => {
      console.log('🔴 Received liveDetections:', data);
      const { deviceId, detections, gps, timestamp } = data;
      setLiveDetections(prev => {
        const newDetections = detections.map(d => ({
          ...d,
          deviceId,
          gps,
          timestamp,
          id: `${Date.now()}-${Math.random()}`
        }));
        return [...newDetections, ...prev].slice(0, 50);
      });
    });

    // New detection saved to database
    socket.on('newDetection', (detection) => {
      console.log('🎯 Received newDetection from backend:', detection);
      setLiveDetections(prev => {
        const newDet = {
          id: detection._id || detection.detectionId,
          detectionId: detection.detectionId,
          type: detection.type,
          severity: detection.severity,
          confidence: detection.confidence,
          location: detection.location,
          gps: detection.gps || { latitude: 0, longitude: 0 },
          forwarded: detection.forwarded || false,
          timestamp: detection.detectedAt || new Date().toISOString(),
          deviceId: detection.deviceId
        };
        console.log('📥 Adding detection to state:', newDet);
        return [newDet, ...prev].slice(0, 50);
      });
    });

    // Device status updates
    socket.on('deviceStatus', (data) => {
      setDeviceStatus(prev => ({
        ...prev,
        [data.deviceId]: {
          ...data,
          lastUpdate: new Date()
        }
      }));
    });

    // Active devices list
    socket.on('activeDevices', (devices) => {
      setActiveDevices(devices);
    });

    // Device connection events
    socket.on('deviceConnected', ({ deviceId, timestamp }) => {
      console.log(`Device connected: ${deviceId}`);
      setActiveDevices(prev => {
        if (!prev.find(d => d.deviceId === deviceId)) {
          return [...prev, { deviceId, connectedAt: timestamp, lastSeen: timestamp }];
        }
        return prev;
      });
    });

    socket.on('deviceDisconnected', ({ deviceId }) => {
      console.log(`Device disconnected: ${deviceId}`);
      setActiveDevices(prev => prev.filter(d => d.deviceId !== deviceId));
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  // Watch a specific device's stream
  const watchDevice = useCallback((deviceId) => {
    if (socketRef.current) {
      socketRef.current.emit('watchDevice', deviceId);
    }
  }, []);

  // Request active devices
  const refreshDevices = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('getActiveDevices');
    }
  }, []);

  return {
    isConnected,
    liveFrame,
    liveDetections,
    deviceStatus,
    activeDevices,
    watchDevice,
    refreshDevices,
    socket: socketRef.current
  };
}

/**
 * Hook for fetching data from backend API
 */
export function useApi() {
  const baseUrl = BACKEND_URL;

  const fetchDetections = useCallback(async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${baseUrl}/api/detections?${query}`);
    return response.json();
  }, [baseUrl]);

  const fetchLatestDetections = useCallback(async (limit = 10) => {
    const response = await fetch(`${baseUrl}/api/detections/latest?limit=${limit}`);
    return response.json();
  }, [baseUrl]);

  const fetchRealtimeData = useCallback(async () => {
    const response = await fetch(`${baseUrl}/api/detections/realtime`);
    return response.json();
  }, [baseUrl]);

  const fetchStats = useCallback(async () => {
    const response = await fetch(`${baseUrl}/api/detections/stats`);
    return response.json();
  }, [baseUrl]);

  const fetchTickets = useCallback(async () => {
    const response = await fetch(`${baseUrl}/api/tickets`);
    return response.json();
  }, [baseUrl]);

  const fetchLiveStatus = useCallback(async () => {
    const response = await fetch(`${baseUrl}/api/live/status`);
    return response.json();
  }, [baseUrl]);

  const fetchLiveFrame = useCallback(async (deviceId) => {
    const response = await fetch(`${baseUrl}/api/live/frame/${deviceId}`);
    return response.json();
  }, [baseUrl]);

  const forwardDetection = useCallback(async (detectionId) => {
    const response = await fetch(`${baseUrl}/api/detections/${detectionId}/forward`, {
      method: 'POST'
    });
    return response.json();
  }, [baseUrl]);

  const updateTicketStatus = useCallback(async (ticketId, status) => {
    const response = await fetch(`${baseUrl}/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return response.json();
  }, [baseUrl]);

  return {
    fetchDetections,
    fetchLatestDetections,
    fetchRealtimeData,
    fetchStats,
    fetchTickets,
    fetchLiveStatus,
    fetchLiveFrame,
    forwardDetection,
    updateTicketStatus
  };
}

export default useSocket;
