import os

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

llm = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash",       # Standard Flash model
    temperature=0.1,                # Lower = faster, more deterministic
    max_output_tokens=1024,         # Cap response length — biggest latency lever
    request_timeout=30,             # Fail fast instead of hanging
    google_api_key=os.getenv("GEMINI_API_KEY")
)