import { useState, useEffect, useRef } from 'react'
import {
  Camera,
  Building2,
  Signal,
  Thermometer,
  Activity,
  MapPin,
  Gauge,
  Zap,
  AlertTriangle,
  Clock,
  Send,
  Users,
  IndianRupee,
  FileWarning,
  CheckCircle2,
  Truck,
  Timer,
  ChevronRight,
  Construction,
  Shield,
  Cpu,
  Radio,
  Eye,
  CircleDot
} from 'lucide-react'
import { useSocket } from './hooks/useSocket'

// ==================== MOCK DATA ====================

const initialHazardLogs = [
  { id: 1, timestamp: '14:02:05', severity: 'high', type: 'Severe Pothole', location: 'Main St, Sector 14', gps: '28.6139°N, 77.2090°E', forwarded: false },
  { id: 2, timestamp: '14:01:52', severity: 'medium', type: 'Asphalt Crack', location: 'Ring Road, Near Flyover', gps: '28.6145°N, 77.2085°E', forwarded: true },
  { id: 3, timestamp: '14:01:38', severity: 'high', type: 'Deep Pothole', location: 'MG Road Junction', gps: '28.6152°N, 77.2078°E', forwarded: false },
  { id: 4, timestamp: '14:01:15', severity: 'low', type: 'Minor Surface Damage', location: 'Industrial Area Phase 2', gps: '28.6160°N, 77.2065°E', forwarded: true },
  { id: 5, timestamp: '14:00:58', severity: 'medium', type: 'Manhole Depression', location: 'Gandhi Chowk', gps: '28.6168°N, 77.2052°E', forwarded: false },
  { id: 6, timestamp: '14:00:42', severity: 'high', type: 'Severe Pothole', location: 'NH-48 Service Road', gps: '28.6175°N, 77.2040°E', forwarded: true },
  { id: 7, timestamp: '14:00:25', severity: 'medium', type: 'Road Edge Erosion', location: 'Civil Lines', gps: '28.6182°N, 77.2028°E', forwarded: false },
]

const pwdRepairTickets = [
  { ticketId: 'PWD-2026-4521', hazardType: 'Severe Pothole', location: 'Main St, Sector 14', gps: '28.6139°N, 77.2090°E', estimatedCost: 12500, severity: 'High', status: 'Pending Approval', reportedTime: '14:02:05', vehicleId: 'SC-001' },
  { ticketId: 'PWD-2026-4520', hazardType: 'Asphalt Crack', location: 'Ring Road, Near Flyover', gps: '28.6145°N, 77.2085°E', estimatedCost: 8200, severity: 'Medium', status: 'Crew Dispatched', reportedTime: '14:01:52', vehicleId: 'SC-003' },
  { ticketId: 'PWD-2026-4519', hazardType: 'Deep Pothole', location: 'MG Road Junction', gps: '28.6152°N, 77.2078°E', estimatedCost: 15800, severity: 'High', status: 'Under Review', reportedTime: '14:01:38', vehicleId: 'SC-001' },
  { ticketId: 'PWD-2026-4518', hazardType: 'Manhole Depression', location: 'Gandhi Chowk', gps: '28.6168°N, 77.2052°E', estimatedCost: 22000, severity: 'Medium', status: 'Pending Approval', reportedTime: '14:00:58', vehicleId: 'SC-002' },
  { ticketId: 'PWD-2026-4517', hazardType: 'Severe Pothole', location: 'NH-48 Service Road', gps: '28.6175°N, 77.2040°E', estimatedCost: 18500, severity: 'High', status: 'Crew Dispatched', reportedTime: '14:00:42', vehicleId: 'SC-004' },
  { ticketId: 'PWD-2026-4516', hazardType: 'Road Edge Erosion', location: 'Civil Lines', gps: '28.6182°N, 77.2028°E', estimatedCost: 35000, severity: 'Medium', status: 'Approved', reportedTime: '14:00:25', vehicleId: 'SC-001' },
  { ticketId: 'PWD-2026-4515', hazardType: 'Water Damage', location: 'Connaught Place', gps: '28.6280°N, 77.2195°E', estimatedCost: 45000, severity: 'High', status: 'Repair Complete', reportedTime: '13:45:12', vehicleId: 'SC-002' },
  { ticketId: 'PWD-2026-4514', hazardType: 'Surface Cracks', location: 'Karol Bagh Main Road', gps: '28.6519°N, 77.1905°E', estimatedCost: 9800, severity: 'Low', status: 'Crew Dispatched', reportedTime: '13:30:45', vehicleId: 'SC-003' },
]

