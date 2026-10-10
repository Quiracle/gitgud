import { LEGAL_DOMAIN, LEGAL_EMAIL, LEGAL_OWNER, LEGAL_REPOSITORY, type LegalDocument } from "./types";

export const es: LegalDocument = {
  title: "Legal",
  updated: "Última actualización: {date}",
  jumpTo: "Ir a la sección",
  sections: [
    {
      id: "privacy",
      chip: "Privacidad",
      title: "Política de privacidad",
      blocks: [
        { kind: "h3", text: "Responsable del tratamiento" },
        {
          kind: "p",
          text: `GitGud (${LEGAL_DOMAIN}) lo gestiona ${LEGAL_OWNER}, con residencia en España, que es la responsable del tratamiento de tus datos personales según el Reglamento General de Protección de Datos (RGPD) y la Ley Orgánica de Protección de Datos (LOPDGDD). Para cualquier cuestión sobre tus datos, escribe a <mail>${LEGAL_EMAIL}</mail>.`,
        },
        { kind: "h3", text: "Juega sin cuenta" },
        {
          kind: "p",
          text: "Puedes jugar a todos los puzles como invitado. El progreso, los intentos y los ajustes de invitado se guardan en el almacenamiento de tu navegador, en tu dispositivo, y no nos llegan.",
        },
        { kind: "h3", text: "Qué datos recogemos y para qué" },
        {
          kind: "table",
          head: ["Datos", "Finalidad", "Base legal", "Conservación"],
          rows: [
            [
              "Correo, nombre, avatar e ID de cuenta de Google o GitHub",
              "Crear tu cuenta e iniciar sesión",
              "Prestarte el servicio que pides (art. 6.1.b RGPD)",
              "Hasta que elimines tu cuenta",
            ],
            [
              "Nombre y avatar de la clasificación",
              "Mostrarte en la clasificación diaria",
              "Prestarte el servicio (art. 6.1.b)",
              "Hasta que lo cambies o elimines tu cuenta",
            ],
            [
              "Intentos de puzles: tiempo, reinicios, órdenes, pistas y fechas",
              "Sincronizar tu progreso, clasificarte y contar rachas y logros",
              "Prestarte el servicio (art. 6.1.b)",
              "Hasta que elimines tu cuenta",
            ],
            [
              "Lo que escribes en la práctica con IA (hasta 200 caracteres) y el puzle creado",
              "Generar tu puzle de práctica y limitar la frecuencia de uso",
              "Prestarte el servicio (art. 6.1.b)",
              "Hasta que elimines tu cuenta",
            ],
            [
              "ID de miembro y nombre de LinkedIn, un token de acceso cifrado y un registro de las publicaciones hechas desde GitGud",
              "Publicar un resultado en LinkedIn cuando lo confirmas",
              "Tu consentimiento (art. 6.1.a), que retiras al desconectar LinkedIn",
              "Hasta que desconectes, caduque el token o elimines tu cuenta",
            ],
            [
              "Dirección IP y datos del navegador en los registros técnicos de nuestros proveedores",
              "Mantener el servicio en funcionamiento y seguro",
              "Interés legítimo (art. 6.1.f)",
              "Los plazos breves que fijan nuestros proveedores",
            ],
          ],
        },
        {
          kind: "p",
          text: "No vendemos tus datos, no mostramos anuncios, no usamos analítica ni seguimiento y no tomamos decisiones automatizadas con efectos jurídicos o igualmente significativos sobre ti.",
        },
        { kind: "h3", text: "Qué ven otros jugadores" },
        {
          kind: "p",
          text: "La clasificación diaria es pública. Muestra tu nombre de clasificación, avatar, posición, tiempo y reinicios. Nunca muestra tu correo. Puedes elegir otro nombre de clasificación en los ajustes de tu cuenta.",
        },
        { kind: "h3", text: "Quién nos ayuda a ofrecer GitGud" },
        {
          kind: "list",
          items: [
            "<b>Supabase</b>: base de datos, inicio de sesión y funciones de servidor.",
            "<b>Vercel</b>: aloja la web.",
            "<b>OpenAI</b>: genera los puzles. Solo recibe el texto de tu práctica, nunca tu nombre ni tu correo.",
            "<b>Google y GitHub</b>: gestionan el inicio de sesión según sus propias políticas de privacidad.",
            "<b>LinkedIn</b>: solo si lo conectas, según su propia política de privacidad.",
          ],
        },
        {
          kind: "p",
          text: "Algunas de estas empresas están en Estados Unidos. Las transferencias se amparan en el Marco de Privacidad de Datos UE-EE. UU. o en las cláusulas contractuales tipo de la Comisión Europea.",
        },
        { kind: "h3", text: "Tus derechos" },
        {
          kind: "p",
          text: `Puedes pedir acceder a tus datos, rectificarlos, suprimirlos o llevártelos, limitar u oponerte a su tratamiento y retirar cualquier consentimiento que hayas dado. Escribe a <mail>${LEGAL_EMAIL}</mail> desde el correo de tu cuenta; respondemos en un plazo de un mes. Mientras no esté disponible la eliminación de la cuenta desde la app, escríbenos y eliminaremos tu cuenta y tus datos en un plazo de 30 días. Si no estás de acuerdo con nuestra respuesta, puedes reclamar ante la Agencia Española de Protección de Datos (AEPD) en <url>https://www.aepd.es</url>.`,
        },
        { kind: "h3", text: "Edad mínima" },
        {
          kind: "p",
          text: "Debes tener al menos 14 años para crear una cuenta. Los menores pueden jugar como invitados o crear una cuenta con el consentimiento de su madre, padre o tutor.",
        },
        { kind: "h3", text: "Seguridad" },
        {
          kind: "p",
          text: "Las conexiones usan HTTPS. Las reglas de la base de datos solo permiten a cada jugador leer y cambiar sus propios registros, y los tokens de LinkedIn se guardan cifrados.",
        },
        { kind: "h3", text: "Cambios" },
        {
          kind: "p",
          text: "Cuando esta página cambie, actualizaremos la fecha de arriba. Te avisaremos en la app de los cambios importantes.",
        },
      ],
    },
    {
      id: "cookies",
      chip: "Cookies",
      title: "Cookies y almacenamiento local",
      blocks: [
        {
          kind: "p",
          text: "GitGud no usa cookies publicitarias, de analítica ni de seguimiento. Guarda en el almacenamiento de tu navegador unos pocos elementos que el juego necesita para funcionar, por lo que no requieren consentimiento:",
        },
        {
          kind: "table",
          code: true,
          head: ["Elemento", "Finalidad", "Conservación"],
          rows: [
            ["gitgud:progress:v1", "Tu progreso, intentos y mejores tiempos", "Hasta que lo borres"],
            ["gitgud:daily:v1:…", "Copias de los puzles diarios para jugar sin conexión", "Hasta que lo borres"],
            ["gitgud:guided-lessons:v1", "Tus puzles de práctica con IA recientes", "Hasta que lo borres"],
            ["gitgud:auth:v1", "Mantiene tu sesión iniciada", "Hasta que cierres sesión"],
            ["gitgud:locale:v1", "El idioma que has elegido", "Hasta que lo borres"],
            ["gitgud:welcome-seen:v1", "Recuerda que ya has visto la bienvenida", "Hasta que lo borres"],
            ["gitgud:guided-goal-draft:v1, gitgud:linkedin:resume-share", "Guarda un objetivo de práctica o una publicación de LinkedIn sin enviar mientras no estás", "Hasta que cierres la pestaña"],
          ],
        },
        {
          kind: "p",
          text: "Puedes borrarlos cuando quieras desde los ajustes del sitio de tu navegador. Si juegas como invitado, al borrarlos pierdes tu progreso.",
        },
      ],
    },
    {
      id: "terms",
      chip: "Condiciones",
      title: "Condiciones de uso",
      blocks: [
        {
          kind: "p",
          text: "Al usar GitGud aceptas estas condiciones. GitGud es un juego gratuito para aprender Git.",
        },
        { kind: "h3", text: "Juego limpio" },
        {
          kind: "list",
          items: [
            "No manipules el juego, las puntuaciones ni la clasificación, ni envíes resultados de forma automatizada.",
            "No hagas un mal uso de la práctica con IA, no intentes que genere contenido dañino ni la sobrecargues.",
            "Elige un nombre de clasificación que no sea ofensivo, engañoso ni de otra persona.",
          ],
        },
        {
          kind: "p",
          text: "Podemos retirar entradas o nombres de la clasificación, o suspender cuentas, que incumplan estas normas. Las puntuaciones se calculan en tu navegador, así que la clasificación es un juego, no un ranking oficial.",
        },
        { kind: "h3", text: "El servicio" },
        {
          kind: "p",
          text: "GitGud se ofrece tal cual, sin garantía de que esté siempre disponible o libre de errores. Podemos cambiar, pausar o retirar funciones. GitGud simula Git; no es un cliente de Git real, así que no lo uses para tomar decisiones sobre repositorios reales.",
        },
        { kind: "h3", text: "Propiedad intelectual" },
        {
          kind: "p",
          text: `El código fuente de GitGud es software libre bajo la Licencia Pública General de GNU v3 en <url>${LEGAL_REPOSITORY}</url>. Git y el logotipo de Git son marcas de Software Freedom Conservancy; GitGud no está afiliado al proyecto Git ni cuenta con su respaldo. Google, GitHub y LinkedIn son marcas de sus respectivos titulares.`,
        },
        { kind: "h3", text: "Responsabilidad y ley aplicable" },
        {
          kind: "p",
          text: "En la medida en que la ley lo permita, no respondemos de pérdidas indirectas ni de progreso perdido por usar GitGud. Nada de lo aquí dispuesto limita tus derechos como consumidor. Estas condiciones se rigen por la ley española; si eres consumidor, también puedes acudir a los tribunales de tu domicilio.",
        },
      ],
    },
    {
      id: "ai",
      chip: "IA",
      title: "Contenido generado con IA",
      blocks: [
        {
          kind: "p",
          text: "La mayoría de los puzles diarios y todos los puzles de práctica con IA los genera un modelo de IA de OpenAI. Antes de que los veas, el simulador de GitGud comprueba que se pueden resolver. El curso Aprende lo básico lo escriben personas.",
        },
        {
          kind: "p",
          text: `Las historias, pistas y mensajes de commit escritos por la IA pueden contener errores. Si ves algo incorrecto o inapropiado, avísanos en <mail>${LEGAL_EMAIL}</mail>.`,
        },
        {
          kind: "p",
          text: "Los puzles diarios se generan sin datos de ningún jugador. En la práctica con IA, solo se envía a OpenAI el texto que escribes, así que no incluyas información personal. Según las condiciones de la API de OpenAI, no se usa para entrenar sus modelos.",
        },
      ],
    },
    {
      id: "notice",
      chip: "Aviso legal",
      title: "Aviso legal",
      blocks: [
        {
          kind: "p",
          text: "Información exigida por la Ley de Servicios de la Sociedad de la Información (LSSI-CE, Ley 34/2002):",
        },
        {
          kind: "list",
          items: [
            `<b>Titular</b>: ${LEGAL_OWNER}`,
            `<b>Sitio web</b>: ${LEGAL_DOMAIN}`,
            `<b>Correo</b>: <mail>${LEGAL_EMAIL}</mail>`,
            "<b>País</b>: España",
            "<b>Actividad</b>: juego educativo gratuito y sin ánimo de lucro",
          ],
        },
      ],
    },
  ],
};
