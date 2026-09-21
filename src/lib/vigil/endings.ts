import type { EndingId, VLang } from "./types";

export const ENDINGS: Record<
  EndingId,
  { titleEs: string; titleEn: string; bodyEs: string; bodyEn: string }
> = {
  lights: {
    titleEs: "Luces",
    titleEn: "Lights",
    bodyEs:
      "Cinco ventanas. Nadie dentro que no respire. El pueblo no te da las gracias. Enciende, y eso basta. Bajas la escalera y el aceite huele a casa. El mar sigue. Tú también. Has dejado el cuchillo en el alféizar, junto a la carta del anterior. Esta vez no hace falta leerla. Abajo alguien ha vuelto a poner mecha, o el viento, o nadie. Las luces no preguntan quién las mereció. Cuentan. Cinco, seis, siete. El faro apunta a la cala y la cala responde. No hay visita en la galería. No hay sangre en el patio. Solo el ruido del aceite y el cristal que se empana cuando tú te acercas. Eso pedía el contrato. Lo cumpliste. Puedes dormir. Mañana también habrá cuerpos. Esta noche la casa está llena de gente que echa vaho.",
    bodyEn:
      "Five windows. Nobody inside who does not breathe. The town does not thank you. It lights, and that is enough. You go down the stair and the oil smells like home. The sea remains. So do you. You left the knife on the sill, beside the last keeper's letter. This time you do not need to read it. Below, someone has put a wick back, or the wind has, or no one. The lights do not ask who earned them. They count. Five, six, seven. The beam points at the cove and the cove answers. No visitor in the gallery. No blood in the yard. Only the sound of oil and glass that mists when you come close. That was the contract. You kept it. You can sleep. Tomorrow there will be bodies again. Tonight the house is full of people who fog the glass.",
  },
  alone: {
    titleEs: "Solo",
    titleEn: "Alone",
    bodyEs:
      "Tres albas sin nadie. Dijiste que era más limpio. La Roca subió despacio, como quien conoce el camino. El faro apunta solo. Ya no hace falta farero. Tú eras el último huésped. Recuerdas las noches en que aún subía alguien. Recuerdas el vaho. Recuerdas el hambre que no quisiste pagar. Cerrar la puerta era fácil. Cada alba más fácil. Abajo las ventanas se apagaron una a una, no por malicia, por falta de mecha. El aceite sobra. El silencio no. Lo que vive bajo la piedra no grita. Espera. Cuando el haz barre la cala vacía, algo responde con el mismo ritmo, un segundo tarde. Ya no es tu faro. Es una boca. Te queda el cuchillo. No sirve.",
    bodyEn:
      "Three dawns with nobody. You said it was cleaner. The Rock climbed slowly, as one who knows the way. The light aims alone. It no longer needs a keeper. You were the last guest. You remember nights when someone still came up. You remember the fog on the glass. You remember the hunger you would not pay. Closing the door was easy. Each dawn easier. Below, the windows went out one by one, not from spite, from lack of wick. There is oil to spare. There is no spare silence. What lives under the stone does not shout. It waits. When the beam sweeps the empty cove, something answers with the same rhythm, a second late. It is no longer your light. It is a mouth. You still have the knife. It will not help.",
  },
  butcher: {
    titleEs: "Carnicero",
    titleEn: "Butcher",
    bodyEs:
      "Quemaste a los que pedían luz. El pueblo apagó una a una. Tú seguiste. El haz es un cuchillo que no distingue. Abajo ya no hay ventanas. Arriba, la llama come y no pregunta. Contaste ocho. Dejaste de contar. El diario tiene páginas negras que no son tinta: son hollín. Dijiste que era más seguro. Que el mar miente. Que el vaho se finge. Quizá tenías razón una vez. La segunda ya era costumbre. El patio huele a sebo. Las bengalas se acabaron y usaste aceite. El aceite se acabó y usaste madera. Al final usaste lo que había, y lo que había eran personas. La Roca no te odia. Te entiende. Los dos coméis. El faro sigue encendido. Nadie sube. Nadie va a subir.",
    bodyEn:
      "You burned those who asked for light. The town went out one by one. You kept on. The beam is a knife that does not tell them apart. Below there are no windows. Above, the flame eats and does not ask. You counted eight. You stopped counting. The journal has black pages that are not ink: they are soot. You said it was safer. That the sea lies. That fog can be faked. Perhaps you were right once. The second time was habit. The yard smells of tallow. The flares ran out and you used oil. The oil ran out and you used timber. In the end you used what there was, and what there was were people. The Rock does not hate you. It understands. You both eat. The light stays on. Nobody comes up. Nobody will.",
  },
  openHouse: {
    titleEs: "Casa abierta",
    titleEn: "Open house",
    bodyEs:
      "Dejaste entrar a tres que no echaban vaho. El diario, a partir de aquí, lo escribe otra mano. La tuya está en el alféizar, junto al cuchillo. No apagues, dice la carta. Ya no puedes. Ellos no piden. Ellos ocupan. La galería huele a sal y a algo más antiguo que la sal. Por las noches oyes tu propia frase, un segundo tarde. Las luces del pueblo parpadean sin ritmo. Has alimentado lo que pedía casa. Has quemado menos de lo que debías. El contrato no decía que el farero tuviera que seguir siendo humano. Solo que el faro no se apagara. El haz barre. Algo en la escalera te da las gracias con tu voz. Cierras los ojos. El cristal no se empana. Nunca más.",
    bodyEn:
      "You let in three who put no fog on the glass. From here the journal is written by another hand. Yours is on the sill, beside the knife. Do not go dark, says the letter. You no longer can. They do not ask. They occupy. The gallery smells of salt and of something older than salt. At night you hear your own phrase, a second late. The town lights stutter out of time. You fed what asked for a house. You burned less than you should have. The contract did not say the keeper had to remain human. Only that the light must not go out. The beam sweeps. Something on the stair thanks you in your voice. You close your eyes. The glass does not mist. Not any more.",
  },
  tide: {
    titleEs: "Marea",
    titleEn: "Tide",
    bodyEs:
      "Siete mareas distintas. No hace falta que fueran seguidas. El mar te vio volver. Hay una página para cada día que no dejaste en blanco. Eso es más de lo que tuvo el anterior. Dieciocho en punto. El pecio de hoy. Lo tomaste. Ocho en punto. Se cerró. Volviste a esperar. No es heroísmo. Es el oficio. La cala no guarda los nombres de los pecios; guarda que alguien subió a escribirlos. Siete veces el reloj local, no el del mar, no el de nadie más. El aceite baja y sube. Las luces bajan y suben. Tú sigues aquí cuando la ventana se abre. El contrato era una noche. Lo convertiste en una costumbre. El mar respeta las costumbres más que las promesas. Puedes bajar. Mañana a las dieciocho, otra vez.",
    bodyEn:
      "Seven distinct tides. They need not have been in a row. The sea saw you return. There is a page for each day you did not leave blank. That is more than the last keeper had. Eighteen sharp. Today's wreck. You took it. Eight sharp. It closed. You waited again. It is not heroism. It is the work. The cove does not keep the names of wrecks; it keeps that someone climbed to write them. Seven times the local clock, not the sea's, not anyone else's. Oil falls and rises. Lights fall and rise. You are still here when the window opens. The contract was one night. You made it a habit. The sea respects habits more than promises. You can go down. Tomorrow at eighteen, again.",
  },
};

export function endingTitle(id: EndingId, lang: VLang) {
  return lang === "es" ? ENDINGS[id].titleEs : ENDINGS[id].titleEn;
}

export function endingBody(id: EndingId, lang: VLang) {
  return lang === "es" ? ENDINGS[id].bodyEs : ENDINGS[id].bodyEn;
}
