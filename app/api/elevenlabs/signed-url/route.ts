import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey || !agentId) {
    return NextResponse.json(
      { error: "Faltan ELEVENLABS_API_KEY / ELEVENLABS_AGENT_ID en las variables de entorno.", missingConfig: true },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { "xi-api-key": apiKey } }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `ElevenLabs respondió ${res.status}: ${text}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({ signedUrl: data.signed_url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error obteniendo la URL firmada." }, { status: 500 });
  }
}
