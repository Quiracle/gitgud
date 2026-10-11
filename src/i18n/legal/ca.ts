import { LEGAL_DOMAIN, LEGAL_EMAIL, LEGAL_OWNER, LEGAL_REPOSITORY, type LegalDocument } from "./types";

export const ca: LegalDocument = {
  title: "Legal",
  updated: "Darrera actualització: {date}",
  jumpTo: "Ves a la secció",
  sections: [
    {
      id: "privacy",
      chip: "Privacitat",
      title: "Política de privacitat",
      blocks: [
        { kind: "h3", text: "Responsable del tractament" },
        {
          kind: "p",
          text: `GitGud (${LEGAL_DOMAIN}) el gestiona ${LEGAL_OWNER}, resident a Espanya, que és la responsable del tractament de les teves dades personals d'acord amb el Reglament general de protecció de dades (RGPD) i la Llei orgànica de protecció de dades (LOPDGDD). Per a qualsevol qüestió sobre les teves dades, escriu a <mail>${LEGAL_EMAIL}</mail>.`,
        },
        { kind: "h3", text: "Juga sense compte" },
        {
          kind: "p",
          text: "Pots jugar a tots els trencaclosques com a convidat. El progrés, els intents i la configuració de convidat es desen a l'emmagatzematge del teu navegador, al teu dispositiu, i no ens arriben.",
        },
        { kind: "h3", text: "Quines dades recollim i per a què" },
        {
          kind: "table",
          head: ["Dades", "Finalitat", "Base legal", "Conservació"],
          rows: [
            [
              "Correu, nom, avatar i ID del compte de Google o GitHub",
              "Crear el teu compte i iniciar la sessió",
              "Prestar-te el servei que demanes (art. 6.1.b RGPD)",
              "Fins que eliminis el compte",
            ],
            [
              "Nom i avatar de la classificació",
              "Mostrar-te a la classificació diària",
              "Prestar-te el servei (art. 6.1.b)",
              "Fins que el canviïs o eliminis el compte",
            ],
            [
              "Intents de trencaclosques: temps, reinicis, ordres, pistes i dates",
              "Sincronitzar el teu progrés, classificar-te i comptar ratxes i assoliments",
              "Prestar-te el servei (art. 6.1.b)",
              "Fins que eliminis el compte",
            ],
            [
              "El que escrius a la pràctica amb IA (fins a 200 caràcters) i el trencaclosques creat",
              "Generar el teu trencaclosques de pràctica i limitar la freqüència d'ús",
              "Prestar-te el servei (art. 6.1.b)",
              "Fins que eliminis el compte",
            ],
            [
              "ID de membre i nom de LinkedIn, un testimoni d'accés xifrat i un registre de les publicacions fetes des de GitGud",
              "Publicar un resultat a LinkedIn quan ho confirmes",
              "El teu consentiment (art. 6.1.a), que retires en desconnectar LinkedIn",
              "Fins que desconnectis, caduqui el testimoni o eliminis el compte",
            ],
            [
              "Estadístiques d'ús de Google Analytics: pàgines visitades, tipus de dispositiu i navegador, ubicació aproximada i un ID aleatori en una galeta",
              "Entendre com es juga a GitGud i millorar-lo",
              "El teu consentiment (art. 6.1.a), que pots retirar quan vulguis a la configuració del compte",
              "Fins a 14 mesos",
            ],
            [
              "Adreça IP i dades del navegador als registres tècnics dels nostres proveïdors",
              "Mantenir el servei en funcionament i segur",
              "Interès legítim (art. 6.1.f)",
              "Els terminis breus que fixen els nostres proveïdors",
            ],
          ],
        },
        {
          kind: "p",
          text: "No venem les teves dades, no mostrem anuncis i no prenem decisions automatitzades amb efectes jurídics o igualment significatius sobre tu. Només fem servir analítica si acceptes les galetes d'analítica.",
        },
        { kind: "h3", text: "Què veuen altres jugadors" },
        {
          kind: "p",
          text: "La classificació diària és pública. Mostra el teu nom de classificació, avatar, posició, temps i reinicis. Mai no mostra el teu correu. Pots triar un altre nom de classificació a la configuració del compte.",
        },
        { kind: "h3", text: "Qui ens ajuda a oferir GitGud" },
        {
          kind: "list",
          items: [
            "<b>Supabase</b>: base de dades, inici de sessió i funcions de servidor.",
            "<b>Vercel</b>: allotja el web.",
            "<b>Google Analytics</b>: estadístiques d'ús, només si acceptes les galetes d'analítica.",
            "<b>OpenAI</b>: genera els trencaclosques. Només rep el text de la teva pràctica, mai el teu nom ni el teu correu.",
            "<b>Google i GitHub</b>: gestionen l'inici de sessió segons les seves pròpies polítiques de privacitat.",
            "<b>LinkedIn</b>: només si el connectes, segons la seva pròpia política de privacitat.",
          ],
        },
        {
          kind: "p",
          text: "Algunes d'aquestes empreses són als Estats Units. Les transferències s'emparen en el Marc de privacitat de dades UE-EUA o en les clàusules contractuals tipus de la Comissió Europea.",
        },
        { kind: "h3", text: "Els teus drets" },
        {
          kind: "p",
          text: `Pots demanar accedir a les teves dades, rectificar-les, suprimir-les o endur-te-les, limitar-ne o oposar-te al tractament i retirar qualsevol consentiment que hagis donat. Escriu a <mail>${LEGAL_EMAIL}</mail> des del correu del teu compte; responem en el termini d'un mes. Mentre no es pugui eliminar el compte des de l'app, escriu-nos i eliminarem el teu compte i les teves dades en un termini de 30 dies. Si no estàs d'acord amb la nostra resposta, pots reclamar davant l'Agència Espanyola de Protecció de Dades (AEPD) a <url>https://www.aepd.es</url>.`,
        },
        { kind: "h3", text: "Edat mínima" },
        {
          kind: "p",
          text: "Has de tenir com a mínim 14 anys per crear un compte. Els menors poden jugar com a convidats o crear un compte amb el consentiment de la mare, el pare o el tutor.",
        },
        { kind: "h3", text: "Seguretat" },
        {
          kind: "p",
          text: "Les connexions fan servir HTTPS. Les regles de la base de dades només permeten a cada jugador llegir i canviar els seus propis registres, i els testimonis de LinkedIn es desen xifrats.",
        },
        { kind: "h3", text: "Canvis" },
        {
          kind: "p",
          text: "Quan aquesta pàgina canviï, actualitzarem la data de dalt. T'avisarem a l'app dels canvis importants.",
        },
      ],
    },
    {
      id: "cookies",
      chip: "Galetes",
      title: "Galetes i emmagatzematge local",
      blocks: [
        {
          kind: "p",
          text: "GitGud no fa servir galetes publicitàries. Desa a l'emmagatzematge del teu navegador uns quants elements que el joc necessita per funcionar, de manera que no requereixen consentiment:",
        },
        {
          kind: "table",
          code: true,
          head: ["Element", "Finalitat", "Conservació"],
          rows: [
            ["gitgud:progress:v1", "El teu progrés, intents i millors temps", "Fins que l'esborris"],
            ["gitgud:daily:v1:…", "Còpies dels trencaclosques diaris per jugar sense connexió", "Fins que l'esborris"],
            ["gitgud:guided-lessons:v1", "Els teus trencaclosques de pràctica amb IA recents", "Fins que l'esborris"],
            ["gitgud:auth:v1", "Manté la sessió iniciada", "Fins que tanquis la sessió"],
            ["gitgud:locale:v1", "L'idioma que has triat", "Fins que l'esborris"],
            ["gitgud:consent:v1", "Recorda la teva elecció sobre les galetes", "24 mesos"],
            ["gitgud:welcome-seen:v1", "Recorda que ja has vist la benvinguda", "Fins que l'esborris"],
            ["gitgud:guided-goal-draft:v1, gitgud:linkedin:resume-share", "Desa un objectiu de pràctica o una publicació de LinkedIn sense enviar mentre no hi ets", "Fins que tanquis la pestanya"],
          ],
        },
        {
          kind: "p",
          text: "Els pots esborrar quan vulguis des de la configuració del lloc del teu navegador. Si jugues com a convidat, en esborrar-los perds el teu progrés.",
        },
        { kind: "h3", text: "Galetes d'analítica, només si acceptes" },
        {
          kind: "p",
          text: "Si acceptes, Google Analytics instal·la aquestes galetes perquè puguem comptar les visites i veure quines parts de GitGud es fan servir. Google Signals i les funcions publicitàries estan desactivades. Si rebutges, Google Analytics no es carrega.",
        },
        {
          kind: "table",
          code: true,
          head: ["Galeta", "Finalitat", "Conservació"],
          rows: [
            ["_ga", "Google Analytics: distingeix les visites amb un ID aleatori", "2 anys"],
            ["_ga_BFBC4GRELH", "Google Analytics: manté l'estat de la teva visita", "2 anys"],
          ],
        },
        {
          kind: "p",
          text: "Pots canviar la teva elecció quan vulguis des de la configuració del compte o amb el botó de sota. Si rebutges més tard, aquestes galetes s'esborren.",
        },
        { kind: "consent" },
      ],
    },
    {
      id: "terms",
      chip: "Condicions",
      title: "Condicions d'ús",
      blocks: [
        {
          kind: "p",
          text: "En fer servir GitGud acceptes aquestes condicions. GitGud és un joc gratuït per aprendre Git.",
        },
        { kind: "h3", text: "Joc net" },
        {
          kind: "list",
          items: [
            "No manipulis el joc, les puntuacions ni la classificació, ni enviïs resultats de manera automatitzada.",
            "No facis un mal ús de la pràctica amb IA, no intentis que generi contingut perjudicial ni la sobrecarreguis.",
            "Tria un nom de classificació que no sigui ofensiu, enganyós ni d'una altra persona.",
          ],
        },
        {
          kind: "p",
          text: "Podem retirar entrades o noms de la classificació, o suspendre comptes, que incompleixin aquestes normes. Les puntuacions es calculen al teu navegador, així que la classificació és un joc, no un rànquing oficial.",
        },
        { kind: "h3", text: "El servei" },
        {
          kind: "p",
          text: "GitGud s'ofereix tal com és, sense garantia que estigui sempre disponible o lliure d'errors. Podem canviar, aturar o retirar funcions. GitGud simula Git; no és un client de Git real, així que no el facis servir per prendre decisions sobre repositoris reals.",
        },
        { kind: "h3", text: "Propietat intel·lectual" },
        {
          kind: "p",
          text: `El codi font de GitGud és programari lliure sota la Llicència pública general de GNU v3 a <url>${LEGAL_REPOSITORY}</url>. Git i el logotip de Git són marques de Software Freedom Conservancy; GitGud no està afiliat al projecte Git ni compta amb el seu suport. Google, GitHub i LinkedIn són marques dels seus respectius titulars.`,
        },
        { kind: "h3", text: "Responsabilitat i llei aplicable" },
        {
          kind: "p",
          text: "En la mesura que la llei ho permeti, no responem de pèrdues indirectes ni de progrés perdut per fer servir GitGud. Res del que s'estableix aquí limita els teus drets com a consumidor. Aquestes condicions es regeixen per la llei espanyola; si ets consumidor, també pots acudir als tribunals del teu domicili.",
        },
      ],
    },
    {
      id: "ai",
      chip: "IA",
      title: "Contingut generat amb IA",
      blocks: [
        {
          kind: "p",
          text: "La majoria dels trencaclosques diaris i tots els trencaclosques de pràctica amb IA els genera un model d'IA d'OpenAI. Abans que els vegis, el simulador de GitGud comprova que es poden resoldre. El curs Aprèn el bàsic l'escriuen persones.",
        },
        {
          kind: "p",
          text: `Les històries, pistes i missatges de commit escrits per la IA poden contenir errors. Si veus alguna cosa incorrecta o inadequada, avisa'ns a <mail>${LEGAL_EMAIL}</mail>.`,
        },
        {
          kind: "p",
          text: "Els trencaclosques diaris es generen sense dades de cap jugador. A la pràctica amb IA, només s'envia a OpenAI el text que escrius, així que no hi incloguis informació personal. Segons les condicions de l'API d'OpenAI, no es fa servir per entrenar els seus models.",
        },
      ],
    },
    {
      id: "notice",
      chip: "Avís legal",
      title: "Avís legal",
      blocks: [
        {
          kind: "p",
          text: "Informació exigida per la Llei de serveis de la societat de la informació (LSSI-CE, Llei 34/2002):",
        },
        {
          kind: "list",
          items: [
            `<b>Titular</b>: ${LEGAL_OWNER}`,
            `<b>Lloc web</b>: ${LEGAL_DOMAIN}`,
            `<b>Correu</b>: <mail>${LEGAL_EMAIL}</mail>`,
            "<b>País</b>: Espanya",
            "<b>Activitat</b>: joc educatiu gratuït i sense ànim de lucre",
          ],
        },
      ],
    },
  ],
};
