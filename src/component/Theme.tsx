// Theme wrapper: styled-components' ThemeProvider is gone. Global styles are
// static (src/css/tailwind.css -> public/js/client.css, linked in <head>), so
// the wrapper just passes children through; GlobalStyle stays a no-op mount.
import React from "react";
import { GlobalStyle } from "@styled/common";

interface ThemeProps {
  children: React.ReactNode
}

const Theme = ({ children }: ThemeProps) => {
  return (
    <>
      <GlobalStyle />
      {children}
    </>
  )
}

export default Theme
