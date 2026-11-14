// Plain component classes (Tailwind pipeline). Visuals live verbatim in
// src/css/tailwind.css; each export renders the original intrinsic tag with a
// fixed class name and forwards all props (className/style/children/...).
// Export names + tags are unchanged from the styled-components version so
// Home.tsx needs no edits.
import React from "react";
import { stx } from "./stx";

// The old styled GlobalStyle is a no-op now: its global rules (reset, body
// gradient, page-loader, fade-in, link defaults) live at the top of
// tailwind.css and are always on.
export const GlobalStyle: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => <>{children}</>;

export const PageWrapper = stx("div", "page-wrapper");

// Hero
export const HeroSection = stx("section", "hero-section");
export const HeroContent = stx("div", "hero-content");
export const HeroTitle = stx("h1", "hero-title");
export const HeroSubtitle = stx("p", "hero-subtitle");
export const HeroBadge = stx("span", "hero-badge");
export const HeroStats = stx("div", "hero-stats");
export const StatCard = stx("div", "stat-card");
export const StatValue = stx("div", "stat-value");
export const StatLabel = stx("div", "stat-label");

// 技术特性
export const TechSection = stx("section", "tech-section");
export const SectionHeader = stx("div", "section-header");
export const SectionTitle = stx("h2", "section-title");
export const SectionDescription = stx("p", "section-desc");
export const FeatureGrid = stx("div", "feature-grid");
export const FeatureCard = stx("div", "feature-card");
export const CardIcon = stx("div", "card-icon");
export const CardTitle = stx("h3", "card-title");
export const CardDescription = stx("p", "card-desc");
export const CodeExample = stx("pre", "code-example");

// 对比表格
export const ComparisonSection = stx("section", "comparison-section");
export const ComparisonTable = stx("table", "comparison-table");
export const TableHeader = stx("thead", "table-header");
export const TableRow = stx("tr", "table-row");
export const TableCell = stx("td", "table-cell");
export const TableHeaderCell = stx("th", "table-header-cell");
export const NsbpJSBadge = stx("span", "nsbp-js-badge");
export const NextJSBadge = stx("span", "next-js-badge");

// Photo Menu
export const PhotoSection = stx("section", "photo-section");
export const PhotoGrid = stx("ul", "photo-grid");
export const PhotoCard = stx("li", "photo-card");
export const PhotoImageWrapper = stx("div", "photo-image-wrapper");
export const PhotoImage = stx("img", "photo-image");
export const PhotoName = stx("div", "photo-name");
export const PhotoTitle = stx("h3", "photo-title");
export const PhotoCount = stx("span", "photo-count");

// 加载 / 错误
export const LoadingContainer = stx("div", "loading-container");
export const LoadingSpinner = stx("div", "loading-spinner");
export const LoadingText = stx("span", "loading-text");
export const ErrorContainer = stx("div", "error-container");
export const ErrorTitle = stx("h3", "error-title");
export const ErrorMessage = stx("p", "error-msg");

// 快速开始
export const QuickStartSection = stx("section", "quick-start-section");
export const QuickStartGrid = stx("div", "quick-start-grid");
export const QuickStartCard = stx("div", "quick-start-card");
export const QuickStartTitle = stx("h3", "quick-start-title");
export const QuickStartCode = stx("pre", "quick-start-code");
export const QuickStartDescription = stx("p", "quick-start-desc");

// Demo 按钮
export const DemoButtonLink = stx("a", "demo-button");
export const DemoButtonIcon = stx("span", "demo-button-icon");

// Footer
export const Footer = stx("footer", "nsbp-footer");
