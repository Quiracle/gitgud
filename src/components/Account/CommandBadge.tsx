import { Icon } from "../Icon/Icon";

/** The `</>` badge: grey while locked, lime on near-black once learned. Same size as the chickens. */
export function CommandBadge({ unlocked, size = 48 }: { unlocked: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded ${
        unlocked ? "bg-grey-900 text-lime-400" : "bg-grey-100 text-grey-500"
      }`}
      style={{ width: size, height: size }}
    >
      <Icon name="code_xml" size={Math.round(size * 0.75)} />
    </span>
  );
}
