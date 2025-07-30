import { ImageDisplay } from '../../../dataset/enum/Common'
import { ControlComponent } from '../../../dataset/enum/Control'
import { ElementType } from '../../../dataset/enum/Element'
import { CanvasEvent } from '../CanvasEvent'
import { IElement } from '../../../interface/Element'
import { SplitTdRange } from '../../../interface/Range'

export function mousemove(evt: MouseEvent, host: CanvasEvent) {
  const draw = host.getDraw()
  // 是否是拖拽文字
  if (host.isAllowDrag) {
    // 是否允许拖拽到选区
    const x = evt.offsetX
    const y = evt.offsetY
    const { startIndex, endIndex } = host.cacheRange!
    const positionList = host.cachePositionList!
    for (let p = startIndex + 1; p <= endIndex; p++) {
      const {
        coordinate: { leftTop, rightBottom }
      } = positionList[p]
      if (
        x >= leftTop[0] &&
        x <= rightBottom[0] &&
        y >= leftTop[1] &&
        y <= rightBottom[1]
      ) {
        return
      }
    }
    const cacheStartIndex = host.cacheRange?.startIndex
    if (cacheStartIndex) {
      // 浮动元素拖拽调整位置
      const dragElement = host.cacheElementList![cacheStartIndex]
      if (
        dragElement?.type === ElementType.IMAGE &&
        (dragElement.imgDisplay === ImageDisplay.SURROUND ||
          dragElement.imgDisplay === ImageDisplay.FLOAT_TOP ||
          dragElement.imgDisplay === ImageDisplay.FLOAT_BOTTOM)
      ) {
        draw.getPreviewer().clearResizer()
        draw.getImageParticle().dragFloatImage(evt.movementX, evt.movementY)
      }
    }
    host.dragover(evt)
    host.isAllowDrop = true
    return
  }
  if (!host.isAllowSelection || !host.mouseDownStartPosition) return
  const target = evt.target as HTMLDivElement
  const pageIndex = target.dataset.index
  // 设置pageNo
  if (pageIndex) {
    draw.setPageNo(Number(pageIndex))
  }
  // 结束位置
  const position = draw.getPosition()
  const positionResult = position.getPositionByXY({
    x: evt.offsetX,
    y: evt.offsetY
  })
  if (!~positionResult.index) return
  const {
    index,
    isTable,
    tdValueIndex,
    tdIndex,
    trIndex,
    tableId,
    trId,
    tdId
  } = positionResult
  const {
    index: startIndex,
    isTable: startIsTable,
    tdIndex: startTdIndex,
    tdId: startTdId,
    trIndex: startTrIndex,
    tableId: startTableId
  } = host.mouseDownStartPosition
  const endIndex = isTable ? tdValueIndex! : index
  // 判断是否是表格跨行/列
  const rangeManager = draw.getRange()
  // 是否是跨页单元格
  type SplitItem = { index: number; element: IElement; originalId?: string }
  let splitTd: [SplitItem, SplitItem] | undefined = undefined
  if (tdId !== startTdId && !!tdId && !!startTdId) {
    // 判断是否是跨页单元格
    const startTd = draw.getTdByPosition({
      ...host.mouseDownStartPosition,
      isTable: !!host.mouseDownStartPosition.tableId,
      index:
        host.mouseDownStartPosition.originalIndex ??
        host.mouseDownStartPosition.index
    })!
    const endTd = draw.getTdByPosition({
      ...positionResult,
      isTable: !!positionResult.tableId,
      index: positionResult.index
    })!
    if (draw.isSplitTd(startTd, endTd)) {
      const startValueIndex = (startTd.valueStartIndex ?? 0) + startIndex
      const endValueIndex = (endTd.valueStartIndex ?? 0) + tdValueIndex!
      splitTd = [
        {
          index: startValueIndex,
          element: startTd.value[startIndex],
          originalId: startTd.originalId
        },
        {
          index: endValueIndex,
          element: endTd.value[tdValueIndex!],
          originalId: endTd.originalId
        }
      ]
    }
  }
  if (isTable && startIsTable && tdId !== startTdId && !splitTd) {
    rangeManager.setRange(
      endIndex,
      endIndex,
      tableId,
      startTdIndex,
      tdIndex,
      startTrIndex,
      trIndex
    )
    position.setPositionContext({
      isTable,
      index,
      trIndex,
      tdIndex,
      tdId,
      trId,
      tableId
    })
  } else {
    let end = ~endIndex ? endIndex : 0
    // 开始或结束位置存在表格，但是非相同表格则忽略选区设置
    if ((startIsTable || isTable) && startTableId !== tableId && !splitTd) {
      return
    }
    // 开始位置
    let start = startIndex
    let startElement: IElement | undefined
    let endElement: IElement | undefined
    if (splitTd) {
      [{ element: startElement }, { element: endElement }] = splitTd
    } else {
      const elementList = draw.getElementList()
      startElement = elementList[start + 1]
      endElement = elementList[end]
    }
    if (start === end) return
    // 背景文本禁止选区
    if (
      startElement?.controlComponent === ControlComponent.PLACEHOLDER &&
      endElement?.controlComponent === ControlComponent.PLACEHOLDER &&
      startElement.controlId === endElement.controlId
    ) {
      return
    }
    if (start > end) {
      // prettier-ignore
      [start, end] = [end, start]
    }
    let splitTdRange: SplitTdRange | undefined
    if (splitTd) {
      const [startIndex, endIndex] = [splitTd[0].index, splitTd[1].index].sort(
        (a, b) => a - b
      )
      splitTdRange = {
        originalId: splitTd[0].originalId ?? splitTd[1].originalId!,
        startIndex: startIndex,
        endIndex: endIndex
      }
    }
    rangeManager.setRange(
      start,
      end,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      splitTdRange
    )
  }
  // 绘制
  draw.render({
    isSubmitHistory: false,
    isSetCursor: false,
    isCompute: false
  })
}
