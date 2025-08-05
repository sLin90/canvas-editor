import { ZERO } from '../../../dataset/constant/Common'
import {
  EDITOR_ELEMENT_COPY_ATTR,
  EDITOR_ELEMENT_STYLE_ATTR
} from '../../../dataset/constant/Element'
import { ElementType } from '../../../dataset/enum/Element'
import { IElement } from '../../../interface/Element'
import { IRangeElementStyle } from '../../../interface/Range'
import { splitText } from '../../../utils'
import { formatElementContext } from '../../../utils/element'
import { CanvasEvent } from '../CanvasEvent'

export function input(data: string, host: CanvasEvent) {
  const draw = host.getDraw()
  if (draw.isReadonly() || draw.isDisabled()) return
  const position = draw.getPosition()
  const cursorPosition = position.getCursorPosition()
  if (!data || !cursorPosition) return
  const isComposing = host.isComposing
  // 正在合成文本进行非输入操作
  if (isComposing && host.compositionInfo?.value === data) return
  const rangeManager = draw.getRange()
  if (!rangeManager.getIsCanInput()) return
  // 移除合成前，缓存设置的默认样式设置
  const defaultStyle =
    rangeManager.getDefaultStyle() || host.compositionInfo?.defaultStyle || null
  // 合成输入内容(单元格拆分后, compositionInfo中的元素列表不再直接影响真实元素,这里传入真实列表进行合成)
  const elementList = composingInputElements(host, draw.getElementList())
  if (!isComposing) {
    const cursor = draw.getCursor()
    cursor.clearAgentDomValue()
  }
  const { TEXT, HYPERLINK, SUBSCRIPT, SUPERSCRIPT, DATE, TAB } = ElementType
  const text = data.replaceAll(`\n`, ZERO)
  const { startIndex, endIndex } = rangeManager.getRange()
  // 格式化元素
  const copyElement = rangeManager.getRangeAnchorStyle(elementList, startIndex)
  if (!copyElement) return
  const isDesignMode = draw.isDesignMode()
  const inputData: IElement[] = splitText(text).map(value => {
    const newElement: IElement = {
      value
    }
    if (
      isDesignMode ||
      (!copyElement.title?.disabled && !copyElement.control?.disabled)
    ) {
      const nextElement = elementList[endIndex + 1]
      // 文本、超链接、日期、上下标：复制所有信息（元素类型、样式、特殊属性）
      if (
        !copyElement.type ||
        copyElement.type === TEXT ||
        (copyElement.type === HYPERLINK && nextElement?.type === HYPERLINK) ||
        (copyElement.type === DATE && nextElement?.type === DATE) ||
        (copyElement.type === SUBSCRIPT && nextElement?.type === SUBSCRIPT) ||
        (copyElement.type === SUPERSCRIPT && nextElement?.type === SUPERSCRIPT)
      ) {
        EDITOR_ELEMENT_COPY_ATTR.forEach(attr => {
          // 在分组外无需复制分组信息
          if (attr === 'groupIds' && !nextElement?.groupIds) return
          const value = copyElement[attr] as never
          if (value !== undefined) {
            newElement[attr] = value
          }
        })
      }
      // 仅复制样式：存在默认样式设置 || 无法匹配文本类元素时（TAB）
      if (defaultStyle || copyElement.type === TAB) {
        EDITOR_ELEMENT_STYLE_ATTR.forEach(attr => {
          const value =
            defaultStyle?.[attr as keyof IRangeElementStyle] ||
            copyElement[attr]
          if (value !== undefined) {
            newElement[attr] = value as never
          }
        })
      }
      if (isComposing) {
        newElement.underline = true
      }
    }
    return newElement
  })
  // 控件-移除placeholder
  const control = draw.getControl()
  let curIndex: number
  // 组合输入期间不处理元素内容
  if (!isComposing) {
    if (control.getActiveControl() && control.getIsRangeWithinControl()) {
      curIndex = control.setValue(inputData)
      if (!isComposing) {
        control.emitControlContentChange()
      }
    } else {
      const start = startIndex + 1
      formatElementContext(elementList, inputData, startIndex, {
        editorOptions: draw.getOptions()
      })
      draw.spliceElementList(elementList, start, 0, inputData)
      curIndex = startIndex + inputData.length
    }
  } else {
    curIndex = startIndex
  }
  if (~curIndex && !isComposing) {
    rangeManager.setRange(curIndex, curIndex)
    // 组合输入期间不渲染,防止单元格分页组合内容跨页导致渲染问题
    draw.render({
      curIndex,
      isSubmitHistory: !isComposing
    })
  }
  if (isComposing) {
    host.compositionInfo = {
      value: text,
      startIndex: curIndex,
      endIndex: endIndex,
      defaultStyle
    }
  }
}

export function removeComposingInput(host: CanvasEvent) {
  if (!host.compositionInfo) return
  host.compositionInfo = null
}

export function composingInputElements(
  host: CanvasEvent,
  elementList: IElement[]
) {
  if (!host.compositionInfo || host.isComposing) return elementList
  const { startIndex, endIndex } = host.compositionInfo
  if (startIndex !== endIndex) {
    host
      .getDraw()
      .spliceElementList(elementList, startIndex + 1, endIndex - startIndex)
    host.getDraw().getRange().setRange(startIndex, startIndex)
  }
  host.compositionInfo = null
  return elementList
}
