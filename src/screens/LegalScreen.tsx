import { motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { Icon } from "../components/Icon/Icon";
import { SiteFooter } from "../components/Layout/SiteFooter";
import { useI18n } from "../i18n/I18nProvider";
import { LEGAL, LEGAL_UPDATED_ON, type LegalBlock, type LegalSectionId } from "../i18n/legal";
import { Rich } from "../i18n/Rich";
import { spring } from "../lib/motion";

interface LegalScreenProps {
  onNavigate: (path: string) => void;
}

const LINK = "text-green-800 underline decoration-from-font underline-offset-2 transition-colors hover:text-lime-700";

/** Only these tags in the legal text become elements, so translations can't inject markup. */
const TAGS = {
  b: ({ children }: { children: ReactNode }) => <strong className="font-normal text-grey-950">{children}</strong>,
  mail: ({ children }: { children: ReactNode }) => (
    <a className={LINK} href={`mailto:${String(children)}`}>
      {children}
    </a>
  ),
  url: ({ children }: { children: ReactNode }) => (
    <a className={`${LINK} break-all`} href={String(children)} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

/** Privacy policy, cookies, terms, AI disclosure, and the LSSI-CE legal notice on one page. */
export function LegalScreen({ onNavigate }: LegalScreenProps) {
  const { locale, t, formatDate } = useI18n();
  const legal = LEGAL[locale];

  // Shared links such as /legal#privacy land on their section.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  function jump(id: LegalSectionId) {
    window.history.replaceState(window.history.state, "", `#${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  function back() {
    if (window.history.length > 1) window.history.back();
    else onNavigate("/");
  }

  return (
    <div className="min-h-dvh bg-green-50">
      <section className="bg-green-950 px-6 pb-6 pt-[calc(24px+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <button
            type="button"
            onClick={back}
            aria-label={t("legal.back")}
            className="-ml-3 flex size-11 items-center justify-center rounded text-grey-50 transition-colors hover:bg-grey-50/10"
          >
            <Icon name="arrow_back_ios_new" size={20} />
          </button>
          <motion.div
            className="flex flex-col gap-1"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.soft}
          >
            <h1 className="text-3xl text-grey-50">{legal.title}</h1>
            <p className="text-xs leading-[15px] text-grey-300">
              {legal.updated.replace("{date}", formatDate(`${LEGAL_UPDATED_ON}T00:00:00Z`, { dateStyle: "long", timeZone: "UTC" }))}
            </p>
          </motion.div>
          <motion.nav
            aria-label={legal.jumpTo}
            className="flex flex-wrap gap-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.soft, delay: 0.06 }}
          >
            {legal.sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  jump(section.id);
                }}
                className="flex min-h-11 items-center rounded border border-grey-700 px-3 text-sm text-grey-50 transition-colors hover:border-lime-400 hover:bg-lime-400/10"
              >
                {section.chip}
              </a>
            ))}
          </motion.nav>
        </div>
      </section>

      <div className="px-6 py-6">
        <div className="mx-auto flex max-w-md flex-col gap-10">
          {legal.sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="flex scroll-mt-6 flex-col gap-3">
              <h2 id={`${section.id}-title`} className="text-2xl leading-8 text-green-950">
                {section.title}
              </h2>
              {section.blocks.map((block, index) => (
                <Block key={index} block={block} />
              ))}
            </section>
          ))}
        </div>
      </div>

      <SiteFooter onNavigate={onNavigate} />
    </div>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "h3":
      return <h3 className="mt-3 text-xl leading-[25px] text-green-950">{block.text}</h3>;
    case "p":
      return (
        <p className="text-paragraph text-grey-800">
          <Rich text={block.text} tags={TAGS} />
        </p>
      );
    case "list":
      return (
        <ul className="flex flex-col gap-2 pl-5 text-paragraph text-grey-800 marker:text-lime-600 [list-style:square]">
          {block.items.map((item) => (
            <li key={item}>
              <Rich text={item} tags={TAGS} />
            </li>
          ))}
        </ul>
      );
    case "table":
      // A four-column table can't fit a phone, so each row becomes a labelled card.
      return (
        <ul className="flex flex-col gap-2">
          {block.rows.map(([title, ...cells]) => (
            <li key={title} className="flex flex-col gap-2 rounded border border-grey-300 bg-grey-300 p-3">
              <p className={block.code ? "break-all font-secondary text-code text-grey-950" : "text-paragraph text-grey-950"}>{title}</p>
              <dl className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-1">
                {cells.map((cell, index) => (
                  <div key={block.head[index + 1]} className="contents">
                    <dt className="text-xs leading-[15px] text-grey-700">{block.head[index + 1]}</dt>
                    <dd className="text-sm text-grey-950">{cell}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      );
  }
}
