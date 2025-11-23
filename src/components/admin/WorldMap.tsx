import React from 'react';

interface MapMarker {
  lat: number;
  lon: number;
  city: string;
  country: string;
  visits: number;
}

interface WorldMapProps {
  markers: MapMarker[];
}

export const WorldMap: React.FC<WorldMapProps> = ({ markers }) => {
  // Convert lat/lon to SVG coordinates (Equirectangular projection)
  const projectCoordinates = (lon: number, lat: number) => {
    const width = 960;
    const height = 500;
    
    // Clamp coordinates to valid ranges
    const clampedLon = Math.max(-180, Math.min(180, lon));
    const clampedLat = Math.max(-90, Math.min(90, lat));
    
    const x = ((clampedLon + 180) * width) / 360;
    const y = ((90 - clampedLat) * height) / 180;
    
    return { x, y };
  };

  // Determine marker size based on visit count
  const getMarkerSize = (visits: number) => {
    if (visits >= 100) return 12;
    if (visits >= 50) return 10;
    if (visits >= 20) return 8;
    if (visits >= 10) return 6;
    return 5;
  };
  
  // Filter out invalid coordinates and log for debugging
  const validMarkers = markers.filter(marker => {
    const isValid = marker.lat !== null && marker.lon !== null && 
                    !isNaN(marker.lat) && !isNaN(marker.lon) &&
                    marker.lat !== 0 && marker.lon !== 0; // Filter out (0,0) which is usually localhost
    return isValid;
  });

  return (
    <div className="relative w-full bg-blue-50 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      <svg viewBox="0 0 960 500" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
        {/* Background Ocean */}
        <rect width="960" height="500" fill="#e0f2fe" className="dark:fill-gray-800" />
        
        {/* World Map - Using public domain world map from Wikimedia/Natural Earth */}
        <image 
          href="https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg"
          width="960" 
          height="500"
          opacity="0.6"
          className="mix-blend-multiply dark:mix-blend-overlay"
        />
        
        {/* Alternative: Grid overlay for context */}
        <g stroke="#cbd5e1" strokeWidth="0.5" opacity="0.3" className="dark:stroke-gray-600">
          {/* Longitude lines */}
          {Array.from({ length: 13 }, (_, i) => (i - 6) * 30).map((lon, i) => {
            const x = ((lon + 180) * 960) / 360;
            return <line key={`lon-${i}`} x1={x} y1="0" x2={x} y2="500" />;
          })}
          {/* Latitude lines */}
          {Array.from({ length: 7 }, (_, i) => (i - 3) * 30).map((lat, i) => {
            const y = ((90 - lat) * 500) / 180;
            return <line key={`lat-${i}`} x1="0" y1={y} x2="960" y2={y} />;
          })}
          {/* Equator (thicker) */}
          <line x1="0" y1="250" x2="960" y2="250" strokeWidth="1" stroke="#94a3b8" className="dark:stroke-gray-500" />
          {/* Prime Meridian (thicker) */}
          <line x1="480" y1="0" x2="480" y2="500" strokeWidth="1" stroke="#94a3b8" className="dark:stroke-gray-500" />
        </g>

        {/* Location markers */}
        {validMarkers.length > 0 ? (
          validMarkers.map((marker, index) => {
            const { x, y } = projectCoordinates(marker.lon, marker.lat);
            const size = getMarkerSize(marker.visits);
            
            return (
              <g key={index}>
                {/* Marker pin shadow */}
                <circle
                  cx={x}
                  cy={y + 1}
                  r={size + 1}
                  fill="#000000"
                  opacity="0.2"
                />
                
                {/* Marker circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={size}
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="2"
                  opacity="0.9"
                  className="hover:opacity-100 cursor-pointer transition-all"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                >
                  <title>
                    {marker.city}, {marker.country}
                    {'\n'}Visits: {marker.visits}
                  </title>
                </circle>
                
                {/* Pulse animation for larger markers */}
                {marker.visits >= 10 && (
                  <circle
                    cx={x}
                    cy={y}
                    r={size}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    opacity="0.6"
                  >
                    <animate
                      attributeName="r"
                      from={size}
                      to={size * 2.5}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.6"
                      to="0"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            );
          })
        ) : (
          <text
            x="480"
            y="250"
            textAnchor="middle"
            fill="#94a3b8"
            className="dark:fill-gray-500"
            fontSize="18"
            fontWeight="500"
          >
            No visitor locations yet (localhost visits excluded)
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 text-xs">
        <div className="font-semibold mb-2 text-gray-700 dark:text-gray-300">Marker Size</div>
        <div className="space-y-1 text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>&lt; 10 visits</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span>10-50 visits</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-red-500"></div>
            <span>50+ visits</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-red-500"></div>
            <span>100+ visits</span>
          </div>
        </div>
      </div>
    </div>
  );
};