const boundingBoxes = [
  { id: 1, label: 'Severe Pothole (92%)', x: 35, y: 55, width: 18, height: 12, color: '#ef4444' },
  { id: 2, label: 'Asphalt Crack (88%)', x: 58, y: 62, width: 22, height: 8, color: '#eab308' },
  { id: 3, label: 'Minor Damage (76%)', x: 15, y: 70, width: 12, height: 10, color: '#f97316' },
]

// ==================== HEADER COMPONENT ====================

function Header({ signalStrength, jetsonTemp, mpuStatus }) {
  return (
    <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-cyan-900/50 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Shield className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Smart Car Edge-AI Telemetry</h1>
              <p className="text-xs text-slate-400">Real-time Road Hazard Detection System</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 ml-6 px-3 py-1.5 rounded-full border ${
            isConnected 
              ? 'bg-green-500/20 border-green-500/30' 
              : 'bg-red-500/20 border-red-500/30'
          }`}>
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 pulse-live' : 'bg-red-500'}`}></div>
            <span className={`text-sm font-medium ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {/* 4G Signal Strength */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <Signal className={`w-4 h-4 ${signalStrength > 70 ? 'text-green-400' : signalStrength > 40 ? 'text-yellow-400' : 'text-red-400'}`} />
            <div className="text-right">
              <p className="text-xs text-slate-400">4G Signal</p>
              <p className="text-sm font-semibold text-white">{signalStrength}%</p>
            </div>
          </div>
          
          {/* Jetson Nano Temp */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <Thermometer className={`w-4 h-4 ${jetsonTemp < 60 ? 'text-green-400' : jetsonTemp < 75 ? 'text-yellow-400' : 'text-red-400'}`} />
            <div className="text-right">
              <p className="text-xs text-slate-400">Jetson Nano</p>
              <p className="text-sm font-semibold text-white">{jetsonTemp}°C</p>
            </div>
          </div>
          
          {/* MPU6050 Status */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <Activity className={`w-4 h-4 ${mpuStatus === 'Active' ? 'text-green-400' : 'text-yellow-400'}`} />
            <div className="text-right">
              <p className="text-xs text-slate-400">MPU6050</p>
              <p className="text-sm font-semibold text-white">{mpuStatus}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

// ==================== SIDEBAR COMPONENT ====================

function Sidebar({ activeView, setActiveView }) {
  const navItems = [
    { id: 'dashcam', label: 'Live AI Dashcam', icon: Camera, description: 'Real-time detection' },
    { id: 'pwd', label: 'City PWD Portal', icon: Building2, description: 'Infrastructure mgmt' },
  ]

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      <nav className="flex-1 p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-3">Navigation</p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
              activeView === item.id
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-white'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white border border-transparent'
            }`}
          >
            <item.icon className={`w-5 h-5 ${activeView === item.id ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'}`} />
            <div className="text-left">
              <p className="font-medium text-sm">{item.label}</p>
              <p className="text-xs text-slate-500">{item.description}</p>
            </div>
            {activeView === item.id && <ChevronRight className="w-4 h-4 ml-auto text-cyan-400" />}
          </button>
        ))}
      </nav>
      
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">Edge Device</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Model:</span>
              <span className="text-white">Jetson Nano 4GB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">AI Model:</span>
              <span className="text-white">YOLOv5s-Custom</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">FPS:</span>
              <span className="text-green-400">24.8</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ==================== VIDEO FEED COMPONENT ====================

