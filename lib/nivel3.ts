import { Nivel3Bloque, Nivel3Marca } from "./types";

/**
 * Hoja de "Revisión Nivel 3" — la que usa el coach de Top Closing para
 * corregir las llamadas de Daily.
 *
 * POR QUÉ ESTO EXISTE APARTE DE `rubrica.ts`. La rúbrica MECI puntúa el
 * MÉTODO en cuatro fases (Mapeo, Empuje, Cierre, Implementación) de 1 a 5.
 * Esta hoja es otra cosa: es la ESTRUCTURA del descubrimiento paso a paso,
 * con escala Sí / Mejorable / No, y de sus 22 casillas la rúbrica MECI sólo
 * cubría 6. Se estaba entrenando contra un examen y corrigiendo con otro.
 *
 * Las dos se conservan porque miden cosas distintas y ninguna sobra: MECI
 * llega hasta el cobro y el seguimiento, donde esta hoja no entra; esta hoja
 * desmenuza los primeros 17 minutos, que es donde MECI sólo tenía cinco
 * casillas.
 *
 * EL TEXTO DE CADA ÍTEM ESTÁ COPIADO LITERAL de la hoja del coach, incluido
 * el orden. No se "mejora" la redacción: el valor de esto es poder poner la
 * pantalla al lado de su PDF y que las casillas se correspondan una a una.
 */

export interface Nivel3Item {
  id: number;
  bloque: Nivel3Bloque;
  texto: string;
  /**
   * Qué mirar para decidir la marca. No se enseña en la hoja: va al prompt
   * del evaluador, para que "Sí" signifique lo mismo en cada sesión.
   */
  criterio: string;
}

export const NIVEL3_BLOQUE_LABEL: Record<Nivel3Bloque, string> = {
  acondicionamiento: "Bloque 1 · Parte 1 — Acondicionamiento de la llamada",
  emocional: "Bloque 1 · Parte 2 — Aspecto emocional",
  logico: "Bloque 1 · Parte 3 — Aspecto lógico",
  pitch: "Bloque 2 — Transición al pitch",
};

export const NIVEL3: Nivel3Item[] = [
  {
    id: 1,
    bloque: "acondicionamiento",
    texto: "Hizo buen rapport",
    criterio:
      "Conversación humana antes de entrar en materia, sin ir directa a vender. No vale un 'hola, ¿qué tal?' de trámite.",
  },
  {
    id: 2,
    bloque: "acondicionamiento",
    texto: "Agradeció por el tiempo en la llamada",
    criterio: "Agradecimiento explícito por el tiempo o por la puntualidad, en los primeros minutos.",
  },
  {
    id: 3,
    bloque: "acondicionamiento",
    texto: "Preguntó por el tomador de decisiones",
    criterio:
      "Preguntó si decide sola o hay alguien más (socio, pareja, comité). Sin esto, todo lo que venga después puede no servir de nada.",
  },
  {
    id: 4,
    bloque: "acondicionamiento",
    texto: "Se presentó formalmente y generó autoridad",
    criterio:
      "Dijo quién es, qué hace y por qué tiene criterio para estar en esa llamada (años, casos, resultados). Presentarse no es sólo decir el nombre.",
  },
  {
    id: 5,
    bloque: "acondicionamiento",
    texto: "Dio el propósito de la llamada",
    criterio: "Explicó a qué venía la llamada y qué iba a pasar en ella antes de empezar a preguntar.",
  },
  {
    id: 6,
    bloque: "acondicionamiento",
    texto: 'La primera pregunta fue "¿Cómo te podemos ayudar?"',
    criterio:
      "Marca Sí sólo si esa fue LA PRIMERA pregunta de diagnóstico. Si la hizo pero después de otras, es Mejorable. Si no aparece, No.",
  },
  {
    id: 7,
    bloque: "acondicionamiento",
    texto: "Transición a la Hoja de Vida",
    criterio:
      "Llevó a la persona a la hoja de vida / pantalla compartida. El objetivo son los primeros 3-4 minutos: más tarde es Mejorable.",
  },
  {
    id: 8,
    bloque: "acondicionamiento",
    texto: "Explicó las 3 razones por las cuales necesito su ayuda",
    criterio: "Enunció explícitamente las tres razones por las que necesita la colaboración del prospecto en el ejercicio.",
  },

  {
    id: 9,
    bloque: "emocional",
    texto: 'Descubrió "pain points"',
    criterio:
      "Llegó al problema real, no al que el prospecto suelta primero. Exige al menos tres indagaciones encadenadas sobre el mismo tema.",
  },
  {
    id: 10,
    bloque: "emocional",
    texto: "Preguntó directamente por los problemas",
    criterio: "Preguntó por los problemas de frente, sin rodearlos ni suponerlos.",
  },
  {
    id: 11,
    bloque: "emocional",
    texto: "Identificó urgencia",
    criterio:
      "Estableció por qué hay que resolverlo AHORA y no dentro de seis meses. Urgencia del prospecto, no presión de la comercial.",
  },
  {
    id: 12,
    bloque: "emocional",
    texto: "Identificó sentimiento",
    criterio:
      "Preguntó cómo le hace SENTIR el problema y obtuvo una emoción, no un dato. Es la casilla que separa un diagnóstico de un cuestionario.",
  },
  {
    id: 13,
    bloque: "emocional",
    texto: "Preguntó si afectaba otras áreas de su vida",
    criterio: "Llevó el problema fuera del trabajo: familia, salud, descanso, vida personal.",
  },
  {
    id: 14,
    bloque: "emocional",
    texto: "Recopilamiento de problemas",
    criterio:
      "Recogió y devolvió la lista de problemas junta ('entonces tenemos A, B y C'), en vez de tratarlos sueltos y olvidarlos.",
  },
  {
    id: 15,
    bloque: "emocional",
    texto: "Historia personal",
    criterio: "Sacó la historia de cómo llegó hasta aquí: por qué empezó, qué buscaba, qué le movía.",
  },
  {
    id: 16,
    bloque: "emocional",
    texto: "Identificó metas y objetivos",
    criterio: "Obtuvo una meta concreta y medible del prospecto, dicha por él.",
  },

  {
    id: 17,
    bloque: "logico",
    texto: "Cuadro comparativo",
    criterio: "Puso enfrente dónde está hoy y dónde quiere estar, de forma visible.",
  },
  {
    id: 18,
    bloque: "logico",
    texto: "Hizo pregunta de compromiso",
    criterio:
      "Preguntó si está dispuesto a hacer lo que haga falta / a comprometerse, ANTES de enseñar la solución.",
  },
  {
    id: 19,
    bloque: "logico",
    texto: "Preguntó y dio contexto del closing",
    criterio: "Anticipó qué va a pasar al final de la llamada y pidió permiso para ello.",
  },
  {
    id: 20,
    bloque: "logico",
    texto: "Transición a la calculadora",
    criterio: "Enlazó las metas con la calculadora en vez de saltar a ella sin más.",
  },
  {
    id: 21,
    bloque: "logico",
    texto: "Buen uso de la calculadora",
    criterio:
      "Las cifras las puso el PROSPECTO. Sugerirle un valor invalida el ejercicio entero: deja de ser su número y pasa a ser el tuyo.",
  },

  {
    id: 22,
    bloque: "pitch",
    texto: "Transición al pitch",
    criterio:
      'Cerró el descubrimiento y abrió el pitch con una frase de puente del tipo "basado en lo que hemos hablado, estoy segura de que te podemos ayudar a…".',
  },
];

