import React from 'react';
import { Activity, Droplets, Bug, AlertCircle, FileText } from 'lucide-react';

const HealthAndWash = () => {
  return (
    <div className="p-8 w-full h-full overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="glass-panel p-8 bg-gradient-to-r from-blue-50 to-white border-blue-200 shadow-sm">
          <h2 className="text-3xl font-bold text-garissa-water flex items-center mb-4">
            <Activity className="w-8 h-8 mr-3" />
            Health & WASH Analytics
          </h2>
          <p className="text-gray-700 text-lg">
            This module uses the Google Gemini Pro Python API to cross-reference projected El Niño flood zones with historical vector-borne disease outbreak data in Garissa County.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel p-6 border-l-4 border-l-red-500">
            <h3 className="text-xl font-bold text-gray-800 flex items-center mb-3">
              <Bug className="w-6 h-6 mr-2 text-red-500" /> Vector-Borne Risks
            </h3>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start">
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold mr-2 mt-0.5">HIGH</span>
                <div>
                  <strong>Rift Valley Fever (RVF):</strong> Elevated risk in Tana River livestock grazing zones.
                </div>
              </li>
              <li className="flex items-start">
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold mr-2 mt-0.5">HIGH</span>
                <div>
                  <strong>Malaria & Dengue:</strong> Stagnant water pooling in Laghas post-rainfall provides ideal mosquito breeding sites.
                </div>
              </li>
            </ul>
          </div>

          <div className="glass-panel p-6 border-l-4 border-l-garissa-water">
            <h3 className="text-xl font-bold text-gray-800 flex items-center mb-3">
              <Droplets className="w-6 h-6 mr-2 text-garissa-water" /> Water & Sanitation (WASH)
            </h3>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start">
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-bold mr-2 mt-0.5">WARN</span>
                <div>
                  <strong>Cholera Risk:</strong> Contamination of shallow boreholes and submerged water pans.
                </div>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold mr-2 mt-0.5">INFO</span>
                <div>
                  <strong>Safe Water Access:</strong> Mapping of elevated water points above the 350mm flood threshold.
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Developer Placeholder */}
        <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 flex items-start shadow-inner">
          <AlertCircle className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-lg mb-1">Developer Implementation Status</h4>
            <p className="text-sm opacity-90 mb-3">
              This dashboard is currently displaying static structural placeholders. The backend Python scripts that run the Gemini Pro data analysis and evidence generation are ready to be integrated.
            </p>
            <button className="flex items-center text-sm font-semibold bg-yellow-100 px-4 py-2 rounded-lg hover:bg-yellow-200 transition-colors border border-yellow-300">
              <FileText className="w-4 h-4 mr-2" /> View API Implementation Docs
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HealthAndWash;
