import type { CSSProperties } from "react";
import accountCircle from "../../assets/icons/account_circle.svg";
import add2 from "../../assets/icons/add_2.svg";
import arrowBackIosNew from "../../assets/icons/arrow_back_ios_new.svg";
import arrowForwardIos from "../../assets/icons/arrow_forward_ios.svg";
import close from "../../assets/icons/close.svg";
import crown from "../../assets/icons/crown.svg";
import extension from "../../assets/icons/extension.svg";
import flag2 from "../../assets/icons/flag_2.svg";
import help from "../../assets/icons/help.svg";
import home from "../../assets/icons/home.svg";
import importContacts from "../../assets/icons/import_contacts.svg";
import remove from "../../assets/icons/remove.svg";

/** Google Material Symbols, Outlined, weight 300, 24px. */
const ICONS = {
  account_circle: accountCircle,
  add_2: add2,
  arrow_back_ios_new: arrowBackIosNew,
  arrow_forward_ios: arrowForwardIos,
  close,
  crown,
  extension,
  flag_2: flag2,
  help,
  home,
  import_contacts: importContacts,
  remove,
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders a Material Symbol as a mask so it takes `currentColor` from text
 * utilities while the SVG files stay exactly as Google ships them.
 */
export function Icon({ name, size = 24, className = "", style }: IconProps) {
  const url = `url("${ICONS[name]}")`;
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        width: size,
        height: size,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        ...style,
      }}
    />
  );
}