function VideoFeed() {
  return (
    <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl">
      {/* Video Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full border border-red-500/30">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-red-400">REC</span>
            </div>
            <span className="text-sm text-white/80">Front Camera - 1080p @ 30fps</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/20 rounded-full border border-cyan-500/30">
            <Eye className="w-3 h-3 text-cyan-400" />
            <span className="text-xs font-medium text-cyan-400">AI Active</span>
          </div>
        </div>
      </div>
      
      {/* Road Image Placeholder */}
      <div className="relative aspect-video bg-gradient-to-b from-slate-700 to-slate-800">
        {/* Road simulation */}
        <div className="absolute inset-0">
          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
            {/* Sky gradient */}
            <defs>
              <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e3a5f" />
                <stop offset="100%" stopColor="#4a6b8a" />
              </linearGradient>
              <linearGradient id="roadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#374151" />
                <stop offset="100%" stopColor="#1f2937" />
              </linearGradient>
            </defs>
            
            {/* Sky */}
            <rect x="0" y="0" width="100" height="45" fill="url(#skyGrad)" />
            
            {/* Road */}
            <polygon points="30,45 70,45 100,100 0,100" fill="url(#roadGrad)" />
            
            {/* Road markings */}
            <polygon points="48,50 52,50 55,100 45,100" fill="#9ca3af" opacity="0.6" />
            
            {/* Dashed center line */}
            <line x1="50" y1="55" x2="50" y2="62" stroke="#fbbf24" strokeWidth="0.8" />
            <line x1="50" y1="68" x2="50" y2="78" stroke="#fbbf24" strokeWidth="1" />
            <line x1="50" y1="84" x2="50" y2="96" stroke="#fbbf24" strokeWidth="1.2" />
            
            {/* Side elements */}
            <rect x="0" y="45" width="15" height="55" fill="#374151" />
            <rect x="85" y="45" width="15" height="55" fill="#374151" />
            
            {/* Trees/buildings silhouette */}
            <rect x="2" y="35" width="8" height="15" fill="#1e293b" rx="1" />
            <rect x="12" y="38" width="6" height="12" fill="#1e293b" rx="1" />
            <rect x="82" y="32" width="10" height="18" fill="#1e293b" rx="1" />
            <rect x="94" y="36" width="6" height="14" fill="#1e293b" rx="1" />
          </svg>
        </div>
        
        {/* Bounding Boxes */}
        {boundingBoxes.map((box) => (
          <div
            key={box.id}
            className="absolute bbox-animate"
            style={{
              left: `${box.x}%`,
              top: `${box.y}%`,
              width: `${box.width}%`,
              height: `${box.height}%`,
              border: `3px solid ${box.color}`,
              borderRadius: '4px',
              boxShadow: `0 0 20px ${box.color}40`,
            }}
          >
            <div
              className="absolute -top-6 left-0 px-2 py-0.5 text-xs font-bold rounded shadow-lg whitespace-nowrap"
              style={{ backgroundColor: box.color, color: 'white' }}
            >
              {box.label}
            </div>
          </div>
        ))}
        
        {/* Timestamp overlay */}
        <div className="absolute bottom-4 left-4 text-white/80 font-mono text-sm bg-black/50 px-3 py-1 rounded">
          2026-02-15 14:02:08
        </div>
        
        {/* AI inference info */}
        <div className="absolute bottom-4 right-4 flex items-center gap-4 text-white/80 text-sm bg-black/50 px-3 py-1 rounded">
          <span>Inference: 42ms</span>
          <span>Detections: 3</span>
        </div>
      </div>
    </div>
  )
}

// ==================== TELEMETRY PANEL COMPONENT ====================

