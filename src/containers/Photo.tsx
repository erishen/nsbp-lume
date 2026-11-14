import React, { Fragment, useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { connect } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import Header from '@components/Header'
import Layout from '@components/Layout'
import { Helmet } from 'react-helmet'
import { Container, Row } from '@styled/photo'
import { motion } from 'framer-motion'
import { isSEO, getLocationParams, usePreserveSSR } from '@/utils'
import _ from 'lodash'
import { loadDataForContainer } from '@services/photo'
import { usePhotoMenu, usePhotoDimensions } from '@services/suspense'

const springSettings = { type: 'spring' as const, stiffness: 170, damping: 26 }
const NEXT = 'show-next'

interface QueryParams {
  from?: string
  /** 规范呈现模式参数: ssr=1/省略 直出, ssr=0 动画+客户端数据 */
  ssr?: string | number
  /** @deprecated 旧参数名, 仍可读(Layout 读 ssr ?? nsbp) */
  nsbp?: string | number
}

interface PhotoProps {
  query: QueryParams
  menu: Array<{ name: string; cover?: string; count?: number }>
  getPhotoMenu: (dic: string) => void
}

const Photo = ({ query, menu: _legacyMenu, getPhotoMenu }: PhotoProps) => {
  const location = useLocation()
  let { from } = query
  const { withSSR } = usePreserveSSR()
  // 使用 ref 来跟踪初始的 dic 值，用于区分首次加载和分类切换
  const initialDicRef = useRef<string | null>(null)

  useEffect(() => {
    const currentDic = getLocationParams('dic') || ''

    // 初始化时记录初始 dic 值
    if (initialDicRef.current === null) {
      initialDicRef.current = currentDic
    }

    // 判断是否需要加载数据：
    // 1. 客户端渲染模式（isSEO() === 0）- 总是加载
    // 2. 服务端渲染模式：只有在没有数据或分类切换时才加载
    //    （Suspense 边界在渲染时已按 dic 流式解析了尺寸数据，这里是
    //     分类切换时的兜底：URL 变了但 dic 相同则不重复拉）
    const isClientMode = isSEO() === 0
    if (isClientMode && currentDic !== initialDicRef.current) {
      getPhotoMenu(currentDic)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.search, from])

  return (
    <Fragment>
      <Helmet>
        <title>Photo</title>
        <meta name="description" content="Photo Description" />
      </Helmet>
      <Header />

      <Layout query={query}>
        <Container>
          {/* 菜单行：Suspense 数据边界。服务端 use() 挂起 → shell 先冲，
              菜单后流；客户端 store 有预取态 → 同步值，不闪。 */}
          <Suspense
            fallback={
              <Row>
                <span className="photo-suspense-fallback">加载菜单...</span>
              </Row>
            }
          >
            <SuspendedMenuRow withSSR={withSSR} />
          </Suspense>
          <Row>Scroll Me</Row>
          {/* 轮播区：尺寸数据也走 Suspense 边界，服务端流式、客户端即时。 */}
          <Suspense
            fallback={
              <Row>
                <span className="photo-suspense-fallback">加载图片...</span>
              </Row>
            }
          >
            <SuspendedCarousel />
          </Suspense>
        </Container>
      </Layout>
    </Fragment>
  )
}

// Suspense boundary #1: the category menu row.
function SuspendedMenuRow({ withSSR }: { withSSR: (u: string) => string }) {
  const menu = usePhotoMenu()
  if (!Array.isArray(menu) || menu.length === 0) {
    return null
  }
  return (
    <Row>
      {_.map(menu, (item: { name: string }, index: number) => {
        return (
          <Link key={`menu${index}`} to={withSSR(`/photo?dic=${item.name}`)}>
            {item.name}
          </Link>
        )
      })}
    </Row>
  )
}

// Suspense boundary #2: the carousel (prev/next + range + strip).
// The strip data comes from usePhotoDimensions(dic) — the genuine streaming
// boundary: on the server renderToPipeableStream flushes the page shell
// first, then the carousel when the dimensions settle.
function SuspendedCarousel() {
  const location = useLocation()
  const dic = getLocationParams('dic') || ''
  const dims = usePhotoDimensions(dic)
  const photos = useMemo(() => (Array.isArray(dims) ? dims : []), [dims])
  const [currPhoto, setCurrPhoto] = useState(0)

  const [currPhotoData, setCurrPhotoData] = useState<[number, number, string]>(
    photos[0] || [0, 0, '']
  )
  const [currWidth, currHeight] = currPhotoData

  const widths = photos.map((photo) => {
    const [origW, origH] = photo
    return (currHeight / origH) * origW
  })

  // 同步 currPhoto 和 currPhotoData
  useEffect(() => {
    if (photos[currPhoto]) {
      setCurrPhotoData(photos[currPhoto])
    }
  }, [currPhoto, photos])

  const leftStartCoords = widths
    .slice(0, currPhoto)
    .reduce((sum: number, width: number) => sum - width, 0)

  interface PhotoPosition {
    left: number
    height: number
    width: number
  }

  const photoPositions = photos.reduce<PhotoPosition[]>((acc, _item, i) => {
    const prevLeft =
      i === 0 ? leftStartCoords : acc[i - 1].left + acc[i - 1].width
    acc.push({
      left: prevLeft,
      height: currHeight,
      width: widths[i] || 0
    })
    return acc
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrPhoto(Number(e.target.value))
  }

  const clickHandler = (btn: string) => {
    let photoIndex = btn === NEXT ? currPhoto + 1 : currPhoto - 1

    photoIndex = photoIndex >= 0 ? photoIndex : photos.length - 1
    photoIndex = photoIndex >= photos.length ? 0 : photoIndex

    setCurrPhoto(photoIndex)
  }

  // SSR/客户端首帧一致：控制行(依赖 photos)与轮播条同时出现，
  // 避免 Suspense 解析后的 hydration mismatch。
  return (
    <Fragment>
      <Row>
        <button onClick={() => clickHandler('')}>Previous</button>
        <input
          type="range"
          min={0}
          max={photos.length - 1}
          value={currPhoto}
          onChange={handleChange}
        />
        <button onClick={() => clickHandler(NEXT)}>Next</button>
      </Row>
      <div className="demo4">
        <motion.div
          className="demo4-inner"
          animate={{ height: currHeight, width: currWidth }}
          transition={springSettings}
        >
          {photoPositions.map((pos, i) => (
            <motion.img
              key={i}
              className="demo4-photo"
              src={
                photos[i][2]
                  ? `/images/${photos[i][2]}`
                  : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
              }
              initial={false}
              animate={{
                left: pos.left,
                height: pos.height,
                width: pos.width
              }}
              transition={springSettings}
              style={{
                position: 'absolute',
                top: 0
              }}
            />
          ))}
        </motion.div>
      </div>
    </Fragment>
  )
}

interface RootState {
  query: QueryParams
  photo: {
    menu: Array<{ name: string; cover?: string; count?: number }>
    data: [number, number, string][]
  }
}

const mapStateToProps = (state: RootState) => {
  return {
    query: state?.query,
    menu: state?.photo?.menu
  }
}

const mapDispatchToProps = {
  getPhotoMenu: (dic: string) => loadDataForContainer(null, dic)
}

export default connect(mapStateToProps, mapDispatchToProps)(Photo)
