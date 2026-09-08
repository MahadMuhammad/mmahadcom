import type { APIRoute } from "astro";
import { getNotesLLMsFullText, llmTextHeaders } from "../../lib/notes-llm";

export const prerender = true;

export const GET: APIRoute = () => new Response(getNotesLLMsFullText(), { headers: llmTextHeaders });
