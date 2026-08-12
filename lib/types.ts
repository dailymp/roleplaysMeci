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
  /**
   * Voz de ElevenLabs con la que habla este prospecto. Si es null se usa la voz
   * por defecto del agente configurada en el panel — que es lo que hacía que
   * todas las personas sonaran igual.
   */
  voice_id: string | null;
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

/** Métricas sacadas de la transcripción sin pasar por el LLM: son hechos, no opinión. */
export interface MetricasTranscripcion {
  /** Fracción del texto total que habló Daily. Objetivo: <= 0.30 */
  ratio_habla: number | null;
  /** Segundos del monólogo más largo de Daily sin que el prospecto interviniera. */
  monologo_mas_largo_secs: number | null;
  turnos_daily: number;
  turnos_prospecto: number;
  /** Segundo de la llamada en que Daily menciona el precio por primera vez. */
  precio_mencionado_secs: number | null;
  /** Segundos que Daily aguantó callada tras dar el precio. Null si nunca lo dio. */
  silencio_tras_precio_secs: number | null;
  /** Detectado por patrón en el texto: petición directa de cierre. */
  pidio_cierre: boolean;
  /** Detectado por patrón: fecha/hora concreta para el siguiente paso. */
  agendo_siguiente_paso: boolean;
  /** Preguntas abiertas de Daily, como proxy de indagación real. */
  preguntas_daily: number;
}

export interface ItemAutomatico {
  id: number;
  score: number;
  evidencia: string;
}

export interface AutoEvaluation {
  id: string;
  session_id: string;
  user_id: string;
  item_scores: Record<string, number>;
  /** Cita de la transcripción que justifica cada puntuación, por id de ítem. */
  evidencias: Record<string, string>;
  m_score: number;
  e_score: number;
  c_score: number;
  i_score: number;
  total_score: number;
  banda: string;
  fase_debil: Fase;
  metricas: MetricasTranscripcion;
  puntos_fuertes: string[];
  puntos_debiles: string[];
  momento_clave_positivo: string | null;
  momento_clave_negativo: string | null;
  frase_dolor_real: string | null;
  ejercicio_siguiente: string | null;
  resumen: string | null;
  /** Null mientras el análisis no haya podido ejecutarse (LLM caído, sin transcripción…). */
  error: string | null;
  modelo: string | null;
  created_at: string;
}

/** Lo que produce el evaluador antes de guardarse: sin id ni created_at. */
export type AutoEvaluationInput = Omit<AutoEvaluation, "id" | "created_at">;

/** Diferencia entre lo que Daily se puso y lo que el sistema ve en la transcripción. */
export interface ContrasteItem {
  id: number;
  fase: Fase;
  texto: string;
  auto: number | null;
  propia: number | null;
  /** propia - auto. Positivo = se puntuó más alto de lo que respalda la transcripción. */
  desvio: number | null;
  evidencia: string | null;
}
