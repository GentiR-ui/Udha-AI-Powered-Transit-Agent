import json
import os
import re
import datetime
from urllib.parse import urlencode
from urllib.request import urlopen


def load_dotenv(path=None):
    if path is None:
        path = os.path.join(os.path.dirname(__file__), '.env')
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as env_file:
        for line in env_file:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' not in line:
                continue
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip().strip('"')
            if key and value and key not in os.environ:
                os.environ[key] = value


def get_google_api_key():
    load_dotenv()
    return os.environ.get('GOOGLE_MAPS_API_KEY') or os.environ.get('GOOGLE_API_KEY') or os.environ.get('GOOGLE_CLOUD_API_KEY')


def _normalize_name(text):
    return re.sub(r'\s+', ' ', text.strip().lower()) if text else ''


def find_nearest_station(lat, lng, lines):
    best = None
    best_dist = float('inf')
    for line in lines:
        for station in line.get('stations', []):
            dx = station.get('lat', 0) - lat
            dy = station.get('lng', 0) - lng
            dist = dx * dx + dy * dy
            if dist < best_dist:
                best_dist = dist
                best = station.copy()
                best['lines'] = [line['id']]
            elif best is not None and _normalize_name(station.get('name')) == _normalize_name(best.get('name')):
                if line['id'] not in best['lines']:
                    best['lines'].append(line['id'])
    return best


def find_station_by_name(query, lines):
    if not query:
        return None
    query_norm = _normalize_name(query)
    candidates = []
    for line in lines:
        for station in line.get('stations', []):
            name_norm = _normalize_name(station.get('name'))
            if query_norm == name_norm:
                result = station.copy()
                result['lines'] = [line['id']]
                return result
            if query_norm in name_norm:
                candidates.append((station, line['id']))
    if candidates:
        station, line_id = candidates[0]
        result = station.copy()
        result['lines'] = [line_id]
        return result
    return None


def build_bus_graph(lines):
    neighbors = {}
    edge_lines = {}
    line_map = {line['id']: line for line in lines}
    for line in lines:
        stations = line.get('stations', [])
        for idx in range(len(stations) - 1):
            a = stations[idx]['name']
            b = stations[idx + 1]['name']
            neighbors.setdefault(a, set()).add(b)
            neighbors.setdefault(b, set()).add(a)
            edge_lines.setdefault((a, b), []).append(line['id'])
            edge_lines.setdefault((b, a), []).append(line['id'])
    return neighbors, edge_lines, line_map


def estimate_next_bus_time(frequency_minutes):
    try:
        now = datetime.datetime.now()
        if frequency_minutes <= 0:
            return 'në pak'
        current_minutes = now.hour * 60 + now.minute
        wait = frequency_minutes - (current_minutes % frequency_minutes)
        if wait == frequency_minutes:
            wait = 0
        arrival = now + datetime.timedelta(minutes=wait)
        return f'në {wait} min ({arrival.strftime("%H:%M")})' if wait > 0 else f'tani ({arrival.strftime("%H:%M")})'
    except Exception:
        return 'së shpejti'


def get_bus_route(origin_lat, origin_lng, destination):
    routes = get_bus_routes().get('lines', [])
    if not routes:
        return 'Nuk ka të dhëna për linjat e autobusëve aktualisht.'

    destination_station = find_station_by_name(destination, routes)
    if not destination_station:
        return (
            f'Nuk gjeta stacion të saktë për destinacionin “{destination}”. ' 
            'Provo të shkruash emrin e stacionit, p.sh. Sheshi Skënderbeu, Dardania, Veternik, Aeroporti Adem Jashari.'
        )

    origin_station = find_nearest_station(origin_lat, origin_lng, routes)
    if not origin_station:
        return 'Nuk gjej stacionin më të afërt nga lokacioni juaj.'

    if _normalize_name(origin_station['name']) == _normalize_name(destination_station['name']):
        return f'Jeni shumë afër stacionit {destination_station["name"]}. Hip në autobus aty për ndalesën e ardhshme.'

    neighbors, edge_lines, line_map = build_bus_graph(routes)
    start = origin_station['name']
    end = destination_station['name']
    from collections import deque
    queue = deque([start])
    visited = {start}
    parent = {start: None}
    parent_line = {}

    while queue:
        current = queue.popleft()
        if current == end:
            break
        for neighbor in neighbors.get(current, []):
            if neighbor in visited:
                continue
            visited.add(neighbor)
            parent[neighbor] = current
            parent_line[neighbor] = edge_lines[(current, neighbor)][0]
            queue.append(neighbor)

    if end not in parent:
        return 'Nuk gjeta një rrugë të vlefshme me autobusë urban drejt destinacionit tuaj.'

    segments = []
    station = end
    while station != start:
        prev = parent[station]
        line_id = parent_line[station]
        segments.append({'from': prev, 'to': station, 'line_id': line_id})
        station = prev
    segments.reverse()

    legs = []
    for segment in segments:
        if legs and legs[-1]['line_id'] == segment['line_id']:
            legs[-1]['to'] = segment['to']
        else:
            legs.append(segment.copy())

    lines_used = []
    route_lines = []
    for idx, leg in enumerate(legs, start=1):
        line = line_map.get(leg['line_id'], {})
        line_name = line.get('name', leg['line_id'])
        lines_used.append(line_name)
        all_stations = [s['name'] for s in line.get('stations', [])]
        try:
            from_idx = all_stations.index(leg['from'])
            to_idx = all_stations.index(leg['to'])
            stops = abs(to_idx - from_idx)
        except ValueError:
            stops = '???'
        wait = estimate_next_bus_time(line.get('frequency_minutes', 15))
        route_lines.append(
            f'{idx}. Hip në {line_name} nga {leg["from"]} deri te {leg["to"]} ({stops} ndalesa), autobusi më i afërt {wait}.'
        )

    if len(legs) == 1:
        summary = f'Linja më e mirë është {lines_used[0]} pa transferim.'
    else:
        summary = 'Do të duhet të bësh transferim ndërmjet linjave: ' + ' → '.join(lines_used) + '.'

    return (
        f"Stacioni më i afërt i nisjes: {origin_station['name']}.\n"
        f"Stacioni i destinacionit: {destination_station['name']}.\n"
        + f"{summary}\n"
        + '\n'.join(route_lines)
    )


