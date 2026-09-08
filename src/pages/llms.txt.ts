import type { APIRoute } from "astro";
import { llmTextHeaders } from "../lib/notes-llm";
import { getSiteLLMsIndex } from "../lib/site-llm";

export const prerender = true;

export const GET: APIRoute = async () => new Response(await getSiteLLMsIndex(), { headers: llmTextHeaders });
