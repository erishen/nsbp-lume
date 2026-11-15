export const getLocationParams = (param: string) => {
  if (typeof window === 'undefined') return ''

  try {
    const url = new URL(window.location.href)
    const value = url.searchParams.get(param)
    return value || ''
  } catch (e) {
    console.error('Failed to parse URL:', e)
    return ''
  }
}

/**
 * 读取首屏呈现模式参数。
 * 规范参数是 `ssr`（?ssr=0 动画/客户端数据模式，?ssr=1 或省略 = 直接展示
 * SSR 内容）；旧项目分享出去的 `?nsbp=0/1` 链接保持可读，读取时优先 `ssr`、
 * 回退 `nsbp`。写入新链接一律用 `ssr=`。
 */
export const getSSRParam = (): string => {
  if (typeof window === 'undefined') return ''
  return getLocationParams('ssr') || getLocationParams('nsbp')
}

export const isSEO = () => {
  if (typeof window !== 'undefined') {
    const v = getSSRParam()
    if (v !== '') {
      return parseInt(v, 10)
    }
    return 1
  }
  return 1
}

/**
 * 在 URL 中保留/添加 ssr 参数（写入规范参数名 ssr）。
 *
 * @example
 * appendSSRParam('/photo?dic=test')
 * // 当前是 /?ssr=0 → '/photo?dic=test&ssr=0'
 */
export const appendSSRParam = (url: string, ssrValue?: string): string => {
  const ssr = ssrValue !== undefined ? ssrValue : getSSRParam()

  if (!ssr) {
    return url
  }

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}ssr=${ssr}`
}

/**
 * 从 URL 中移除呈现模式参数（ssr 与遗留的 nsbp 都删）。
 */
export const removeSSRParam = (url: string): string => {
  const urlObj = new URL(
    url,
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  )
  urlObj.searchParams.delete('ssr')
  urlObj.searchParams.delete('nsbp')
  return urlObj.pathname + urlObj.search
}

export { usePreserveSSR } from './usePreserveSSR'
