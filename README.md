# 🚌 Udha - AI-Powered Transit & Navigation Agent for Prishtina

![Udha Architecture](https://img.shields.io/badge/AI-Gemini_2.5_Pro-blue)
![Backend](https://img.shields.io/badge/Backend-Python_|_FastAPI-green)
![Frontend](https://img.shields.io/badge/Frontend-React_|_Vite-cyan)

## 📌 The Problem
Navigating public transit in Prishtina can be challenging due to a lack of centralized, real-time information. Commuters often struggle to find the most efficient routes, determine transfer points, or anticipate delays caused by unpredictable traffic, weather conditions, or city events. 

## 🤖 The AI Solution
**Udha** is an intelligent, location-aware transit assistant designed to simplify urban mobility. I integrated **Google Gemini 2.5 Pro** using the **Google Agent Development Kit (ADK)** to create an AI agent capable of understanding natural language queries in Albanian. 

Leveraging a **Retrieval-Augmented Generation (RAG)** approach, the agent dynamically accesses structured local data (`JSON`) for bus routes and stations. Through advanced **Function Calling (Tools)**, the LLM autonomously executes Python functions to calculate distances from user GPS coordinates, plan direct or multi-stop routes, and factor in real-time context (weather, rush hours, city events) to predict transit delays.

## 🛠️ Tech Stack
* **AI & LLM Integration:** Google GenAI SDK / Agent Development Kit (ADK), Gemini 2.5 Pro
* **Backend:** Python, FastAPI (for building scalable AI workflows and APIs)
* **Frontend:** React (Vite), TypeScript, Leaflet.js (for interactive mapping and live GPS tracking)
* **Data Handling:** JSON (for structured data preparation and prompt augmentation)

## 🚀 Key Features & AI Implementations

This project heavily focuses on applied AI and backend Python development:

* **LLM-Based Agent Creation:** Engineered a robust conversational agent with specific system instructions (Prompt Engineering) to ensure accurate, context-aware, and user-friendly interactions.
* **Python AI Workflows:** Developed the entire backend logic in Python, seamlessly bridging the FastAPI endpoints with the LLM. Designed modular Python functions (`tools.py`) that the LLM invokes dynamically.
* **Function Calling & Data Preparation:** Prepared detailed JSON datasets mapping Prishtina's bus lines. Built Python tools for the agent to calculate nearest stations (using the Haversine formula) and simulate predictive traffic context based on time and weather.
* **API / JSON Communication:** Established a robust RESTful API architecture ensuring smooth, asynchronous JSON data exchange between the React frontend and the AI-powered Python backend.

## ⚙️ Setup & Installation

**1. Backend (Python/FastAPI)**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
pip install fastapi uvicorn google-adk python-dotenv
```
*Create a `.env` file in the `backend` directory and add your key (ensure it is not hardcoded):*
`GOOGLE_API_KEY=your_api_key_here`

*Run the backend:*
```bash
uvicorn main:app --reload --port 8000
```

**2. Frontend (React/Vite)**
```bash
cd frontend
npm install
npm run dev
```

---
*Built with ❤️ for Prishtina. This project demonstrates hands-on experience with LLMs, Python, APIs, and real-world AI use cases.*
