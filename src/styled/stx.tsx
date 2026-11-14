// Plain-component factory that replaces the `styled.xxx` primitives of
// styled-components. `stx(tag, className)` returns a component that renders
// the given intrinsic tag with a fixed className (+ the consumer's className),
// forwarding every other prop (style, onClick, href, children, ...).
//
// All custom visuals live verbatim in src/css/tailwind.css (Tailwind pipeline);
// this factory only keeps the original component API so consumers (Home /
// Photo / Header / Layout) stay unchanged.
import React from "react";

export const stx = (tag: keyof React.JSX.IntrinsicElements, cls?: string) => {
  const Comp: React.FC<any> = (props) => {
    const { className, children, ...rest } = props;
    const cn = [cls, className].filter(Boolean).join(" ");
    const P = tag as any;
    return (
      <P {...rest} className={cn}>
        {children}
      </P>
    );
  };
  Comp.displayName = "stx(" + String(tag) + ")";
  return Comp;
};
