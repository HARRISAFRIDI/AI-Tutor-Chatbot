import os

from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings


load_dotenv()


embeddings = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-001",
    output_dimensionality=1536
)


def create_embedding(text: str):
    return embeddings.embed_query(text)


if __name__ == "__main__":

    text = "What is database normalization?"

    vector = create_embedding(text)

    print("Embedding created successfully!")
    print("Vector dimension:", len(vector))
    print("First 5 values:", vector[:5])