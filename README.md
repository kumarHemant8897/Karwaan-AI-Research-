Karwaan AI — Research Paper Assistant

Built with ❤️ by Hament Kumar ---https://karwaan-ai.vercel.app/

Karwaan AI is an AI-powered research assistant that allows users to interact with research papers using natural language. Users can upload PDFs or paste arXiv links, and the platform automatically extracts, summarizes, and enables intelligent conversations with academic papers using a RAG (Retrieval-Augmented Generation) pipeline.

🌟 Features

✅ Upload Research Papers (PDF)
✅ Fetch Papers directly from arXiv Links
✅ AI-powered Paper Summarization
✅ Chat with Research Papers
✅ Multi-paper Comparison
✅ Research Gap Analysis
✅ Semantic Search using Vector Embeddings
✅ Citation-based Answers
✅ Modern ChatGPT/Claude-style UI
✅ Dark Mode / Light Mode

🧠 How It Works
PDF / arXiv Link
        ↓
Text Extraction
        ↓
Chunking
        ↓
Embeddings Generation
        ↓
Vector Database (pgvector)
        ↓
RAG Retrieval
        ↓
Gemini AI Response
⚡ Tech Stack
Frontend
React.js
Tailwind CSS
TypeScript
Backend
FastAPI / Node.js
Supabase
PostgreSQL
AI / ML
Google Gemini API
RAG Pipeline
Vector Embeddings
pgvector
📸 Demo
https://karwaan-ai.vercel.app/




🚀 Core Functionalities
📄 AI Paper Summarization

Generates structured summaries including:

Problem Statement
Methodology
Results
Limitations
Future Work
💬 Chat with Papers

Ask questions like:

"What problem does this paper solve?"
"Explain the methodology"
"What are the limitations?"

Karwaan retrieves relevant chunks and generates context-aware answers.

⚖️ Multi-Paper Comparison

Compare multiple papers and identify:

Key differences
Research gaps
Common methodologies
Novel contributions
🔥 Future Improvements
AI-generated research recommendations
Citation graph visualization
Voice-based paper interaction
Collaborative research workspace
Chrome extension support
🛠️ Installation
git clone https://github.com/your-username/karwaan-ai.git

cd karwaan-ai

npm install

npm run dev
🔑 Environment Variables

Create a .env file:

VITE_GEMINI_API_KEY=YOUR_API_KEY
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_KEY=YOUR_SUPABASE_KEY


👨‍💻 Author
Hament Kumar

Full Stack Development
RAG Systems
Generative AI
