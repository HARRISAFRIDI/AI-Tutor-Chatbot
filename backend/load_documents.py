from pathlib import Path

from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter


PDF_FOLDER = Path("documents/database")


def load_pdf(pdf_path):

    reader = PdfReader(pdf_path)

    pages = []

    for page_number, page in enumerate(reader.pages, start=1):

        text = page.extract_text()

        if text:
            pages.append({
                "page_number": page_number,
                "text": text
            })

    return pages


def create_chunks(pages):

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150
    )

    chunks = []

    for page in pages:

        page_chunks = splitter.split_text(
            page["text"]
        )

        for chunk in page_chunks:

            chunks.append({
                "content": chunk,
                "page_number": page["page_number"]
            })

    return chunks


if __name__ == "__main__":

    pdf_files = list(PDF_FOLDER.glob("*.pdf"))

    print("PDFs found:", len(pdf_files))

    for pdf in pdf_files:

        print("\n==============================")
        print("Processing:", pdf.name)
        print("==============================")

        pages = load_pdf(pdf)

        print("Pages:", len(pages))

        chunks = create_chunks(pages)

        print("Chunks:", len(chunks))

        if chunks:

            print("\nFirst chunk:")
            print("------------------------------")
            print(chunks[0]["content"])
            print("------------------------------")
            print("Page:", chunks[0]["page_number"])