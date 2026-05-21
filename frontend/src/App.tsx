import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom icons
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});
const busIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [20, 33], iconAnchor: [10, 33], popupAnchor: [1, -28],
});

// Bus data
const BUS_LINES = [
  {
    id: 'line_1', name: 'Linja 1', color: '#3b82f6',
    stations: [
      { name: 'Fushë Kosovë', lat: 42.635, lng: 21.093 },
      { name: 'Rrethi i Madh', lat: 42.648, lng: 21.145 },
      { name: 'Katedralja', lat: 42.659, lng: 21.159 },
      { name: 'Rilindja', lat: 42.660, lng: 21.163 },
      { name: 'Sheshi Skënderbeu', lat: 42.662, lng: 21.165 },
      { name: 'Dardania', lat: 42.651, lng: 21.168 },
    ]
  },
  {
    id: 'line_2', name: 'Linja 2', color: '#f59e0b',
    stations: [
      { name: 'Sheshi Skënderbeu', lat: 42.662, lng: 21.165 },
      { name: 'Veternik', lat: 42.660, lng: 21.120 },
      { name: 'Fushë Kosovë Terminali', lat: 42.635, lng: 21.093 },
      { name: 'Aeroporti Adem Jashari', lat: 42.572, lng: 21.035 },
    ]
  },
  {
    id: 'line_3', name: 'Linja 3', color: '#10b981',
    stations: [
      { name: 'Kodra e Trimave', lat: 42.678, lng: 21.161 },
      { name: 'Xhamia e Llapit', lat: 42.668, lng: 21.163 },
      { name: 'Sheshi Skënderbeu', lat: 42.662, lng: 21.165 },
      { name: 'Bregu i Diellit', lat: 42.645, lng: 21.171 },
    ]
  },
  {
    id: 'line_4', name: 'Linja 4', color: '#a855f7',
    stations: [
      { name: 'Gërmi', lat: 42.674, lng: 21.196 },
      { name: 'Rruga B', lat: 42.652, lng: 21.173 },
      { name: 'Sheshi Skënderbeu', lat: 42.662, lng: 21.165 },
      { name: 'Mati 1', lat: 42.639, lng: 21.178 },
    ]
  }
];

// Auto-center map to user location
function MapController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 14, { animate: true, duration: 1.5 });
  }, [center, map]);
  return null;
}

interface Message { sender: 'user' | 'agent'; text: string; }

