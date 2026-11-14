import React, { useState, useEffect } from 'react'
import { Container } from '@styled/component/layout'
import Loading from './Loading'

interface LayoutProps {
  children: React.ReactNode
  query?: { ssr?: string | number; nsbp?: string | number }
}

// 首屏呈现模式:
//   - 省略 或 ssr=1 (或旧 nsbp=1) → pageLoad 初值 1 → 直接展示 children
//     (真正的 SSR 默认, 首屏就是服务端渲染好的内容, 不闪 Loading)
//   - ssr=0 (或旧 nsbp=0)         → pageLoad 初值 0 → 先渲染 <Loading/>,
//     effect 翻 1 (显式"动画演示 / 客户端数据模式", 让 Photo 走 isSEO()===0
//     分支在客户端重新取数)
//
// 规范参数名是 ssr; 旧项目分享出去的 nsbp= 链接保持可读(query 里两个键都可能有,
// 优先 ssr)。默认值 1 对 hydration 安全: 服务端与客户端对同一份 query
// (SSR 注入的 window.context.state.query) 算出相同的初值。
const Layout = ({ children, query }: LayoutProps) => {
  const mode =
    query !== undefined && query !== null ? query.ssr ?? query.nsbp : undefined

  // 省略 = SSR 默认(直接展示); 仅当显式 ssr=0(或旧 nsbp=0) 时先播 loading。
  const [pageLoad, setPageLoad] = useState(
    mode !== undefined ? parseInt(String(mode), 10) : 1
  )

  useEffect(() => {
    if (pageLoad === 0) {
      setPageLoad(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Container>{pageLoad ? children : <Loading />}</Container>
}

export default Layout
