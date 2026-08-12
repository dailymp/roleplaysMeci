export type Dificultad = "facil" | "media" | "dificil";
export type Modo = "completo" | "solo_M" | "solo_E" | "solo_C" | "solo_I";
export type SessionStatus = "en_curso" | "finalizada" | "evaluada";
export type Fase = "M" | "E" | "C" | "I";

export interface Persona {
  id: string;
  nombre: string;
  dificultad: Dificultad;
  situacion: string;
  dolor_superficial: string;
  dolor_real: string;
  objeciones: string[];
  condicion_cierre: string;
  color: string;
  orden: number;
}

export interface TranscriptTurn {
  role: "user" | "agent";
  message: string;
  time_in_call_secs?: number;
}

export interface RoleplaySession {
  id: string;
  user_id: string;
  persona_id: string;
  modo: Modo;
  elevenlabs_conversation_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  transcript: TranscriptTurn[] | null;
  daily_speak_ratio: number | null;
  status: SessionStatus;
  created_at: string;
}

export interface Evaluation {
  id: string;
  session_id: string;
  user_id: string;
  item_scores: Record<string, number>;
  m_score: number;
  e_score: number;
  c_score: number;
  i_score: number;
  total_score: number;
  banda: string;
  fase_debil: Fase;
  sobreexplico: boolean | null;
  pidio_cierre: boolean | null;
  sostuvo_silencio: boolean | null;
  dos_opciones: boolean | null;
  momento_clave_positivo: string | null;
  momento_clave_negativo: string | null;
  frase_dolor_real: string | null;
  ejercicio_siguiente: string | null;
  notas: string | null;
  created_at: string;
}

export interface Objecion {
  objecion: string;
  manejo: string;
  vac: boolean; // validó -> aisló -> respondió
}