function App() {
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'agent', text: 'Tung! Unë jam Udha Transit. GPS-i po punon — tregomë destinacionin dhe do të gjej autobusin për ty! 🚌' }
  ]);
  const [input, setInput] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'active' | 'denied'>('loading');
  const [nearestStation, setNearestStation] = useState<string | null>(null);
  const [highlightedLineIds, setHighlightedLineIds] = useState<string[]>([]);
  const [routeSegments, setRouteSegments] = useState<Array<{ lineId: string; lineName: string; from: string; to: string; stops: { lat: number; lng: number }[] }>>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Get GPS location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(loc);
          setGpsStatus('active');
          findNearest(loc.lat, loc.lng);
        },
        () => {
          // Fallback: Qendra e Prishtinës
          setLocation({ lat: 42.6629, lng: 21.1655 });
          setGpsStatus('denied');
          setNearestStation('Sheshi Skënderbeu (Simuluar)');
        }
      );
    }
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function findNearest(lat: number, lng: number) {
    let nearest = '';
    let minDist = Infinity;
    for (const line of BUS_LINES) {
      for (const s of line.stations) {
        const d = Math.sqrt((s.lat - lat) ** 2 + (s.lng - lng) ** 2);
        if (d < minDist) { minDist = d; nearest = s.name; }
      }
    }
    setNearestStation(nearest);
  }

  function extractLineIdsFromText(text: string) {
    return BUS_LINES.filter(line => text.includes(line.name)).map(line => line.id);
  }

  function buildRouteSegmentsFromText(text: string) {
    const pattern = /Hip në (Linja \d+) nga ([^\n]+?) deri te ([^\n]+?)(?:\(|\n|$)/g;
    const segments: Array<{ lineId: string; lineName: string; from: string; to: string; stops: { lat: number; lng: number }[] }> = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const lineName = match[1];
      const fromName = match[2].trim();
      const toName = match[3].trim();
      const line = BUS_LINES.find(l => l.name === lineName);
      if (!line) continue;
      const allStops = line.stations.map(s => ({ name: s.name, lat: s.lat, lng: s.lng }));
      const fromIndex = allStops.findIndex(s => s.name === fromName);
      const toIndex = allStops.findIndex(s => s.name === toName);
      if (fromIndex === -1 || toIndex === -1) continue;
      const slice = fromIndex <= toIndex ? allStops.slice(fromIndex, toIndex + 1) : allStops.slice(toIndex, fromIndex + 1).reverse();
      segments.push({
        lineId: line.id,
        lineName: line.name,
        from: fromName,
        to: toName,
        stops: slice.map(s => ({ lat: s.lat, lng: s.lng })),
      });
    }
    return segments;
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);
    setHighlightedLineIds([]);

    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          latitude: location?.lat,
          longitude: location?.lng,
        }),
      });
      const data = await res.json();
      const replyText = data.reply;
      const segments = buildRouteSegmentsFromText(replyText);
      setMessages(prev => [...prev, { sender: 'agent', text: replyText }]);
      setHighlightedLineIds(extractLineIdsFromText(replyText));
      setRouteSegments(segments);
      setSelectedRouteIndex(segments.length > 0 ? 0 : null);
    } catch {
      setMessages(prev => [...prev, { sender: 'agent', text: 'Serveri nuk po përgjigjet. Kontrollo backend-in.' }]);
      setRouteSegments([]);
      setSelectedRouteIndex(null);
    }
    setLoading(false);
  };

  const prishtinCenter: [number, number] = [42.6629, 21.1655];
  const mapCenter: [number, number] | null = location ? [location.lat, location.lng] : null;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0b0f19', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e40af, #4f46e5)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 20px rgba(79,70,229,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🚌</span>
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 18, letterSpacing: 2 }}>UDHA TRANSIT</div>
            <div style={{ color: '#93c5fd', fontSize: 11 }}>Prishtina Smart Agent</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: gpsStatus === 'active' ? '#4ade80' : gpsStatus === 'denied' ? '#f59e0b' : '#94a3b8', boxShadow: gpsStatus === 'active' ? '0 0 8px #4ade80' : 'none' }} />
          <span style={{ color: gpsStatus === 'active' ? '#4ade80' : '#f59e0b', fontSize: 12, fontWeight: 600 }}>
            {gpsStatus === 'active' ? 'GPS Aktiv' : gpsStatus === 'denied' ? 'GPS Simuluar' : 'GPS...'}
          </span>
          {nearestStation && (
            <span style={{ color: '#94a3b8', fontSize: 11, marginLeft: 8 }}>
              📍 {nearestStation}
            </span>
          )}
        </div>
      </div>

      {/* Main content: Map + Chat side by side */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* MAP - Left side */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer
            center={prishtinCenter}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap contributors & Carto'
            />
            <MapController center={mapCenter} />

            {/* User location */}
            {location && (
              <>
                <Marker position={[location.lat, location.lng]} icon={userIcon}>
                  <Popup>
                    <b>Vendndodhja juaj</b><br />
                    {location.lat.toFixed(4)}, {location.lng.toFixed(4)}<br />
                    <span style={{ color: '#4ade80' }}>Stacioni më afër: {nearestStation}</span>
                  </Popup>
                </Marker>
                <Circle
                  center={[location.lat, location.lng]}
                  radius={200}
                  pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1 }}
                />
              </>
            )}

            {/* Bus routes */}
            {BUS_LINES.map(line => (
              <Polyline
                key={line.id}
                positions={line.stations.map(station => [station.lat, station.lng])}
                pathOptions={{
                  color: line.color,
                  weight: highlightedLineIds.length === 0 ? 4 : highlightedLineIds.includes(line.id) ? 7 : 3,
                  opacity: highlightedLineIds.length === 0 ? 0.3 : highlightedLineIds.includes(line.id) ? 0.6 : 0.1,
                  dashArray: highlightedLineIds.includes(line.id) ? undefined : '8',
                }}
              />
            ))}
            {routeSegments.map((segment, idx) => (
              <Polyline
                key={`route-${idx}`}
                positions={segment.stops.map(stop => [stop.lat, stop.lng])}
                pathOptions={{
                  color: '#facc15',
                  weight: selectedRouteIndex === idx ? 12 : 8,
                  opacity: selectedRouteIndex === idx ? 1 : 0.85,
                  dashArray: selectedRouteIndex === idx ? undefined : '6 10',
                }}
                eventHandlers={{
                  click: () => setSelectedRouteIndex(idx),
                }}
              />
            ))}

            {routeSegments.length > 0 && routeSegments.flatMap((segment, idx) => [
              <Marker key={`start-${idx}`} position={[segment.stops[0].lat, segment.stops[0].lng]} icon={userIcon}>
                <Popup><b>Start {segment.from}</b><br />{segment.lineId}</Popup>
              </Marker>,
              <Marker key={`end-${idx}`} position={[segment.stops[segment.stops.length - 1].lat, segment.stops[segment.stops.length - 1].lng]} icon={busIcon}>
                <Popup><b>Destinacion {segment.to}</b><br />{segment.lineId}</Popup>
              </Marker>
            ])}

            {/* Bus stations */}
            {BUS_LINES.map(line =>
              line.stations.map((station, idx) => (
                <Marker key={`${line.id}-${idx}`} position={[station.lat, station.lng]} icon={busIcon}>
                  <Popup>
                    <b>{station.name}</b><br />
                    <span style={{ color: line.color }}>■ {line.name}</span>
                  </Popup>
                </Marker>
              ))
            )}
          </MapContainer>

          {/* Selected route info */}
          {routeSegments.length > 0 && (
            <div style={{ position: 'absolute', top: 20, left: 20, right: 20, background: 'rgba(8,13,22,0.95)', borderRadius: 14, padding: '12px 16px', zIndex: 1000, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#93c5fd', fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>RRUGA E SUGJERUAR</div>
                  <div style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>
                    {routeSegments.length === 1 ? 'Një segment me bus' : 'Rrugë me ' + routeSegments.length + ' segmentë'}
                  </div>
                </div>
                <div style={{ color: '#9ca3af', fontSize: 12 }}>{selectedRouteIndex !== null ? `Segmenti ${selectedRouteIndex + 1} i zgjedhur` : 'Kliko një segment në hartë'}</div>
              </div>
              {selectedRouteIndex !== null && routeSegments[selectedRouteIndex] && (
                <div style={{ marginTop: 10, display: 'grid', gap: 6, color: '#d1d5db', fontSize: 12 }}>
                  <div><strong style={{ color: 'white' }}>{routeSegments[selectedRouteIndex].lineName}</strong></div>
                  <div>Nga: {routeSegments[selectedRouteIndex].from}</div>
                  <div>Në: {routeSegments[selectedRouteIndex].to}</div>
                  <div>Ndalesa: {routeSegments[selectedRouteIndex].stops.length}</div>
                  <div style={{ color: '#9ca3af' }}>Kliko një segment për ta theksuar.</div>
                </div>
              )}
            </div>
          )}

          {/* Map legend */}
          <div style={{ position: 'absolute', bottom: 20, left: 20, background: 'rgba(13,17,23,0.9)', borderRadius: 12, padding: '10px 14px', zIndex: 1000, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: '#94a3b8', fontSize: 10, marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>LINJAT AKTIVE</div>
            {BUS_LINES.map(line => (
              <div key={line.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 20, height: 3, background: line.color, borderRadius: 2 }} />
                <span style={{ color: 'white', fontSize: 11 }}>{line.name}</span>
              </div>
            ))}
          </div>
          {highlightedLineIds.length > 0 && (
            <div style={{ position: 'absolute', top: 20, left: 20, background: 'rgba(13,17,23,0.92)', borderRadius: 12, padding: '10px 14px', zIndex: 1000, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ color: '#94a3b8', fontSize: 10, marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>Rruga e zgjedhur</div>
              {highlightedLineIds.map(id => {
                const line = BUS_LINES.find(l => l.id === id);
                return (
                  <div key={id} style={{ color: 'white', fontSize: 11, marginBottom: 4 }}>{line?.name ?? id}</div>
                );
              })}
            </div>
          )}
        </div>

        {/* CHAT - Right side */}
        <div style={{ width: 380, display: 'flex', flexDirection: 'column', background: '#0d1117', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
          {routeSegments.length > 0 && (
            <div style={{ padding: '14px 16px', background: '#111827', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ color: '#93c5fd', fontSize: 10, letterSpacing: 1 }}>DETALJET E RRUGËS</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Plan busash</div>
                </div>
                <div style={{ color: '#9ca3af', fontSize: 11 }}>{routeSegments.length} segmente</div>
              </div>
              {routeSegments.map((segment, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedRouteIndex(idx)}
                  style={{
                    width: '100%', textAlign: 'left', background: idx === selectedRouteIndex ? '#1f2937' : '#111827',
                    border: idx === selectedRouteIndex ? '1px solid #2563eb' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'pointer', color: 'white'
                  }}
                >
                  <div style={{ fontSize: 12, color: '#93c5fd' }}>{segment.lineName}</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{segment.from} → {segment.to}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{segment.stops.length} ndalesa</div>
                </button>
              ))}
            </div>
          )}
          
          {/* Chat messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.sender === 'agent' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #1e40af, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, marginRight: 8, flexShrink: 0, marginTop: 4 }}>🚌</div>
                )}
                <div style={{
                  maxWidth: '80%',
                  background: msg.sender === 'user' ? 'linear-gradient(135deg, #1e40af, #4f46e5)' : '#1e2433',
                  color: 'white',
                  borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  padding: '10px 14px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  border: msg.sender === 'agent' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.text.replace(/\*\*(.*?)\*\*/g, '$1')}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #1e40af, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🚌</div>
                <div style={{ background: '#1e2433', borderRadius: '18px 18px 18px 4px', padding: '12px 16px', display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#4f46e5', animation: `bounce 1s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* GPS info bar */}
          {nearestStation && (
            <div style={{ padding: '8px 16px', background: '#161b22', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#4ade80' }}>📍</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Stacioni juaj: <strong style={{ color: '#e2e8f0' }}>{nearestStation}</strong></span>
            </div>
          )}

          {/* Input area */}
          <div style={{ padding: '12px 16px', background: '#161b22', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendMessage()}
                placeholder="P.sh. Du me shku te Aeroporti..."
                style={{
                  flex: 1, background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, padding: '10px 14px', color: 'white', fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={loading}
                style={{
                  background: loading ? '#374151' : 'linear-gradient(135deg, #1e40af, #4f46e5)',
                  color: 'white', border: 'none', borderRadius: 12, padding: '10px 18px',
                  cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13,
                  transition: 'all 0.2s',
                }}
              >
                {loading ? '...' : 'Dërgo'}
              </button>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Du me shku te Aeroporti', 'Cilat linja ka?', 'A ka vonesa?'].map(tip => (
                <button
                  key={tip}
                  onClick={() => setInput(tip)}
                  style={{ background: '#1e2433', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                >
                  {tip}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
      `}</style>
    </div>
  );
}

export default App;
