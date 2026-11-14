// Global styles are now static (top of src/css/tailwind.css), so the old
// createGlobalStyle component is a no-op that just renders its children.
// `theme`/`theme2` are kept as plain objects for import compatibility.
import React from "react";

export const GlobalStyle: React.FC<{ children?: React.ReactNode; [k: string]: any }> = ({
  children,
}) => <>{children}</>;

export const theme = { colors: { primary: "#0070f3" } };
export const theme2 = { colors: { primary: "black" } };
