from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from agent import udha_agent

app = FastAPI(title="Udha Transit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    latitude: float = None
    longitude: float = None

@app.get("/")
def read_root():
    return {"status": "Udha API is running ✅"}

@app.post("/chat")
async def chat_with_agent(req: ChatRequest):
    context_msg = req.message
    if req.latitude and req.longitude:
        context_msg += f" [Lokacioni: {req.latitude:.4f}, {req.longitude:.4f}]"
    
    full_response = ""
    try:
        async for chunk in udha_agent.run_live(context_msg):
            full_response += chunk.text
    except Exception as e:
        print(f"Error: {e}")
        full_response = "Ndodhi një gabim teknik. Ju lutem provoni prapë."

    return {"reply": full_response}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