def strip_html(text):
    return re.sub(r'<[^>]+>', '', text)


def get_maps_toolset():
    api_key = get_google_api_key()

    class MapsToolset:
        def search_places(self, query):
            if not api_key:
                return 'Nuk u gjet GOOGLE_API_KEY. Vendos çelësin në ambient ose në backend/.env.'
            params = {
                'input': query,
                'inputtype': 'textquery',
                'fields': 'formatted_address,name,geometry',
                'key': api_key,
            }
            url = f'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?{urlencode(params)}'
            try:
                response = urlopen(url, timeout=15).read().decode('utf-8')
                data = json.loads(response)
            except Exception as exc:
                return f'Gabim në Google Places API: {exc}'
            status = data.get('status')
            if status != 'OK':
                return f'Google Places API status: {status} - {data.get("error_message", "")}'
            candidates = data.get('candidates', [])
            rows = []
            for cand in candidates[:3]:
                rows.append(f"{cand.get('name')} - {cand.get('formatted_address')}")
            return 'Rezultatet e kërkimit:\n' + '\n'.join(rows)

        def get_directions(self, origin, destination, mode='driving'):
            if not api_key:
                return 'Nuk u gjet GOOGLE_API_KEY. Vendos çelësin në ambient ose në backend/.env.'
            params = {
                'origin': origin,
                'destination': destination,
                'mode': mode,
                'key': api_key,
            }
            url = f'https://maps.googleapis.com/maps/api/directions/json?{urlencode(params)}'
            try:
                response = urlopen(url, timeout=20).read().decode('utf-8')
                data = json.loads(response)
            except Exception as exc:
                return f'Gabim në Google Directions API: {exc}'
            status = data.get('status')
            if status != 'OK':
                return f'Google Directions API status: {status} - {data.get("error_message", "")}'
            route = data['routes'][0]
            leg = route['legs'][0]
            summary = [
                f"Udhëtimi: {leg.get('start_address')} → {leg.get('end_address')}",
                f"Distanca: {leg.get('distance', {}).get('text', 'N/A')}",
                f"Koha: {leg.get('duration', {}).get('text', 'N/A')}"
            ]
            steps = []
            for idx, step in enumerate(leg.get('steps', []), start=1):
                instruction = strip_html(step.get('html_instructions', ''))
                distance = step.get('distance', {}).get('text', '')
                duration = step.get('duration', {}).get('text', '')
                steps.append(f"{idx}. {instruction} ({distance}, {duration})")
            return 'Udhëzime për rrugën:\n' + '\n'.join(summary + [''] + steps)

    return MapsToolset()


def get_bus_routes():
    file_path = os.path.join(os.path.dirname(__file__), '../data/buses.json')
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return json.load(file)
    except Exception as e:
        return {"error": f"Nuk lexohet buses.json: {e}"}

def get_predictive_context():
    current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    day_of_week = datetime.datetime.now().strftime("%A")
    context = {
        "current_time": current_time,
        "day": day_of_week,
        "weather": "Bie shi, rrugët me trafik të rënduar",
        "city_event": "Ndeshje në stadium"
    }
    return f"Konteksti aktual: {json.dumps(context)}"
