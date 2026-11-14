import React, { useEffect, useState, Suspense } from 'react'
import { Link } from 'react-router-dom'
import Layout from '@components/Layout'
import { Helmet } from 'react-helmet'
import { isSEO, usePreserveSSR } from '@/utils'
import { usePhotoMenu } from '@services/suspense'
import {
  GlobalStyle,
  PageWrapper,
  HeroSection,
  HeroContent,
  HeroTitle,
  HeroSubtitle,
  HeroBadge,
  HeroStats,
  StatCard,
  StatValue,
  StatLabel,
  TechSection,
  SectionHeader,
  SectionTitle,
  SectionDescription,
  FeatureGrid,
  FeatureCard,
  CardIcon,
  CardTitle,
  CardDescription,
  CodeExample,
  ComparisonSection,
  ComparisonTable,
  TableHeader,
  TableRow,
  TableCell,
  TableHeaderCell,
  NsbpJSBadge,
  NextJSBadge,
  PhotoSection,
  PhotoGrid,
  PhotoCard,
  PhotoImageWrapper,
  PhotoImage,
  PhotoName,
  PhotoTitle,
  PhotoCount,
  LoadingContainer,
  LoadingSpinner,
  LoadingText,
  ErrorContainer,
  ErrorTitle,
  ErrorMessage,
  QuickStartSection,
  QuickStartGrid,
  QuickStartCard,
  QuickStartTitle,
  QuickStartCode,
  QuickStartDescription,
  DemoButtonLink,
  DemoButtonIcon,
  Footer
} from '../styled/home'

interface PhotoMenuItem {
  name: string
  cover?: string
  count?: number
}

