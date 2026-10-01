import React from 'react';
import { Leaf, Sprout, ShieldCheck, TreePine } from 'lucide-react';

const NatureBasedSolutions = () => {
  return (
    <div className="p-8 w-full h-full overflow-y-auto bg-green-50/30">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4 py-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 mb-4">
            <Leaf className="w-10 h-10" />
          </div>
          <h2 className="text-4xl font-bold text-gray-800">Nature-Based Solutions (NbS)</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Harnessing the power of nature to build climate resilience and mitigate flood risks in Garissa County.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 border-t-4 border-t-green-500 hover:-translate-y-1 transition-transform cursor-pointer">
            <Sprout className="w-8 h-8 text-green-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Rangeland Rehabilitation</h3>
            <p className="text-gray-600 text-sm">
              Restoring degraded lands through controlled grazing and reseeding to improve soil water retention and reduce surface runoff during heavy rains.
            </p>
          </div>

          <div className="glass-panel p-6 border-t-4 border-t-green-600 hover:-translate-y-1 transition-transform cursor-pointer bg-white">
            <ShieldCheck className="w-8 h-8 text-green-700 mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Riparian Buffer Zones</h3>
            <p className="text-gray-600 text-sm">
              Protecting the Tana River banks with deep-rooted indigenous vegetation to stabilize soils and absorb floodwaters before they reach agricultural zones.
            </p>
          </div>

          <div className="glass-panel p-6 border-t-4 border-t-green-400 hover:-translate-y-1 transition-transform cursor-pointer">
            <TreePine className="w-8 h-8 text-green-500 mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Lagha Catchment Greening</h3>
            <p className="text-gray-600 text-sm">
              Strategic planting along seasonal riverbeds (Laghas) to slow down flash floods and encourage groundwater aquifer recharge.
            </p>
          </div>
        </div>

        {/* Placeholder Info */}
        <div className="glass-panel p-8 bg-green-800 text-white rounded-2xl mt-8">
          <div className="md:flex items-center justify-between">
            <div className="md:w-2/3 pr-6">
              <h3 className="text-2xl font-bold mb-3">Integrate Local Imagery</h3>
              <p className="text-green-100">
                The Google Drive folder contains highly contextualized images of Garissa's rangelands, bridge aerial views, and demonstration farms. 
                Using the agentic pipeline, Claude will automatically map these images into this dashboard for a rich, visual storytelling experience.
              </p>
            </div>
            <div className="md:w-1/3 mt-6 md:mt-0">
              <div className="w-full h-32 bg-green-700/50 rounded-xl flex items-center justify-center border border-green-600/50 border-dashed">
                <span className="text-green-200 font-medium">Image Gallery Placeholder</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default NatureBasedSolutions;
