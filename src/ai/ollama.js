import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";

const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
export const embeddingModelName = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
export const embeddings = new OllamaEmbeddings({ baseUrl, model: embeddingModelName, maxRetries: 0 });
export const chatModel = new ChatOllama({ baseUrl, model: process.env.OLLAMA_CHAT_MODEL || "qwen2.5:7b", temperature: 0, maxRetries: 0 });
