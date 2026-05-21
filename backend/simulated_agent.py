import asyncio

class SimulatedUdhaAgent:
    """Fallback agent used when the real Gemini agent cannot initialize."""

    async def run_live(self, message):
        response = (
            "Më falni, po përdor versionin testues të Udha Transit. "
            "Aktualisht nuk mund të lidhëm me Vertex AI, por mund t'ju ndihmoj me rregullime dhe informacion bazë. "
            "Shkruaj për udhëzim nga një vend në tjetrin dhe unë do të përgjigjem me këshilla të përgjithshme."
        )
        # Simulo streaming me një bllok të vetëm
        class Chunk:
            def __init__(self, t):
                self.text = t

        yield Chunk(response)
