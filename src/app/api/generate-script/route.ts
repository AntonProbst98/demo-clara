import { NextResponse } from "next/server";

// POST /api/generate-script
// Turns an ALREADY-DECIDED policy into a natural-language Spanish call script.
//
// Architecture note: the numbers and the policy are computed deterministically
// upstream and passed in here verbatim. Gemini is used ONLY for language — it is
// never asked to decide a discount, an amount, or a rule. If the model is
// unavailable or errors, we fall back to a deterministic template so the agent is
// never blocked.

export const runtime = "nodejs";

// gemini-2.5-flash — has free-tier quota on this project (2.0-flash does not:
// its free_tier request limit is 0, which returned 429 RESOURCE_EXHAUSTED).
const GEMINI_MODEL = "gemini-2.5-flash";

interface ScriptRequest {
  companyUuid: string;
  amountDue: number;
  dpdDays: number;
  segment: string;
  policy: string;
  policyRule?: string | null;
  upfrontRequired?: number | null;
}

function money(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Deterministic Spanish fallback — compliant, no threats, guides to commitment. */
function templateScript(req: ScriptRequest): string {
  const upfrontLine =
    req.upfrontRequired && req.upfrontRequired > 0
      ? `Para activar este acuerdo, se requiere un pago inicial de ${money(
          req.upfrontRequired,
        )}.`
      : "Podemos estructurar el pago en parcialidades que se ajusten a su flujo de caja.";

  return [
    `Buen día, le llamo de parte del equipo de cobranza de Clara. ¿Tengo el gusto con la persona a cargo de las finanzas de la empresa?`,
    ``,
    `Me comunico respecto a su cuenta, que actualmente presenta un saldo pendiente de ${money(
      req.amountDue,
    )} con ${req.dpdDays} días de atraso. Entiendo que la operación de un negocio tiene momentos complejos, y mi objetivo hoy es encontrar juntos una solución.`,
    ``,
    `Contamos con la opción de "${req.policy}", diseñada precisamente para su situación. ${upfrontLine}`,
    ``,
    `¿Le parece si acordamos una fecha concreta para su primer pago? Con un compromiso hoy, regularizamos su cuenta y evitamos afectaciones a su historial. ¿Qué fecha le resultaría viable?`,
    ``,
    `Le agradezco mucho su tiempo y su disposición. Quedo atento para confirmar los detalles del acuerdo.`,
  ].join("\n");
}

function buildPrompt(req: ScriptRequest): string {
  return [
    `Eres un agente profesional de cobranza en una fintech B2B llamada Clara.`,
    `Redacta un GUION DE LLAMADA en español para contactar a un cliente empresarial con pago atrasado.`,
    ``,
    `Datos del caso (ya decididos, no los modifiques):`,
    `- Saldo pendiente: ${money(req.amountDue)}`,
    `- Días de atraso (DPD): ${req.dpdDays}`,
    `- Segmento: ${req.segment}`,
    `- Política recomendada: ${req.policy}`,
    req.upfrontRequired && req.upfrontRequired > 0
      ? `- Pago inicial requerido: ${money(req.upfrontRequired)}`
      : `- Sin pago inicial obligatorio.`,
    ``,
    `Requisitos del guion:`,
    `- Tono profesional, empático, calmado y respetuoso. Trato de "usted".`,
    `- Cumplimiento normativo: sin amenazas, sin lenguaje coercitivo, sin mencionar consecuencias legales.`,
    `- Debe guiar naturalmente hacia un COMPROMISO DE PAGO con una fecha concreta.`,
    `- Menciona la política recomendada y, si aplica, el pago inicial.`,
    `- NO uses corchetes ni marcadores como [Nombre], [Su Nombre] o [Fecha]. Escribe un guion COMPLETO y listo para leer tal cual.`,
    `- El agente se presenta únicamente como parte del "equipo de cobranza de Clara" (no inventes un nombre propio).`,
    `- Dirígete al cliente de forma profesional sin inventar su nombre (p. ej. "estimado cliente" o refiriéndote a su empresa).`,
    `- Conciso: 5 a 7 párrafos cortos. Termina el guion completo, sin cortarte a media frase.`,
    `- Devuelve SOLO el texto del guion, sin encabezados, títulos ni notas.`,
  ].join("\n");
}

export async function POST(request: Request) {
  let body: ScriptRequest;
  try {
    body = (await request.json()) as ScriptRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (!body.policy || body.amountDue == null || body.dpdDays == null) {
    return NextResponse.json(
      { error: "Missing required fields (policy, amountDue, dpdDays)." },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // No key configured → serve the deterministic template, still a 200 so the UI
  // shows a usable script and simply labels its source.
  if (!apiKey) {
    return NextResponse.json({
      script: templateScript(body),
      source: "template",
      reason: "GEMINI_API_KEY not set",
    });
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(body) }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1200,
          // gemini-2.5-flash enables "thinking" by default, and those tokens
          // count against maxOutputTokens — which was truncating the script
          // mid-sentence. The script needs no reasoning, so disable thinking and
          // spend the whole budget on the visible text.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Gemini responded ${res.status}`);
    }

    const data = await res.json();
    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("")
        .trim();

    if (!text) {
      throw new Error("Empty response from Gemini.");
    }

    return NextResponse.json({ script: text, source: "gemini" });
  } catch (err) {
    // Any failure → deterministic fallback, agent is never blocked.
    return NextResponse.json({
      script: templateScript(body),
      source: "template",
      reason: err instanceof Error ? err.message : "Gemini request failed",
    });
  }
}
