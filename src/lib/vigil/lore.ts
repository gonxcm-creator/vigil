export interface LorePage {
  id: string;
  titleEs: string;
  titleEn: string;
  bodyEs: string;
  bodyEn: string;
}

export const LORE: LorePage[] = [
  {
    id: "cove",
    titleEs: "La cala",
    titleEn: "The cove",
    bodyEs: "Nadie vive en el pueblo. Las luces de abajo son mechas que alguien olvidó. Tú subes. El contrato es una noche. Luego otra.",
    bodyEn: "Nobody lives in the village. The lights below are wicks someone forgot. You climb. The contract is one night. Then another.",
  },
  {
    id: "keep",
    titleEs: "El farero anterior",
    titleEn: "The last keeper",
    bodyEs: "En el alféizar hay un cuchillo y una carta sin firma. «No apagues. Si apagues, recuerdan tu nombre.» La tinta está borrosa de sal.",
    bodyEn: "On the sill: a knife and an unsigned letter. “Do not go dark. If you go dark, they remember your name.” The ink is salt-blurred.",
  },
  {
    id: "guest",
    titleEs: "Huéspedes",
    titleEn: "Guests",
    bodyEs: "Algunos quieren luz. Algunos solo tienen forma de náufrago. Si dejas subir a lo que no es humano, al alba el faro estará más vacío.",
    bodyEn: "Some want light. Some only have the shape of a wrecked sailor. If you let up what is not human, at dawn the light will be emptier.",
  },
  {
    id: "oil",
    titleEs: "Aceite",
    titleEn: "Oil",
    bodyEs: "Los pecios no piden salvación. Dejan combustible. El faro es un animal que come noches. Cierra cuando no mires.",
    bodyEn: "The wrecks do not ask to be saved. They leave fuel. The light is an animal that eats nights. Close it when you are not looking.",
  },
  {
    id: "glass",
    titleEs: "El cristal",
    titleEn: "The glass",
    bodyEs: "El vaho es la prueba barata. Lo que no empaña, no respira. No es la única. El mar aprende las pruebas.",
    bodyEn: "Fog on the glass is the cheap test. What does not mist does not breathe. It is not the only one. The sea learns the tests.",
  },
];

export const BESTIARY: { id: string; titleEs: string; titleEn: string; bodyEs: string; bodyEn: string }[] = [
  {
    id: "wreck",
    titleEs: "Pecio",
    titleEn: "Wreck",
    bodyEs: "No es moral. Es comida del faro. Iluminas, mantienes, cae aceite.",
    bodyEn: "It is not moral. It is food for the light. You light, you hold, oil falls.",
  },
  {
    id: "human",
    titleEs: "Náufrago",
    titleEn: "Wrecked",
    bodyEs: "Echa vaho. Salpica. Tiene pies. Abrir es casa. Quemar es una página negra.",
    bodyEn: "Fogs the glass. Splashes. Has feet. To open is house. To burn is a black page.",
  },
  {
    id: "visitor",
    titleEs: "Visitante",
    titleEn: "Visitor",
    bodyEs: "Forma de náufrago. Las señales de hoy lo delatan. Abrir es dejarlo dentro.",
    bodyEn: "The shape of a wrecked sailor. Today's signs give it away. To open is to let it in.",
  },
  {
    id: "prime",
    titleEs: "La llama que come",
    titleEn: "The flame that eats",
    bodyEs: "No se identifica bien. Quemar gasta mucho. Abrir es suicidio.",
    bodyEn: "It does not identify well. Burning costs much. Opening is suicide.",
  },
];
