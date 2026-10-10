import type { CSSProperties } from "react";
import accountCircle from "../../assets/icons/account_circle.svg";
import accountCircleFill from "../../assets/icons/account_circle_fill.svg";
import add2 from "../../assets/icons/add_2.svg";
import arrowBackIosNew from "../../assets/icons/arrow_back_ios_new.svg";
import arrowForwardIos from "../../assets/icons/arrow_forward_ios.svg";
import github from "../../assets/brand/github.png";
import google from "../../assets/brand/google.svg";
import check from "../../assets/icons/check.svg";
import close from "../../assets/icons/close.svg";
import contentCopy from "../../assets/icons/content_copy.svg";
import crown from "../../assets/icons/crown.svg";
import download from "../../assets/icons/download.svg";
import extension from "../../assets/icons/extension.svg";
import flag2 from "../../assets/icons/flag_2.svg";
import forwardMedia from "../../assets/icons/forward_media.svg";
import help from "../../assets/icons/help.svg";
import home from "../../assets/icons/home.svg";
import importContacts from "../../assets/icons/import_contacts.svg";
import lightbulb2 from "../../assets/icons/lightbulb_2.svg";
import myLocation from "../../assets/icons/my_location.svg";
import openInNew from "../../assets/icons/open_in_new.svg";
import remove from "../../assets/icons/remove.svg";
import share from "../../assets/icons/share.svg";

/** Google Material Symbols, Outlined, weight 300, 24px, plus sign-in brand marks from Figma. */
const ICONS = {
  account_circle: accountCircle,
  account_circle_fill: accountCircleFill,
  add_2: add2,
  arrow_back_ios_new: arrowBackIosNew,
  arrow_forward_ios: arrowForwardIos,
  check,
  close,
  content_copy: contentCopy,
  crown,
  download,
  extension,
  flag_2: flag2,
  github,
  google,
  forward_media: forwardMedia,
  help,
  home,
  import_contacts: importContacts,
  lightbulb_2: lightbulb2,
  my_location: myLocation,
  open_in_new: openInNew,
  remove,
  share,
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  /** Pixel size; null leaves sizing to `className` (for responsive sizes). */
  size?: number | null;
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
        ...(size === null ? {} : { width: size, height: size }),
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
