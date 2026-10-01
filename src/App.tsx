import React, { useState } from 'react';
import { MapContainer, TileLayer, LayersControl, Circle, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Menu, Info, Map, AlertTriangle, Activity, Leaf, ShieldAlert } from 'lucide-react';
import Chatbot from './Chatbot';
import HealthAndWash from './HealthAndWash';
import NatureBasedSolutions from './NatureBasedSolutions';

const { BaseLayer, Overlay } = LayersControl;

const App = () => {
  const [activeTab, setActiveTab] = useState('map');
  const [showChatbot, setShowChatbot] = useState(false);

  return (
    <div className="flex flex-col h-screen w-full bg-garissa-light overflow-hidden font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white shadow-md z-20">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-garissa-red rounded-full flex items-center justify-center text-white font-bold text-xl shadow-inner">
            GC
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Garissa CSG Portal</h1>
            <p className="text-sm text-gray-500 font-medium tracking-wide">In conjunction with RedCross, NDMA & Partners</p>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="hidden md:flex space-x-2">
          <button onClick={() => setActiveTab('map')} className={`flex items-center px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'map' ? 'bg-garissa-red text-white' : 'text-gray-600 hover:bg-red-50 hover:text-garissa-red'}`}>
            <Map className="w-5 h-5 mr-2" /> GIS Map
          </button>
          <button onClick={() => setActiveTab('elnino')} className={`flex items-center px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'elnino' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-50 hover:text-orange-500'}`}>
            <AlertTriangle className="w-5 h-5 mr-2" /> El Niño Warning
          </button>
          <button onClick={() => setActiveTab('health')} className={`flex items-center px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'health' ? 'bg-garissa-water text-white' : 'text-gray-600 hover:bg-blue-50 hover:text-garissa-water'}`}>
            <Activity className="w-5 h-5 mr-2" /> Health & WASH
          </button>
          <button onClick={() => setActiveTab('nbs')} className={`flex items-center px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'nbs' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-green-50 hover:text-green-600'}`}>
            <Leaf className="w-5 h-5 mr-2" /> Nature-Based Solutions
          </button>
        </nav>
        
        <button className="md:hidden text-gray-600">
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex">
        {activeTab === 'map' && <MapDashboard onOpenChatbot={() => setShowChatbot(true)} />}
        {activeTab === 'elnino' && <ElNinoWarning />}
        {activeTab === 'health' && <HealthAndWash />}
        {activeTab === 'nbs' && <NatureBasedSolutions />}

        {showChatbot && <Chatbot />}
      </main>

      {/* Footer */}
      <footer className="bg-garissa-dark text-gray-300 py-3 px-6 text-sm flex justify-between items-center z-20">
        <p>Webportal powered by Garissa county Government Directorate of ICT and GIs.</p>
        <div className="flex space-x-4">
          <a href="mailto:james.mukoma@garissa.go.ke" className="hover:text-white transition-colors">james.mukoma@garissa.go.ke</a>
          <a href="mailto:emergency@garissa.go.ke" className="text-garissa-red font-bold hover:text-red-400 flex items-center">
            <ShieldAlert className="w-4 h-4 mr-1" /> emergency@garissa.go.ke
          </a>
        </div>
      </footer>
    </div>
  );
};

/* --- Component: MapDashboard --- */
const MapDashboard = ({ onOpenChatbot }: { onOpenChatbot: () => void }) => {
  const position: [number, number] = [-0.4532, 39.6401];

  return (
    <div className="relative w-full h-full flex">
      {/* Sidebar for Map Controls */}
      <div className="w-80 h-full glass-panel absolute left-4 top-4 bottom-4 z-20 flex flex-col p-4">
        <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Map Controls</h2>
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-semibold text-red-800 flex items-center"><Info className="w-4 h-4 mr-1"/> Default View</h3>
            <p className="text-sm text-red-600 mt-1">Showing Garissa County Boundary.</p>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-700 mb-2">Active Layers</h3>
            <p className="text-xs text-gray-500 mb-2">Use the layer icon on the top right of the map to toggle datasets.</p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span> Boreholes</li>
              <li className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span> Schools</li>
              <li className="flex items-center"><span className="w-3 h-3 rounded-full bg-cyan-400 mr-2"></span> Water Pans</li>
              <li className="flex items-center"><span className="w-3 h-3 rounded-full bg-orange-400 mr-2"></span> Flood Extents</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-auto pt-4 border-t">
          <button onClick={onOpenChatbot} className="w-full btn-primary flex justify-center items-center">
            Ask AI Assistant
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 h-full w-full">
        <MapContainer center={position} zoom={8} className="w-full h-full" zoomControl={false}>
          <LayersControl position="topright">
            <BaseLayer checked name="Google Hybrid">
              <TileLayer
                url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
                attribution="&copy; Google Maps"
              />
            </BaseLayer>
            <BaseLayer name="OpenStreetMap Standard">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
            </BaseLayer>
            <Overlay checked name="Tana River Buffer">
              <Circle center={position} pathOptions={{ fillColor: 'blue', color: 'blue' }} radius={10000}>
                <Popup>Tana River Flood Risk Buffer (10km)</Popup>
              </Circle>
            </Overlay>
          </LayersControl>
        </MapContainer>
      </div>
    </div>
  );
};

/* --- Component: ElNinoWarning --- */
const ElNinoWarning = () => {
  return (
    <div className="p-8 w-full h-full overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="glass-panel p-6 bg-red-50 border-red-200 shadow-sm">
          <h2 className="text-2xl font-bold text-red-800 flex items-center">
            <AlertTriangle className="w-8 h-8 mr-3" />
            EXTREME WEATHER ALERT: El Niño Season
          </h2>
          <p className="mt-2 text-red-700 font-medium">
            October 2026 Forecast (Kenya Met Dept): Above-average and heavy rainfall is likely to occur in Garissa and the Tana River catchment areas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Model Predictions (Next 2 Weeks)</h3>
            <div className="space-y-4">
              <div className="p-4 bg-red-100 rounded-lg border border-red-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-red-800">European Model & US AI</span>
                  <span className="px-2 py-1 bg-red-600 text-white text-xs rounded font-bold">HYPERAGGRESSIVE</span>
                </div>
                <p className="text-sm text-red-700">Predicting catastrophic flooding rains of up to <strong className="text-lg">350mm - 700mm</strong>.</p>
                <div className="w-full bg-red-200 h-2 rounded-full mt-2">
                  <div className="bg-red-600 h-2 rounded-full" style={{ width: '90%' }}></div>
                </div>
              </div>

              <div className="p-4 bg-orange-100 rounded-lg border border-orange-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-orange-800">American Model</span>
                  <span className="px-2 py-1 bg-orange-500 text-white text-xs rounded font-bold">MODEST</span>
                </div>
                <p className="text-sm text-orange-700">Predicting up to <strong className="text-lg">100mm</strong>. High likelihood this will be exceeded.</p>
                <div className="w-full bg-orange-200 h-2 rounded-full mt-2">
                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: '30%' }}></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="glass-panel p-6 flex flex-col items-center justify-center bg-white border border-gray-100 text-center">
            <Activity className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Recharts Time Series Placeholder</p>
            <p className="text-sm text-gray-400 mt-2">Historical vs Forecasted rainfall data integration pending.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
