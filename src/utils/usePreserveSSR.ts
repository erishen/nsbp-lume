import { useMemo } from 'react'
import { appendSSRParam, removeSSRParam } from './index'

/**
 * React Hook：在路由跳转时保留首屏呈现模式参数（规范名 `ssr`）。
 *
 * @example
 * const { withSSR, withSSRValue, withoutSSR } = usePreserveSSR()
 *
 * // 保留当前 ssr 参数
 * <Link to={withSSR('/photo?dic=test')}>
 *
 * // 指定 ssr 值
 * <Link to={withSSRValue('/photo?dic=test', '0')}>
 *
 * // 移除 ssr / nsbp 参数
 * <Link to={withoutSSR('/photo?dic=test&ssr=0')}>
 */
export const usePreserveSSR = () => {
  return useMemo(
    () => ({
      /** 保留当前 URL 的 ssr 参数（写入规范名 ssr=） */
      withSSR: (url: string) => appendSSRParam(url),

      /** 指定 ssr 参数值 */
      withSSRValue: (url: string, value: string) =>
        appendSSRParam(url, value),

      /** 移除 ssr 与遗留的 nsbp 参数 */
      withoutSSR: (url: string) => removeSSRParam(url),
    }),
    []
  )
}
