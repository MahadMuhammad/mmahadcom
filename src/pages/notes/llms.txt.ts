import type { APIRoute } from "astro";
import { getNotesLLMsIndex, llmTextHeaders } from "../../lib/notes-llm";

export const prerender = true;

export const GET: APIRoute = () => new Response(getNotesLLMsIndex(), { headers: llmTextHeaders });
