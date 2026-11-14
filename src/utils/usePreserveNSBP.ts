import { useMemo } from 'react'
import { appendSSRParam, removeSSRParam } from './index'
import { usePreserveSSR } from './usePreserveSSR'

/**
 * @deprecated 使用 usePreserveSSR 替代。参数规范名已从 `nsbp` 改为 `ssr`
 * （旧 `nsbp=` 链接仍可读，见 utils/index.ts 的 getSSRParam 回退逻辑）。
 * 为兼容旧代码保留：withNSBP/withNSBPValue 写入规范 ssr= 参数；
 * withoutNSBP 同时移除 ssr 与 nsbp。
 */
export const usePreserveNSBP = () => {
  const ssr = usePreserveSSR()
  return useMemo(
    () => ({
      withNSBP: ssr.withSSR,
      withNSBPValue: ssr.withSSRValue,
      withoutNSBP: (url: string) => removeSSRParam(url),
    }),
    [ssr]
  )
}
