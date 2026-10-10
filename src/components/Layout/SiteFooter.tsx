/** Figma footer (node 24:44218). */
export function SiteFooter() {
  return (
    <footer className="border-t border-grey-500 px-6 pb-[var(--nav-clearance)] pt-4">
      <div className="mx-auto flex max-w-md items-start justify-between">
        <p className="text-paragraph text-grey-950">Gitgudgame.lol</p>
        <p className="text-xs text-grey-600">Privacy policy</p>
      </div>
    </footer>
  );
}

/** Grey card from Figma; hover darkens the fill only, so the card never changes size. */
export const CARD_SURFACE =
  "rounded border border-grey-300 bg-grey-300 transition-colors duration-200 hover:border-card-hover hover:bg-card-hover";
