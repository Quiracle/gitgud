import type { Locale } from "../../i18n/locales";
import type { LearnBasicsLesson, LearnBasicsLessonId, LessonIntro } from "./types";

/** Every player-facing text of a lesson. Git commands, branches, and commit IDs never change. */
export interface LessonText {
  title: string;
  summary: string;
  intro: LessonIntro;
  description: string;
  objectives: string[];
  hints: string[];
}

type TranslatedLocale = Exclude<Locale, "en">;

/** English lives in the catalog and puzzle definitions; these are the other languages. */
export const LESSON_TEXT: Record<TranslatedLocale, Record<LearnBasicsLessonId, LessonText>> = {
  es: {
    "basics-01-inspect-history": {
      title: "Inspecciona el historial",
      summary: "Lee el historial de la rama actual y el de todas las ramas.",
      intro: {
        what: "Cada commit es una instantánea guardada del proyecto. git log los lista, del más nuevo al más antiguo, para que veas cómo ha llegado el proyecto hasta aquí.",
        how: [
          "git log empieza en HEAD, el commit en el que estás, y sigue cada commit hacia atrás hasta su padre.",
          "Los commits que solo viven en otras ramas quedan ocultos, porque tu rama no puede llegar a ellos.",
          "Añade --all para listar a la vez los commits de todas las ramas.",
        ],
        task: "Ejecuta git log y después git log --all para encontrar la bufanda escondida en otra rama.",
      },
      description: "Lee el historial de la rama actual y luego incluye todas las ramas para encontrar el trabajo de la bufanda.",
      objectives: [
        "Ejecuta git log para inspeccionar la rama actual.",
        "Ejecuta git log --all para incluir los commits de todas las ramas.",
      ],
      hints: [
        "Empieza con git log.",
        "La opción --all muestra los commits alcanzables desde cualquier rama.",
      ],
    },
    "basics-02-switch-branches": {
      title: "Cambia de rama",
      summary: "Mueve HEAD con seguridad entre ramas existentes.",
      intro: {
        what: "Una rama es un nombre que apunta a un commit. git switch mueve HEAD, tu posición actual, a otra rama para que veas su versión del proyecto.",
        how: [
          "HEAD es donde estás. Es la tarjeta con el contorno lima.",
          "git switch style mueve HEAD a style y muestra la gallina guardada allí.",
          "No se pierde nada: main sigue apuntando a su propio commit y puedes volver cuando quieras.",
          "git checkout <branch> también funciona, pero switch es el comando moderno y más claro.",
        ],
        task: "Cambia de main a la rama style para descubrir la bufanda turquesa.",
      },
      description: "Pasa de main a la rama style para que la vista muestre su bufanda turquesa.",
      objectives: ["Termina en la rama style.", "Descubre el estado de la bufanda guardado allí."],
      hints: ["Usa git switch seguido del nombre de la rama."],
    },
    "basics-03-fast-forward-merge": {
      title: "Avanza una rama (fast-forward)",
      summary: "Avanza una rama cuando los historiales no se han separado.",
      intro: {
        what: "git merge trae el trabajo de otra rama a la rama en la que estás.",
        how: [
          "Si tu rama no se ha movido desde que la otra se separó, no hay nada que combinar.",
          "Git simplemente desliza tu rama hasta el último commit de la otra. Eso es un fast-forward.",
          "No se crea ningún commit nuevo, así que el historial sigue siendo una línea recta.",
        ],
        task: "Estás en main. Fusiona feature para darle a la gallina su sombrero azul.",
      },
      description: "main no se ha separado, así que fusiona la rama feature moviendo main directamente a su commit.",
      objectives: ["Fusiona feature en main.", "Mantén el historial lineal con un fast-forward."],
      hints: ["Estando en main, ejecuta git merge feature."],
    },
    "basics-04-ff-only-merge": {
      title: "Exige un fast-forward",
      summary: "Exige una actualización lineal y rechaza historiales separados.",
      intro: {
        what: "--ff-only le dice a git merge: haz un fast-forward si puedes y, si no, no hagas nada.",
        how: [
          "Cuando el fast-forward es posible, funciona exactamente como un merge normal.",
          "Cuando las ramas se han separado, Git se niega en lugar de crear un commit de merge.",
          "Los equipos lo usan para mantener el historial lineal y evitar commits de merge inesperados.",
        ],
        task: "Avanza main hasta feature con git merge --ff-only feature.",
      },
      description: "Actualiza main solo si Git puede mantener el historial lineal sin crear un commit de merge.",
      objectives: ["Avanza main hasta feature con un fast-forward.", "Usa la opción de seguridad --ff-only."],
      hints: ["Añade --ff-only entre merge y el nombre de la rama."],
    },
    "basics-05-three-way-merge": {
      title: "Fusiona trabajo separado",
      summary: "Combina cambios independientes después de que las ramas se separen.",
      intro: {
        what: "Cuando las dos ramas tienen commits nuevos, Git no puede limitarse a avanzar. Crea un commit de merge que une las dos líneas de trabajo.",
        how: [
          "Git busca el ancestro común, el commit donde se separaron las ramas.",
          "Combina lo que cambió en cada lado desde ese punto.",
          "El resultado es un nuevo commit de merge con dos padres, uno de cada rama.",
          "Si los dos lados cambian lo mismo, hay un conflicto. Aquí los conflictos no están soportados.",
        ],
        task: "main añadió un sombrero y feature una bufanda. Fusiona feature en main para quedarte con los dos.",
      },
      description: "main añadió un sombrero y feature una bufanda. Combina los dos cambios independientes en un commit de merge.",
      objectives: ["Inspecciona las dos ramas.", "Fusiona feature en main sin perder ninguno de los cambios."],
      hints: [
        "Usa git log --all para ver las dos líneas de trabajo.",
        "Los cambios tocan propiedades diferentes, así que se pueden fusionar sin problemas.",
      ],
    },
    "basics-06-cherry-pick": {
      title: "Copia un solo commit",
      summary: "Copia un commit concreto en la rama actual.",
      intro: {
        what: "git cherry-pick copia un commit de cualquier parte del grafo a tu rama actual.",
        how: [
          "Dale el ID de un commit, como c20. Cada tarjeta muestra su ID.",
          "Git aplica solo el cambio de ese commit encima de HEAD, como un commit nuevo.",
          "El commit original se queda donde estaba, así que su rama no cambia.",
          "Es útil cuando necesitas un cambio sin el resto de la rama.",
        ],
        task: "Copia el commit de la bufanda, c20, de experiment a main.",
      },
      description: "Trae a main solo el commit de la bufanda de la rama experiment.",
      objectives: ["Copia el commit c20 en main.", "Deja la rama experiment sin cambios."],
      hints: ["Usa git cherry-pick seguido del ID del commit."],
    },
    "basics-07-revert": {
      title: "Deshaz un cambio con seguridad",
      summary: "Deshaz un cambio con un commit nuevo que conserva el historial.",
      intro: {
        what: "git revert deshace un commit añadiendo un commit nuevo que hace exactamente lo contrario.",
        how: [
          "Dale el ID del commit que quieres deshacer.",
          "Git calcula el cambio inverso (ponerse las gafas de sol pasa a quitárselas) y lo guarda en un commit.",
          "El commit original sigue en el historial, así que no se reescribe nada.",
          "Por eso revert es seguro en ramas que comparte más gente.",
        ],
        task: "Quítale las gafas de sol haciendo revert del commit b20.",
      },
      description: "Elimina las gafas de sol que sobran creando un commit nuevo que invierte el cambio original.",
      objectives: ["Deshaz el commit b20 sin reescribir el historial.", "Conserva tanto el commit original como el que lo deshace."],
      hints: ["Usa git revert seguido del ID del commit para crear un commit que lo deshaga con seguridad."],
    },
    "basics-08-rebase": {
      title: "Reaplica el trabajo sobre una nueva base",
      summary: "Reconstruye una rama encima de otra.",
      intro: {
        what: "git rebase mueve tu rama para que empiece en la punta de otra rama, como si hubieras empezado a trabajar allí.",
        how: [
          "Git aparta los commits que solo están en tu rama.",
          "Mueve tu rama a la punta de la rama que indicas.",
          "Después vuelve a aplicar tus commits encima, uno a uno, como commits nuevos.",
          "El historial queda en línea recta, sin commit de merge, y la otra rama no se mueve.",
        ],
        task: "Estás en feature. Haz rebase sobre main para que tenga el sombrero y la bufanda.",
      },
      description: "main consiguió un sombrero azul después de que empezara feature. Reaplica el commit de la bufanda de feature encima de main para que feature tenga las dos cosas, sin commit de merge.",
      objectives: [
        "Haz rebase de feature sobre main.",
        "Deja main sin cambios.",
        "Termina en feature con el sombrero y la bufanda.",
      ],
      hints: [
        "Ya estás en feature. Rebase recibe la rama sobre la que construir.",
        "Ejecuta git rebase main.",
      ],
    },
    "basics-09-interactive-rebase": {
      title: "Combina commits relacionados",
      summary: "Usa pick y squash para limpiar un historial corto.",
      intro: {
        what: "El rebase interactivo te deja editar la lista de commits antes de que Git los vuelva a aplicar.",
        how: [
          "git rebase -i <branch> abre una lista con los commits de tu rama, del más antiguo al más nuevo.",
          "pick mantiene un commit tal como está.",
          "squash funde un commit con el de encima, así sus cambios pasan a ser un solo commit.",
          "Después Git aplica la lista y deja un historial más ordenado.",
        ],
        task: "Ejecuta git rebase -i main, deja c31 como pick y haz squash de c32 en él.",
      },
      description: "feature dibujó el contorno de una cresta y luego la pintó de rojo. Junta los dos pasos en un solo commit ordenado con squash.",
      objectives: [
        "Empieza un rebase interactivo sobre main.",
        "Haz pick de c31 y squash de c32 en él.",
        "Termina en feature con una cresta roja.",
      ],
      hints: [
        "Ejecuta git rebase -i main para abrir la lista.",
        "Deja el primer commit como pick y cambia el segundo a squash.",
      ],
    },
    "basics-10-capstone": {
      title: "Proyecto final de Git Basics",
      summary: "Resuelve un puzzle de varios comandos con todo lo aprendido en el curso.",
      intro: {
        what: "Hora de juntarlo todo. No hay una única respuesta correcta: cualquier combinación de comandos que llegue al objetivo vale.",
        how: [
          "Empieza con git log --all para explorar todas las ramas.",
          "revert elimina un cambio no deseado con seguridad.",
          "merge (o rebase) trae una rama entera.",
          "cherry-pick coge un solo commit.",
        ],
        task: "En main: deshaz las gafas de sol, trae el sombrero azul de feature y copia solo la bufanda de experiment.",
      },
      description: "main tiene unas gafas de sol que sobran. Deshazlas con seguridad, trae el sombrero azul de feature y coge solo la bufanda de experiment, no su boceto de cresta.",
      objectives: [
        "Deshaz b20 sin reescribir main.",
        "Trae a main el sombrero azul de feature.",
        "Copia solo el commit de la bufanda de experiment.",
        "Termina en main.",
      ],
      hints: [
        "Usa git log --all para ver todas las ramas.",
        "Revert quita las gafas de sol con un commit nuevo.",
        "Cualquier orden vale: trae el sombrero con merge o rebase y haz cherry-pick solo de x21.",
      ],
    },
  },
  ca: {
    "basics-01-inspect-history": {
      title: "Inspecciona l'historial",
      summary: "Llegeix l'historial de la branca actual i el de totes les branques.",
      intro: {
        what: "Cada commit és una instantània desada del projecte. git log els llista, del més nou al més antic, perquè vegis com ha arribat el projecte fins aquí.",
        how: [
          "git log comença a HEAD, el commit on ets, i segueix cada commit enrere fins al seu pare.",
          "Els commits que només viuen en altres branques queden amagats, perquè la teva branca no hi pot arribar.",
          "Afegeix --all per llistar alhora els commits de totes les branques.",
        ],
        task: "Executa git log i després git log --all per trobar la bufanda amagada en una altra branca.",
      },
      description: "Llegeix l'historial de la branca actual i després inclou totes les branques per trobar la feina de la bufanda.",
      objectives: [
        "Executa git log per inspeccionar la branca actual.",
        "Executa git log --all per incloure els commits de totes les branques.",
      ],
      hints: [
        "Comença amb git log.",
        "L'opció --all mostra els commits accessibles des de qualsevol branca.",
      ],
    },
    "basics-02-switch-branches": {
      title: "Canvia de branca",
      summary: "Mou HEAD amb seguretat entre branques existents.",
      intro: {
        what: "Una branca és un nom que apunta a un commit. git switch mou HEAD, la teva posició actual, a una altra branca perquè vegis la seva versió del projecte.",
        how: [
          "HEAD és on ets. És la targeta amb el contorn llima.",
          "git switch style mou HEAD a style i mostra la gallina que hi ha desada.",
          "No es perd res: main continua apuntant al seu commit i pots tornar-hi quan vulguis.",
          "git checkout <branch> també funciona, però switch és l'ordre moderna i més clara.",
        ],
        task: "Canvia de main a la branca style per descobrir la bufanda turquesa.",
      },
      description: "Passa de main a la branca style perquè la vista mostri la seva bufanda turquesa.",
      objectives: ["Acaba a la branca style.", "Descobreix l'estat de la bufanda que hi ha desat."],
      hints: ["Fes servir git switch seguit del nom de la branca."],
    },
    "basics-03-fast-forward-merge": {
      title: "Avança una branca (fast-forward)",
      summary: "Avança una branca quan els historials no s'han separat.",
      intro: {
        what: "git merge porta la feina d'una altra branca a la branca on ets.",
        how: [
          "Si la teva branca no s'ha mogut des que l'altra se'n va separar, no hi ha res a combinar.",
          "Git simplement fa lliscar la teva branca fins a l'últim commit de l'altra. Això és un fast-forward.",
          "No es crea cap commit nou, així que l'historial continua sent una línia recta.",
        ],
        task: "Ets a main. Fusiona feature per donar a la gallina el seu barret blau.",
      },
      description: "main no s'ha separat, així que fusiona la branca feature movent main directament al seu commit.",
      objectives: ["Fusiona feature a main.", "Mantén l'historial lineal amb un fast-forward."],
      hints: ["Des de main, executa git merge feature."],
    },
    "basics-04-ff-only-merge": {
      title: "Exigeix un fast-forward",
      summary: "Exigeix una actualització lineal i rebutja historials separats.",
      intro: {
        what: "--ff-only diu a git merge: fes un fast-forward si pots i, si no, no facis res.",
        how: [
          "Quan el fast-forward és possible, funciona exactament com un merge normal.",
          "Quan les branques s'han separat, Git s'hi nega en lloc de crear un commit de merge.",
          "Els equips el fan servir per mantenir l'historial lineal i evitar commits de merge inesperats.",
        ],
        task: "Avança main fins a feature amb git merge --ff-only feature.",
      },
      description: "Actualitza main només si Git pot mantenir l'historial lineal sense crear un commit de merge.",
      objectives: ["Avança main fins a feature amb un fast-forward.", "Fes servir l'opció de seguretat --ff-only."],
      hints: ["Afegeix --ff-only entre merge i el nom de la branca."],
    },
    "basics-05-three-way-merge": {
      title: "Fusiona feina separada",
      summary: "Combina canvis independents després que les branques se separin.",
      intro: {
        what: "Quan les dues branques tenen commits nous, Git no es pot limitar a avançar. Crea un commit de merge que uneix les dues línies de feina.",
        how: [
          "Git busca l'avantpassat comú, el commit on es van separar les branques.",
          "Combina el que ha canviat a cada costat des d'aquell punt.",
          "El resultat és un commit de merge nou amb dos pares, un de cada branca.",
          "Si els dos costats canvien el mateix, hi ha un conflicte. Aquí els conflictes no estan suportats.",
        ],
        task: "main va afegir un barret i feature una bufanda. Fusiona feature a main per quedar-te amb tots dos.",
      },
      description: "main va afegir un barret i feature una bufanda. Combina els dos canvis independents en un commit de merge.",
      objectives: ["Inspecciona les dues branques.", "Fusiona feature a main sense perdre cap dels canvis."],
      hints: [
        "Fes servir git log --all per veure les dues línies de feina.",
        "Els canvis toquen propietats diferents, així que es poden fusionar sense problemes.",
      ],
    },
    "basics-06-cherry-pick": {
      title: "Copia un sol commit",
      summary: "Copia un commit concret a la branca actual.",
      intro: {
        what: "git cherry-pick copia un commit de qualsevol part del graf a la teva branca actual.",
        how: [
          "Dona-li l'ID d'un commit, com c20. Cada targeta mostra el seu ID.",
          "Git aplica només el canvi d'aquell commit damunt de HEAD, com un commit nou.",
          "El commit original es queda on era, així que la seva branca no canvia.",
          "És útil quan necessites un canvi sense la resta de la branca.",
        ],
        task: "Copia el commit de la bufanda, c20, d'experiment a main.",
      },
      description: "Porta a main només el commit de la bufanda de la branca experiment.",
      objectives: ["Copia el commit c20 a main.", "Deixa la branca experiment sense canvis."],
      hints: ["Fes servir git cherry-pick seguit de l'ID del commit."],
    },
    "basics-07-revert": {
      title: "Desfés un canvi amb seguretat",
      summary: "Desfés un canvi amb un commit nou que conserva l'historial.",
      intro: {
        what: "git revert desfà un commit afegint-ne un de nou que fa exactament el contrari.",
        how: [
          "Dona-li l'ID del commit que vols desfer.",
          "Git calcula el canvi invers (posar-se les ulleres de sol passa a treure-se-les) i el desa en un commit.",
          "El commit original continua a l'historial, així que no es reescriu res.",
          "Per això revert és segur en branques que comparteix més gent.",
        ],
        task: "Treu-li les ulleres de sol fent revert del commit b20.",
      },
      description: "Elimina les ulleres de sol que sobren creant un commit nou que inverteix el canvi original.",
      objectives: ["Desfés el commit b20 sense reescriure l'historial.", "Conserva tant el commit original com el que el desfà."],
      hints: ["Fes servir git revert seguit de l'ID del commit per crear un commit que el desfaci amb seguretat."],
    },
    "basics-08-rebase": {
      title: "Reaplica la feina sobre una base nova",
      summary: "Reconstrueix una branca damunt d'una altra.",
      intro: {
        what: "git rebase mou la teva branca perquè comenci a la punta d'una altra branca, com si haguessis començat a treballar-hi allà.",
        how: [
          "Git aparta els commits que només són a la teva branca.",
          "Mou la teva branca a la punta de la branca que indiques.",
          "Després torna a aplicar els teus commits a sobre, un a un, com a commits nous.",
          "L'historial queda en línia recta, sense commit de merge, i l'altra branca no es mou.",
        ],
        task: "Ets a feature. Fes rebase sobre main perquè tingui el barret i la bufanda.",
      },
      description: "main va aconseguir un barret blau després que comencés feature. Reaplica el commit de la bufanda de feature damunt de main perquè feature tingui totes dues coses, sense commit de merge.",
      objectives: [
        "Fes rebase de feature sobre main.",
        "Deixa main sense canvis.",
        "Acaba a feature amb el barret i la bufanda.",
      ],
      hints: [
        "Ja ets a feature. Rebase rep la branca sobre la qual construir.",
        "Executa git rebase main.",
      ],
    },
    "basics-09-interactive-rebase": {
      title: "Combina commits relacionats",
      summary: "Fes servir pick i squash per endreçar un historial curt.",
      intro: {
        what: "El rebase interactiu et deixa editar la llista de commits abans que Git els torni a aplicar.",
        how: [
          "git rebase -i <branch> obre una llista amb els commits de la teva branca, del més antic al més nou.",
          "pick manté un commit tal com és.",
          "squash fon un commit amb el de sobre, així els seus canvis passen a ser un sol commit.",
          "Després Git aplica la llista i deixa un historial més endreçat.",
        ],
        task: "Executa git rebase -i main, deixa c31 com a pick i fes squash de c32 a dins.",
      },
      description: "feature va dibuixar el contorn d'una cresta i després la va pintar de vermell. Ajunta els dos passos en un sol commit endreçat amb squash.",
      objectives: [
        "Comença un rebase interactiu sobre main.",
        "Fes pick de c31 i squash de c32 a dins.",
        "Acaba a feature amb una cresta vermella.",
      ],
      hints: [
        "Executa git rebase -i main per obrir la llista.",
        "Deixa el primer commit com a pick i canvia el segon a squash.",
      ],
    },
    "basics-10-capstone": {
      title: "Projecte final de Git Basics",
      summary: "Resol un puzzle de diverses ordres amb tot el que has après al curs.",
      intro: {
        what: "Hora d'ajuntar-ho tot. No hi ha una única resposta correcta: qualsevol combinació d'ordres que arribi a l'objectiu és bona.",
        how: [
          "Comença amb git log --all per explorar totes les branques.",
          "revert elimina un canvi no desitjat amb seguretat.",
          "merge (o rebase) porta una branca sencera.",
          "cherry-pick agafa un sol commit.",
        ],
        task: "A main: desfés les ulleres de sol, porta el barret blau de feature i copia només la bufanda d'experiment.",
      },
      description: "main té unes ulleres de sol que sobren. Desfés-les amb seguretat, porta el barret blau de feature i agafa només la bufanda d'experiment, no el seu esbós de cresta.",
      objectives: [
        "Desfés b20 sense reescriure main.",
        "Porta a main el barret blau de feature.",
        "Copia només el commit de la bufanda d'experiment.",
        "Acaba a main.",
      ],
      hints: [
        "Fes servir git log --all per veure totes les branques.",
        "Revert treu les ulleres de sol amb un commit nou.",
        "Qualsevol ordre és bo: porta el barret amb merge o rebase i fes cherry-pick només de x21.",
      ],
    },
  },
};

/** The lesson with its texts in `locale`. Identity, repositories, and targets never change. */
export function localizeLesson<T extends LearnBasicsLesson>(lesson: T, locale: Locale): T {
  if (locale === "en") return lesson;
  const text = LESSON_TEXT[locale][lesson.id];
  const localized = { ...lesson, title: text.title, summary: text.summary, intro: text.intro };
  if (lesson.status !== "available") return localized;
  return {
    ...localized,
    puzzle: {
      ...lesson.puzzle,
      title: text.title,
      description: text.description,
      objectives: text.objectives,
      hints: text.hints,
    },
  };
}