function TelemetryPanel({ gps, speed, wakeStatus }) {
  return (
    <div className="space-y-4">
      {/* GPS Card */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">GPS Location</span>
        </div>
        <div className="font-mono text-lg text-cyan-400 mb-1">{gps.lat}</div>
        <div className="font-mono text-lg text-cyan-400">{gps.lng}</div>
        <p className="text-xs text-slate-400 mt-2">Accuracy: ±2.5m | Satellites: 12</p>
      </div>
      
      {/* Speed Card */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-white">Vehicle Speed</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-white">{speed}</span>
          <span className="text-lg text-slate-400">km/h</span>
        </div>
        <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-cyan-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(speed, 120) / 1.2}%` }}
          ></div>
        </div>
      </div>
      
      {/* Wake-On-Jolt Status */}
      <div className={`rounded-xl p-4 border ${
        wakeStatus === 'awake' 
          ? 'bg-amber-500/10 border-amber-500/30' 
          : 'bg-slate-800/50 border-slate-700/50'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <Zap className={`w-4 h-4 ${wakeStatus === 'awake' ? 'text-amber-400' : 'text-slate-500'}`} />
          <span className="text-sm font-medium text-white">Wake-On-Jolt</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            wakeStatus === 'awake' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'
          }`}></div>
          <span className={`text-lg font-semibold ${
            wakeStatus === 'awake' ? 'text-amber-400' : 'text-slate-400'
          }`}>
            {wakeStatus === 'awake' ? 'Awake (Vibration Detected)' : 'Asleep (Power Saving)'}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          {wakeStatus === 'awake' 
            ? 'MPU6050 triggered wake event - AI processing active' 
            : 'Monitoring for vehicle movement...'}
        </p>
      </div>
      
      {/* Radio Status */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-3">
          <Radio className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-white">Data Uplink</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Upload</p>
            <p className="text-white font-semibold">2.4 Mbps</p>
          </div>
          <div>
            <p className="text-slate-400">Latency</p>
            <p className="text-white font-semibold">45ms</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== HAZARD LOG COMPONENT ====================

function HazardLog({ logs, onForward }) {
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white">Real-Time Hazard Log</h3>
        </div>
        <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs font-medium rounded-full">
          {logs.length} Events
        </span>
      </div>
      
      <div className="max-h-64 overflow-y-auto log-scroll">
        {logs.map((log) => (
          <div key={log.id} className="p-4 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="flex items-center gap-1 text-slate-400 text-sm font-mono">
                    <Clock className="w-3 h-3" />
                    {log.timestamp}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${getSeverityColor(log.severity)}`}>
                    {log.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-white font-medium">{log.type} detected on {log.location}</p>
                <p className="text-slate-400 text-sm mt-1">GPS: {log.gps}</p>
              </div>
              
              <button
                onClick={() => onForward(log.id)}
                disabled={log.forwarded}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  log.forwarded
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
                }`}
              >
                {log.forwarded ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Sent
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Forward to PWD
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ==================== LIVE AI DASHCAM VIEW ====================

function LiveAIDashcam({ gps, speed, wakeStatus, hazardLogs, onForwardLog }) {
  return (
    <div className="flex-1 p-6 overflow-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
        {/* Main Video Feed */}
        <div className="xl:col-span-2 space-y-6">
          <VideoFeed />
          <HazardLog logs={hazardLogs} onForward={onForwardLog} />
        </div>
        
        {/* Telemetry Side Panel */}
        <div className="xl:col-span-1">
          <div className="sticky top-0">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CircleDot className="w-5 h-5 text-cyan-400" />
              Telemetry & Sensors
            </h3>
            <TelemetryPanel gps={gps} speed={speed} wakeStatus={wakeStatus} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== PWD PORTAL VIEW ====================

function PWDPortal({ tickets }) {
  const totalPotholes = tickets.length
  const totalBudget = tickets.reduce((sum, t) => sum + t.estimatedCost, 0)
  const activeCrews = tickets.filter(t => t.status === 'Crew Dispatched').length
  
  const getStatusStyle = (status) => {
    switch (status) {
      case 'Pending Approval': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'Approved': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Crew Dispatched': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'Under Review': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'Repair Complete': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }
  
  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'High': return 'bg-red-100 text-red-800 border-red-200'
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="flex-1 p-6 overflow-auto bg-gradient-to-br from-slate-100 via-slate-50 to-white">
      {/* PWD Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">City PWD Infrastructure Portal</h2>
            <p className="text-slate-500">Public Works Department - Automated Road Repair Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg w-fit">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-blue-700 font-medium">Connected to Smart Car Fleet - 47 Vehicles Active</span>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Potholes Reported</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{totalPotholes}</p>
              <p className="text-sm text-green-600 mt-2">↑ 12 from yesterday</p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl">
              <FileWarning className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Estimated Repair Budget</p>
              <p className="text-3xl font-bold text-slate-800 mt-1 flex items-center">
                <IndianRupee className="w-6 h-6" />
                {totalBudget.toLocaleString('en-IN')}
              </p>
              <p className="text-sm text-slate-500 mt-2">FY 2025-26 Q4 Allocation</p>
            </div>
            <div className="p-3 bg-green-50 rounded-xl">
              <IndianRupee className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Active Repair Crews</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{activeCrews}</p>
              <p className="text-sm text-blue-600 mt-2">8 crews on standby</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Construction className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-800">Automated Road Repair Proposals from Smart Car Fleet</h3>
          </div>
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-500">Last sync: 2 min ago</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ticket ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Hazard Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Est. Cost (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((ticket) => (
                <tr key={ticket.ticketId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4">
                    <span className="font-mono text-sm font-semibold text-blue-600">{ticket.ticketId}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-slate-800 font-medium">{ticket.hazardType}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="text-sm text-slate-800">{ticket.location}</p>
                      <p className="text-xs text-slate-400 font-mono">{ticket.gps}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-semibold text-slate-800">₹{ticket.estimatedCost.toLocaleString('en-IN')}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getSeverityStyle(ticket.severity)}`}>
                      {ticket.severity}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusStyle(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {ticket.status === 'Pending Approval' && (
                        <button className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                          Approve
                        </button>
                      )}
                      {ticket.status === 'Approved' && (
                        <button className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          Dispatch
                        </button>
                      )}
                      {(ticket.status === 'Crew Dispatched' || ticket.status === 'Under Review') && (
                        <button className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors">
                          View Details
                        </button>
                      )}
                      {ticket.status === 'Repair Complete' && (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Completed
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <span className="text-sm text-slate-500">Showing {tickets.length} of {tickets.length} entries</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Previous</button>
            <button className="px-3 py-1.5 text-sm text-white bg-blue-600 border border-blue-600 rounded-lg">1</button>
            <button className="px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== MAIN APP COMPONENT ====================

function App() {
  const [activeView, setActiveView] = useState('dashcam')
  const [signalStrength, setSignalStrength] = useState(85)
  const [jetsonTemp, setJetsonTemp] = useState(52)
  const [mpuStatus, setMpuStatus] = useState('Active')
  const [speed, setSpeed] = useState(45)
  const [wakeStatus, setWakeStatus] = useState('awake')
  const [gps, setGps] = useState({ lat: '28.6139°N', lng: '77.2090°E' })
  
  // Use real socket data
  const { isConnected, liveDetections } = useSocket()
  
  // Convert socket detections to hazard log format
  const hazardLogs = liveDetections.map((det, idx) => ({
    id: det.id || det.detectionId || idx,
    timestamp: det.timestamp ? new Date(det.timestamp).toLocaleTimeString() : '00:00:00',
    severity: det.severity || 'medium',
    type: det.type || 'Unknown',
    location: det.location || 'Unknown Location',
    gps: `${det.gps?.latitude?.toFixed(4) || '0.0000'}°N, ${det.gps?.longitude?.toFixed(4) || '0.0000'}°E`,
    forwarded: det.forwarded || false
  }))
  
  // Simulate live data updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Update signal strength
      setSignalStrength(prev => Math.max(60, Math.min(98, prev + (Math.random() - 0.5) * 8)))
      
      // Update Jetson temp
      setJetsonTemp(prev => Math.max(45, Math.min(70, prev + (Math.random() - 0.5) * 4)))
      
      // Update speed
      setSpeed(prev => Math.max(0, Math.min(80, prev + (Math.random() - 0.5) * 10)))
      
      // Update GPS slightly
      setGps(prev => ({
        lat: `${(28.6139 + (Math.random() - 0.5) * 0.001).toFixed(4)}°N`,
        lng: `${(77.2090 + (Math.random() - 0.5) * 0.001).toFixed(4)}°E`
      }))
      
      // Occasionally toggle wake status
      if (Math.random() > 0.95) {
        setWakeStatus(prev => prev === 'awake' ? 'asleep' : 'awake')
      }
    }, 2000)
    
    return () => clearInterval(interval)
  }, [])
  
  const handleForwardLog = (logId) => {
    // TODO: Implement forward detection to PWD
    console.log('Forward detection:', logId)
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Header 
        signalStrength={Math.round(signalStrength)} 
        jetsonTemp={Math.round(jetsonTemp)} 
        mpuStatus={mpuStatus} 
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeView={activeView} setActiveView={setActiveView} />
        
        {activeView === 'dashcam' ? (
          <LiveAIDashcam 
            gps={gps} 
            speed={Math.round(speed)} 
            wakeStatus={wakeStatus}
            hazardLogs={hazardLogs}
            onForwardLog={handleForwardLog}
          />
        ) : (
          <PWDPortal tickets={pwdRepairTickets} />
        )}
      </div>
    </div>
  )
}

export default App





