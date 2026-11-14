// Plain component classes; visuals in src/css/tailwind.css.
// `NavLink` keeps the original `$active` prop (toggles .nav-link--active).
import React from "react";
import { stx } from "../stx";

export const Container = stx("header", "header-container");
export const Brand = stx("div", "brand");
export const LogoWrapper = stx("div", "logo");
export const Nav = stx("nav", "nav");

export const NavLink: React.FC<{ $active?: boolean; className?: string; children?: React.ReactNode; [k: string]: any }> = ({
  $active,
  className,
  children,
  ...rest
}) => {
  const cn = ["nav-link", $active ? "nav-link--active" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div {...rest} className={cn}>
      {children}
    </div>
  );
};