/** Puntos por marca. La hoja del coach no numera; esto permite medir evolución. */
export const PUNTOS_POR_MARCA: Record<Nivel3Marca, number> = {
  si: 2,
  mejorable: 1,
  no: 0,
};

export const NIVEL3_MARCA_LABEL: Record<Nivel3Marca, string> = {
  si: "Sí",
  mejorable: "Mejorable",
  no: "No",
};

export const NIVEL3_MARCA_COLOR: Record<Nivel3Marca, string> = {
  si: "#0ca30c",
  mejorable: "#fab219",
  no: "#d03b3b",
};

export const NIVEL3_MAX = NIVEL3.length * PUNTOS_POR_MARCA.si;

export interface Nivel3Totales {
  /** Puntos obtenidos sobre NIVEL3_MAX. */
  puntos: number;
  porcentaje: number;
  cuenta: Record<Nivel3Marca, number>;
  /** Puntos y máximo por bloque, para ver dónde se cae la estructura. */
  porBloque: Record<Nivel3Bloque, { puntos: number; max: number }>;
  /** El bloque con peor porcentaje: lo que toca practicar aislado. */
  bloqueDebil: Nivel3Bloque;
  veredicto: string;
}

const BLOQUES = Object.keys(NIVEL3_BLOQUE_LABEL) as Nivel3Bloque[];

export function calcularNivel3(marcas: Record<string, Nivel3Marca>): Nivel3Totales {
  const cuenta: Record<Nivel3Marca, number> = { si: 0, mejorable: 0, no: 0 };
  const porBloque = Object.fromEntries(
    BLOQUES.map((b) => [b, { puntos: 0, max: 0 }])
  ) as Record<Nivel3Bloque, { puntos: number; max: number }>;

  let puntos = 0;
  for (const item of NIVEL3) {
    // Un ítem sin marca cuenta como "no": la hoja del coach no deja casillas
    // en blanco, y dejarlas aquí inflaría el porcentaje callando los huecos.
    const marca = marcas[String(item.id)] ?? "no";
    const p = PUNTOS_POR_MARCA[marca];
    cuenta[marca] += 1;
    puntos += p;
    porBloque[item.bloque].puntos += p;
    porBloque[item.bloque].max += PUNTOS_POR_MARCA.si;
  }

  const bloqueDebil = BLOQUES.reduce((peor, b) => {
    const pct = (x: Nivel3Bloque) => (porBloque[x].max ? porBloque[x].puntos / porBloque[x].max : 1);
    return pct(b) < pct(peor) ? b : peor;
  }, BLOQUES[0]);

  const porcentaje = Math.round((puntos / NIVEL3_MAX) * 100);

  let veredicto: string;
  if (porcentaje >= 85) veredicto = "Estructura completa. Lo que queda son matices de ejecución, no de guión.";
  else if (porcentaje >= 65)
    veredicto = "Tienes la estructura marcada; falta profundizar en las casillas emocionales.";
  else if (porcentaje >= 45)
    veredicto = "Sigues la estructura a trozos. Llevas el guión delante en la próxima y no te saltas ningún paso.";
  else veredicto = "La llamada va sin estructura. Repite el Bloque 1 aislado antes de una llamada real.";

  return { puntos, porcentaje, cuenta, porBloque, bloqueDebil, veredicto };
}