const Home: React.FC = () => {
  const { withSSR } = usePreserveSSR()

  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // 客户端模拟页面加载动画
    const timer = setTimeout(() => {
      setIsLoaded(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  // 客户端处理页面加载器的淡出和移除
  useEffect(() => {
    if (!isLoaded) return

    const removeLoader = () => {
      const loader = document.getElementById('pageLoader')
      if (loader) {
        loader.classList.add('fade-out')
        setTimeout(() => loader.remove(), 500)
      }
    }

    // 延迟移除加载器
    const removeTimer = setTimeout(removeLoader, 300)
    return () => clearTimeout(removeTimer)
  }, [isLoaded])

  return (
    <GlobalStyle>
      {!isLoaded && (
        <div className="page-loader" id="pageLoader">
          <div className="loader-spinner"></div>
        </div>
      )}
      <Helmet>
        <title>nsbp-lume · React SSR on Lume 引擎</title>
        <meta
          name="description"
          content="nsbp-lume - React 服务端渲染跑在 Lume 引擎（AgentHTTPD）上，经 FastCGI relay 到常驻 Node SSR，专为低资源部署而生。查看线上演示：https://nsbp.erishen.cn/"
        />
        <meta
          name="keywords"
          content="nsbp-lume, React SSR, Lume, AgentHTTPD, FastCGI, TypeScript, React 19"
        />
        <meta property="og:title" content="nsbp-lume · React SSR on Lume 引擎" />
        <meta
          property="og:description"
          content="nsbp-lume - React SSR 由 Lume 引擎做前端、Node 后端真渲染。查看线上演示：https://nsbp.erishen.cn/"
        />
        <meta property="og:url" content="https://nsbp.erishen.cn/" />
      </Helmet>

      <Layout query={{}}>
        <PageWrapper>
          {/* ========================================
              Hero Section - 首屏视觉冲击
              ======================================== */}
          <HeroSection className="fade-in">
            <HeroContent>
              <div className="hero-glow"></div>
              <div className="hero-glow"></div>
              <HeroBadge className="fade-in" style={{ animationDelay: '0.1s' }}>
                🚀 轻量级 React SSR 框架
              </HeroBadge>
              <HeroTitle className="fade-in" style={{ animationDelay: '0.2s' }}>
                nsbp-lume
              </HeroTitle>
              <HeroSubtitle
                className="fade-in"
                style={{ animationDelay: '0.3s' }}
              >
                专为低资源部署与高度可定制场景而生
                <br />
                由 Lume 引擎做前端，FastCGI relay 到 Node SSR
              </HeroSubtitle>

              <DemoButtonLink
                href="https://nsbp.erishen.cn/"
                target="_blank"
                rel="noopener noreferrer"
                className="fade-in"
                style={{ animationDelay: '0.4s' }}
              >
                <DemoButtonIcon>🌐</DemoButtonIcon>
                查看线上演示
              </DemoButtonLink>

              <HeroStats>
                <StatCard>
                  <StatValue>Light</StatValue>
                  <StatLabel>轻量高效</StatLabel>
                </StatCard>
                <StatCard>
                  <StatValue>Flex</StatValue>
                  <StatLabel>灵活配置</StatLabel>
                </StatCard>
                <StatCard>
                  <StatValue>TS</StatValue>
                  <StatLabel>类型安全</StatLabel>
                </StatCard>
                <StatCard>
                  <StatValue>SSR</StatValue>
                  <StatLabel>服务端渲染</StatLabel>
                </StatCard>
              </HeroStats>
            </HeroContent>
          </HeroSection>

          {/* ========================================
              技术特性展示
              ======================================== */}
          <TechSection className="fade-in" style={{ animationDelay: '0.4s' }}>
            <SectionHeader>
              <SectionTitle
                className="fade-in"
                style={{ animationDelay: '0.5s' }}
              >
                核心特性
              </SectionTitle>
              <SectionDescription
                className="fade-in"
                style={{ animationDelay: '0.6s' }}
              >
                基于 React 19 + TypeScript，提供完整的 SSR 能力同时保持极致轻量
              </SectionDescription>
            </SectionHeader>

            <FeatureGrid>
              <FeatureCard>
                <CardIcon>⚡</CardIcon>
                <CardTitle>极速服务端渲染</CardTitle>
                <CardDescription>
                  服务端渲染 HTML，SEO 友好，首屏秒开
                </CardDescription>
                <CodeExample>{`// 路由 + 服务端预取数据
// Routers.tsx
export default [
  {
    path: '/',
    element: <Home />,
    loadData: homeLoadData,
    key: 'home'
  }
]`}</CodeExample>
              </FeatureCard>

              <FeatureCard>
                <CardIcon>🔧</CardIcon>
                <CardTitle>Lume C 引擎做前端</CardTitle>
                <CardDescription>
                  内嵌 AgentHTTPD，DSL 配 server 路由与 relay
                </CardDescription>
                <CodeExample>{`// nsbp.lume
server {
  bind = "127.0.0.1";
  port = 10090;
  react_socket = "./.data/nsbp-ssr.sock";
  react_prefix = "/";
};`}</CodeExample>
              </FeatureCard>

              <FeatureCard>
                <CardIcon>📦</CardIcon>
                <CardTitle>FastCGI relay SSR</CardTitle>
                <CardDescription>
                  页面经 UNIX socket relay 给常驻 Node 后端渲染
                </CardDescription>
                <CodeExample>{`// Lume 把 /、/photo relay 到
// build/server-ssr.cjs（renderToString）
// 客户端 hydrateRoot 接管`}</CodeExample>
              </FeatureCard>

              <FeatureCard>
                <CardIcon>🧩</CardIcon>
                <CardTitle>React 19 原生支持</CardTitle>
                <CardDescription>
                  利用最新 React 特性，性能和开发体验提升
                </CardDescription>
                <CodeExample>{`// React 19 新特性
import { use, useTransition } from 'react'

// Server Actions
// Suspense 边界
// use Optimistic`}</CodeExample>
              </FeatureCard>

              <FeatureCard>
                <CardIcon>📝</CardIcon>
                <CardTitle>TypeScript 类型安全</CardTitle>
                <CardDescription>
                  完整的类型推断，编译时错误检查
                </CardDescription>
                <CodeExample>{`interface PhotoMenuItem {
  name: string
  cover?: string
  count?: number
}`}</CodeExample>
              </FeatureCard>

              <FeatureCard>
                <CardIcon>🖼️</CardIcon>
                <CardTitle>照片数据 + Lume 端点</CardTitle>
                <CardDescription>Node 出 /getPhotoMenu 与 /images，Lume 出 /api/health</CardDescription>
                <CodeExample>{`// Lume DSL 原生端点（保留前缀 /api）
get "/api/health", (req) => {
  return { ok: true, service: "nsbp-lume" };
};`}</CodeExample>
              </FeatureCard>
            </FeatureGrid>
          </TechSection>

          {/* ========================================
              框架对比说明
              ======================================== */}
          <ComparisonSection
            className="fade-in"
            style={{ animationDelay: '0.7s' }}
          >
            <SectionHeader>
              <SectionTitle
                className="fade-in"
                style={{ animationDelay: '0.8s' }}
              >
                框架特性对比
              </SectionTitle>
              <SectionDescription
                className="fade-in"
                style={{ animationDelay: '0.9s' }}
              >
                了解不同 SSR 框架的设计理念，帮助你选择合适的技术栈
              </SectionDescription>
            </SectionHeader>

            <ComparisonTable>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>特性</TableHeaderCell>
                  <TableHeaderCell>
                    <NsbpJSBadge>nsbp-lume</NsbpJSBadge>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <NextJSBadge>Next.js</NextJSBadge>
                  </TableHeaderCell>
                </TableRow>
              </TableHeader>
              <tbody>
                <TableRow>
                  <TableCell>
                    <strong>构建配置</strong>
                  </TableCell>
                  <TableCell>Lume DSL 声明式</TableCell>
                  <TableCell>框架自动化</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>代码分割</strong>
                  </TableCell>
                  <TableCell>esbuild 直出单包</TableCell>
                  <TableCell>自动分割</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>SSR 渲染</strong>
                  </TableCell>
                  <TableCell>Node + Lume 真渲染</TableCell>
                  <TableCell>自动处理</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>学习曲线</strong>
                  </TableCell>
                  <TableCell>需理解引擎 / relay</TableCell>
                  <TableCell>上手简单</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>适用场景</strong>
                  </TableCell>
                  <TableCell>个人项目、学习研究</TableCell>
                  <TableCell>企业应用、快速开发</TableCell>
                </TableRow>
              </tbody>
            </ComparisonTable>
            <p
              style={{
                marginTop: '16px',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.85)',
                textAlign: 'center'
              }}
            >
              注：以上对比基于设计理念的差异，实际使用请根据项目需求选择。Next.js
              是成熟的 SSR 框架，拥有强大的生态和官方支持。
            </p>
          </ComparisonSection>

          {/* ========================================
              快速开始
              ======================================== */}
          <QuickStartSection
            className="fade-in"
            style={{ animationDelay: '1.0s' }}
          >
            <SectionHeader>
              <SectionTitle
                className="fade-in"
                style={{ animationDelay: '1.1s' }}
              >
                快速开始
              </SectionTitle>
              <SectionDescription
                className="fade-in"
                style={{ animationDelay: '1.2s' }}
              >
                三步启动你的第一个 SSR 项目
              </SectionDescription>
            </SectionHeader>

            <QuickStartGrid>
              <QuickStartCard>
                <QuickStartTitle>1️⃣ 安装依赖</QuickStartTitle>
                <QuickStartCode>$ pnpm install && pnpm build</QuickStartCode>
                <QuickStartDescription>
                  装依赖并用 esbuild 打 SSR 后端 + 客户端
                </QuickStartDescription>
              </QuickStartCard>

              <QuickStartCard>
                <QuickStartTitle>2️⃣ 启动服务</QuickStartTitle>
                <QuickStartCode>$ make run</QuickStartCode>
                <QuickStartDescription>
                  起 Node SSR 后端 + Lume 前端，默认端口 10090
                </QuickStartDescription>
              </QuickStartCard>

              <QuickStartCard>
                <QuickStartTitle>3️⃣ 访问应用</QuickStartTitle>
                <QuickStartCode>http://127.0.0.1:10090</QuickStartCode>
                <QuickStartDescription>
                  浏览器访问，SSR 首屏秒开再水合
                </QuickStartDescription>
              </QuickStartCard>
            </QuickStartGrid>
          </QuickStartSection>

          {/* ========================================
              Photo Menu 示例
              ======================================== */}
          <PhotoSection className="fade-in" style={{ animationDelay: '1.3s' }}>
            <SectionHeader>
              <SectionTitle
                className="fade-in"
                style={{ animationDelay: '1.4s' }}
              >
                图片分类示例
              </SectionTitle>
              <SectionDescription
                className="fade-in"
                style={{ animationDelay: '1.5s' }}
              >
                由 Node SSR 后端出 /getPhotoMenu 与 /images，经 Lume relay，快速构建图库应用
              </SectionDescription>
            </SectionHeader>

            <Suspense fallback={
              <LoadingContainer>
                <LoadingSpinner />
                <LoadingText>加载分类...</LoadingText>
              </LoadingContainer>
            }>
              <SuspendedPhotoGrid withSSR={withSSR} />
            </Suspense>
          </PhotoSection>

          {/* ========================================
              Footer
              ======================================== */}
          <Footer>
            <p>© 2026 nsbp-lume · React 19 SSR + Lume 引擎（AgentHTTPD → FastCGI → Node）</p>
          </Footer>
        </PageWrapper>
      </Layout>
    </GlobalStyle>
  )
}

export default Home

// Suspense data boundary: the photo grid content. On the server the use()
// promise suspends (shell streams first, grid after); on the client with the
// preloaded store it resolves synchronously (no flash, markup matches).
function SuspendedPhotoGrid({ withSSR }: { withSSR: (u: string) => string }) {
  const menu = usePhotoMenu()
  if (menu.length === 0) {
    return (
      <ErrorContainer>
        <ErrorTitle>❌ 暂无分类</ErrorTitle>
        <ErrorMessage>请在 public/images 目录下创建图片文件夹</ErrorMessage>
      </ErrorContainer>
    )
  }
  return (
    <PhotoGrid>
      {menu.map((item) => (
        <Link key={item.name} to={withSSR(`/photo?dic=${item.name}`)}>
          <PhotoCard>
            <PhotoImageWrapper>
              <PhotoImage
                src={
                  item.cover ||
                  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
                }
                alt={item.name}
                loading="lazy"
              />
            </PhotoImageWrapper>
            <PhotoName>
              <PhotoTitle>{item.name}</PhotoTitle>
              {typeof item.count === 'number' && (
                <PhotoCount>{item.count} 张</PhotoCount>
              )}
            </PhotoName>
          </PhotoCard>
        </Link>
      ))}
    </PhotoGrid>
  )
}

