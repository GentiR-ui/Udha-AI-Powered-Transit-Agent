import os
import json
from google.adk import agents
from google.adk import runners
from google.adk import sessions
from google.genai import types

import tools

tools.load_dotenv()

# Konfigurimi i Vertex AI
os.environ["GOOGLE_CLOUD_PROJECT"] = os.environ.get("GOOGLE_CLOUD_PROJECT", "prishtina-transit-agent")
os.environ["GOOGLE_CLOUD_LOCATION"] = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "True")
os.environ["GOOGLE_GENAI_USE_ENTERPRISE"] = os.environ.get("GOOGLE_GENAI_USE_ENTERPRISE", "True")

class UdhaAiAgent:
    """Agjenti i vërtetë me Gemini / Vertex AI"""
    
    def __init__(self):
        # Definojmë mjetet (tools) që Gemini mund të thërrasë
        def get_bus_data():
            """Merr të dhënat e plota të linjave të autobusëve në Prishtinë."""
            return json.dumps(tools.get_bus_routes(), ensure_ascii=False)

        def get_traffic_context():
            """Merr motin aktual dhe vonesat e parashikuara në qytet."""
            return tools.get_predictive_context()

        def get_bus_route(origin_lat: float, origin_lng: float, destination: str):
            """Planifikon rrugën me autobus urban për destinacionin e përdoruesit."""
            return tools.get_bus_route(origin_lat, origin_lng, destination)

        def search_places(query: str):
            """Kërkon vendet apo destinacionet e mundshme bazuar në tekst."""
            maps = tools.get_maps_toolset()
            return maps.search_places(query)

        model_name = os.environ.get('GOOGLE_GENAI_MODEL', 'gemini-2.5-pro')
        print(f"Using Vertex AI model: {model_name}")

        # Krijojmë agjentin
        self.agent = agents.LlmAgent(
            model=model_name,
            name='udha_transit_agent',
            instruction=(
                "Ti je Udha, asistenti i autobusëve urban në Prishtinë. "
                "Përgjigju vetëm me rrjetin e autobusëve urban, stacionet dhe linjat e dhëna në databazë. "
                "Mos rekomando makinë, taksi, ecje të gjatë ose rrugë me automjet. "
                "Kur pyetja është për si të shkosh diku, përdor domosdoshmërisht get_bus_route(origin_lat, origin_lng, destination). "
                "Nëse përdoruesi jep lokacion (lat/lng), gjej stacionin më të afërt të autobusëve. "
                "Mund të përdorësh search_places vetëm për të kuptuar destinacione, por përgjigju gjithmonë në formë udhëzimi autobusi. "
                "Fol vetëm Shqip, me stil të qartë dhe të thjeshtë."
            ),
            tools=[get_bus_data, get_traffic_context, search_places, get_bus_route]
        )
        
        # Konfigurojmë runner-in
        self.session_service = sessions.InMemorySessionService()
        self.runner = runners.Runner(
            app_name='udha_transit_app',
            agent=self.agent,
            session_service=self.session_service,
            auto_create_session=True,
        )

    async def run_live(self, message):
        # Kjo metodë do të thërritet nga main.py
        # Ne përdorim 'run_async' për streaming të përgjigjes
        user_id = "user_1"
        session_id = "user_session_1"
        
        # Krijo përmbajtjen për dërgim
        content = types.Content(
            role="user",
            parts=[types.Part(text=message)]
        )

        # Start streaming and collect text from candidate content parts and function responses
        async for event in self.runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=content,
        ):
            pieces = []

            # Helper to extract parts from a Content-like object
            def _collect_from_content(cont):
                out = []
                if not cont:
                    return out
                for part in getattr(cont, 'parts', []) or []:
                    # plain text
                    if getattr(part, 'text', None):
                        out.append(part.text)

                    # function_response -> usually contains the tool's output in .response
                    fr = getattr(part, 'function_response', None)
                    if fr is not None:
                        resp = getattr(fr, 'response', None)
                        if isinstance(resp, dict):
                            if 'result' in resp and resp['result']:
                                out.append(resp['result'])
                            else:
                                out.append(json.dumps(resp, ensure_ascii=False))

                return out

            # 1) If event exposes candidates, inspect the first candidate's content parts
            candidates = getattr(event, 'candidates', None)
            if candidates:
                try:
                    first = candidates[0]
                    cont = getattr(first, 'content', None)
                    pieces.extend(_collect_from_content(cont))
                except Exception:
                    pass

            # 2) Fallback: if event has a direct content field, collect from it too
            cont2 = getattr(event, 'content', None)
            if cont2 is not None:
                pieces.extend(_collect_from_content(cont2))

            # 3) As a last resort, include event.text if present
            if hasattr(event, 'text') and event.text:
                pieces.append(event.text)

            # If we gathered any pieces, stream them as a single joined chunk
            if pieces:
                class Chunk:
                    def __init__(self, t): self.text = t

                # preserve order and join into final text for this event
                yield Chunk(''.join(pieces))

# Krijo instancën globale
try:
    udha_agent = UdhaAiAgent()
    print("Udha AI Agent (Gemini) u ngarkua me sukses!")
except Exception as e:
    print(f"Gabim gjatë ngarkimit të AI: {e}")
    # Fallback nëse dështon Vertex AI (p.sh. nuk ke bërë gcloud login)
    from simulated_agent import SimulatedUdhaAgent
    udha_agent = SimulatedUdhaAgent()
