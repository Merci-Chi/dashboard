import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function outputText(payload: any) {
  return (payload?.output || [])
    .filter((item: any) => item?.type === "message")
    .flatMap((item: any) => item?.content || [])
    .filter((item: any) => item?.type === "output_text")
    .map((item: any) => item.text || "")
    .join("\n")
    .trim();
}

async function openAI(apiKey: string, body: Record<string, unknown>) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (response.ok) return payload;

    const message = payload?.error?.message || `OpenAI request failed (${response.status}).`;
    if (response.status !== 429 || attempt === 5) throw new Error(message);

    const retryHeader = Number(response.headers.get("retry-after"));
    const secondsFromMessage = Number(message.match(/try again in\s+([\d.]+)s/i)?.[1]);
    const waitSeconds = Number.isFinite(retryHeader) && retryHeader > 0
      ? retryHeader
      : Number.isFinite(secondsFromMessage) && secondsFromMessage > 0
        ? secondsFromMessage
        : 12 * (attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, Math.ceil((waitSeconds + 2) * 1000)));
  }
  throw new Error("OpenAI rate limit retries were exhausted.");
}

const researchInstructions = `You research public businesses for professional website creation. Search the live web thoroughly and cross-reference reliable sources. Never invent facts or combine similarly named businesses. Use only a publicly listed business address, never a private residential address. Put a direct URL beside every factual finding. Clearly mark conflicts as Unverified and missing information as Not found. Keep quoted material minimal. Return a concise Markdown report covering: business overview; public owner/contact; phone, email, address and hours; services/products and public prices; service areas; official website and social profiles; map/directory listings; reviews and reputation; years, licenses and awards; brand colors/tone/slogan; usable public image links with reuse warnings; customer priorities; FAQs; recommended website sections and calls to action; missing/unverified details; and a numbered source list.`;

const siteInstructions = `You are an expert frontend designer and developer. Create one polished, original, production-ready business website as a SINGLE self-contained index.html file with embedded CSS and JavaScript. Return ONLY the complete HTML beginning with <!DOCTYPE html>; never use Markdown fences or explanatory text.

Requirements:
- Aim for a substantial, professional implementation of roughly 2,000 lines when useful, but favor correct code over filler.
- Create a distinctive design matched to the business and its verified brand; do not use a generic template.
- Fully responsive desktop/mobile layout with a working three-line hamburger menu.
- Include viewport settings that prevent mobile zooming and CSS that disables text selection.
- Use only facts supported by the research. Never invent prices, reviews, services, credentials, people, locations or statistics.
- Omit empty or unsupported sections entirely.
- Use functional tel:, mailto:, map, website and social links when verified.
- Use tasteful remote stock-photo URLs from Unsplash only when verified company photos are unavailable, without implying stock photos show the actual company.
- Use online SVG icon libraries (Bootstrap Icons CDN or Font Awesome CDN); do not use emoji as interface icons.
- Include accessible contrast, semantic HTML, visible keyboard focus, alt text, reduced-motion support and polished interactions.
- Add appropriate SEO title, meta description, Open Graph tags, headings and LocalBusiness JSON-LD using verified facts only.
- All buttons, navigation, accordions, galleries and forms included in the design must work. Do not include a fake form submission; use mailto/tel actions or clearly functional links instead.
- Check the final HTML for balanced tags, valid JavaScript, no placeholders, no empty sections and no unsupported claims.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY has not been added to Supabase secrets." }, 503);

    const body = await req.json();
    const company = String(body?.company || "").trim();
    if (!company) return json({ error: "A company name is required." }, 400);

    const researchResponse = await openAI(apiKey, {
      model: Deno.env.get("OPENAI_RESEARCH_MODEL") || "gpt-5-mini",
      instructions: researchInstructions,
      input: `Research this business by its public company name: ${company}. Do not use or request private CRM information. If multiple businesses have this name and the correct one cannot be verified from public sources, clearly state that the match is unverified rather than combining results.`,
      tools: [{ type: "web_search", search_context_size: "medium" }],
      tool_choice: "required",
      max_output_tokens: 12000,
    });
    const research = outputText(researchResponse);
    if (!research) throw new Error("OpenAI completed the research but returned no report.");

    const siteResponse = await openAI(apiKey, {
      model: Deno.env.get("OPENAI_SITE_MODEL") || "gpt-5-mini",
      instructions: siteInstructions,
      input: `Create the complete website from this verified research report:\n\n${research}`,
      max_output_tokens: 64000,
    });
    let html = outputText(siteResponse)
      .replace(/^```(?:html)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const start = html.search(/<!doctype html>/i);
    if (start > 0) html = html.slice(start);
    if (!/^<!doctype html>/i.test(html) || !/<\/html>\s*$/i.test(html)) {
      throw new Error("The generated website was incomplete. Please run it again.");
    }

    return json({
      company,
      research,
      html,
      usage: {
        research: researchResponse.usage || null,
        site: siteResponse.usage || null,
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Website generation failed." }, 500);
  }
});
