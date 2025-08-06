import {
  CONTROL_STYLE_ATTR,
  TEXTLIKE_ELEMENT_TYPE
} from '../../../../dataset/constant/Element'
import { ControlComponent } from '../../../../dataset/enum/Control'
import { KeyMap } from '../../../../dataset/enum/KeyMap'
import { DeepRequired } from '../../../../interface/Common'
import {
  IControlContext,
  IControlInstance,
  IControlRuleOption
} from '../../../../interface/Control'
import { IEditorOption } from '../../../../interface/Editor'
import { IElement } from '../../../../interface/Element'
import { omitObject, pickObject } from '../../../../utils'
import { formatElementContext } from '../../../../utils/element'
import { Control } from '../Control'

export class TextControl implements IControlInstance {
  private element: IElement
  private control: Control
  private options: DeepRequired<IEditorOption>

  constructor(element: IElement, control: Control) {
    const draw = control.getDraw()
    this.options = draw.getOptions()
    this.element = element
    this.control = control
  }

  public setElement(element: IElement) {
    this.element = element
  }

  public getElement(): IElement {
    return this.element
  }

  public getValue(context: IControlContext = {}): IElement[] {
    const elementList = context.elementList || this.control.getElementList()
    let { startIndex } = context.range || this.control.getRange()
    const draw = this.control.getDraw()
    const curTd = draw.getTd()
    const { index } = draw.getPosition().getPositionContext()
    if (startIndex >= elementList.length) {
      startIndex = elementList.length - 1
    }
    const startElement = elementList[startIndex]
    const data: IElement[] = []

    let findIndex = index
    let findTd = curTd
    // 向左查找
    let prevList = elementList
    let preIndex = startIndex
    while (true) {
      if (preIndex < 0) {
        if (findTd?.linkTdPrevId) {
          // 超出边界 进入nextTd
          const prev = draw.findLinkTdPrev(findIndex!, findTd.linkTdPrevId)
          if (prev) {
            prevList = prev.td.value
            preIndex = prevList.length - 1
            findIndex = prev.originalIndex
            findTd = prev.td
            continue
          }
        }
      }
      const preElement = prevList[preIndex]
      if (
        preElement.controlId !== startElement.controlId ||
        preElement.controlComponent === ControlComponent.PREFIX ||
        preElement.controlComponent === ControlComponent.PRE_TEXT
      ) {
        break
      }
      if (preElement.controlComponent === ControlComponent.VALUE) {
        data.unshift(preElement)
      }
      preIndex--
    }

    findIndex = index
    findTd = curTd
    // 向右查找
    let nextList = elementList
    let nextIndex = startIndex + 1
    while (true) {
      if (nextIndex >= nextList.length) {
        if (findTd?.linkTdNextId) {
          // 超出边界 进入nextTd
          const next = draw.findLinkTdNext(findIndex!, findTd.linkTdNextId)
          if (next) {
            nextList = next.td.value
            nextIndex = 0
            findIndex = next.originalIndex
            findTd = next.td
            continue
          }
        }
      }
      const nextElement = nextList[nextIndex]
      if (
        !nextElement ||
        nextElement.controlId !== startElement.controlId ||
        nextElement.controlComponent === ControlComponent.POSTFIX ||
        nextElement.controlComponent === ControlComponent.POST_TEXT
      ) {
        break
      }
      if (nextElement.controlComponent === ControlComponent.VALUE) {
        data.push(nextElement)
      }
      nextIndex++
    }
    return data.filter(item => !item.splitTdTag)
  }
  public removeNextControlElement(
    controlId: string,
    positionIndex?: number,
    nextTdId?: string
  ): IElement | undefined {
    const draw = this.control.getDraw()
    nextTdId = nextTdId ?? draw.getTd()?.linkTdNextId
    if (nextTdId) {
      const index =
        positionIndex ?? draw.getPosition().getPositionContext().index
      const next = draw.findLinkTdNext(index!, nextTdId)
      if (next) {
        if (next.td.value.length) {
          if (next.td.value[1].controlId === controlId) {
            draw.spliceElementList(next.td.value, 1, 1)
            return next.td.value[1]
          }
        } else if (next.td.linkTdNextId) {
          return this.removeNextControlElement(
            controlId,
            next.originalIndex,
            next.td.linkTdNextId
          )
        }
      }
    }
    return
  }

  public setValue(
    data: IElement[],
    context: IControlContext = {},
    options: IControlRuleOption = {}
  ): number {
    // 校验是否可以设置
    if (
      !options.isIgnoreDisabledRule &&
      this.control.getIsDisabledControl(context)
    ) {
      return -1
    }
    const elementList = context.elementList || this.control.getElementList()
    const range = context.range || this.control.getRange()
    // 收缩边界到Value内
    this.control.shrinkBoundary(context)
    const { startIndex, endIndex } = range
    const draw = this.control.getDraw()
    // 移除选区元素
    if (startIndex !== endIndex) {
      draw.spliceElementList(
        elementList,
        startIndex + 1,
        endIndex - startIndex,
        [],
        {
          isIgnoreDeletedRule: options.isIgnoreDeletedRule
        }
      )
    } else {
      // 移除空白占位符
      this.control.removePlaceholder(startIndex, context)
    }
    // 非文本类元素或前缀过渡掉样式属性
    const startElement = elementList[startIndex]
    const anchorElement =
      (startElement.type &&
        !TEXTLIKE_ELEMENT_TYPE.includes(startElement.type)) ||
      startElement.controlComponent === ControlComponent.PREFIX ||
      startElement.controlComponent === ControlComponent.PRE_TEXT
        ? pickObject(startElement, [
            'control',
            'controlId',
            ...CONTROL_STYLE_ATTR
          ])
        : omitObject(startElement, ['type'])
    // 插入起始位置
    const start = range.startIndex + 1
    for (let i = 0; i < data.length; i++) {
      const newElement: IElement = {
        ...anchorElement,
        ...data[i],
        controlComponent: ControlComponent.VALUE
      }
      formatElementContext(elementList, [newElement], startIndex, {
        editorOptions: this.options
      })
      draw.spliceElementList(elementList, start + i, 0, [newElement])
    }
    return start + data.length - 1
  }

  public clearValue(
    context: IControlContext = {},
    options: IControlRuleOption = {}
  ): number {
    // 校验是否可以设置
    if (
      !options.isIgnoreDisabledRule &&
      this.control.getIsDisabledControl(context)
    ) {
      return -1
    }
    const elementList = context.elementList || this.control.getElementList()
    const range = context.range || this.control.getRange()
    const { startIndex, endIndex } = range
    this.control
      .getDraw()
      .spliceElementList(
        elementList,
        startIndex + 1,
        endIndex - startIndex,
        [],
        {
          isIgnoreDeletedRule: options.isIgnoreDeletedRule
        }
      )
    const value = this.getValue(context)
    if (!value.length) {
      this.control.addPlaceholder(startIndex, context)
    }
    return startIndex
  }

  public keydown(evt: KeyboardEvent): number | null {
    if (this.control.getIsDisabledControl()) {
      return null
    }
    const elementList = this.control.getElementList()
    const range = this.control.getRange()
    // 收缩边界到Value内
    this.control.shrinkBoundary()
    const { startIndex, endIndex } = range
    const startElement = elementList[startIndex]
    const endElement = elementList[endIndex]
    const draw = this.control.getDraw()
    // backspace
    if (evt.key === KeyMap.Backspace) {
      // 移除选区元素
      if (startIndex !== endIndex) {
        draw.spliceElementList(
          elementList,
          startIndex + 1,
          endIndex - startIndex
        )
        const value = this.getValue()
        if (!value.length) {
          this.control.addPlaceholder(startIndex)
        }
        if (startIndex === 0 && elementList[0].splitTdTag) {
          return draw.fixPosition(true) ?? startIndex
        }
        return startIndex
      } else {
        if (
          startElement.controlComponent === ControlComponent.PREFIX ||
          startElement.controlComponent === ControlComponent.PRE_TEXT ||
          endElement.controlComponent === ControlComponent.POSTFIX ||
          endElement.controlComponent === ControlComponent.POST_TEXT ||
          startElement.controlComponent === ControlComponent.PLACEHOLDER
        ) {
          // 前缀、后缀、占位符
          return this.control.removeControl(startIndex)
        } else {
          // 文本
          draw.spliceElementList(elementList, startIndex, 1)
          const value = this.getValue()
          if (!value.length) {
            this.control.addPlaceholder(startIndex - 1)
          }
          if (startIndex === 1 && elementList[0].splitTdTag) {
            return draw.fixPosition(true) ?? startIndex - 1
          }
          return startIndex - 1
        }
      }
    } else if (evt.key === KeyMap.Delete) {
      // 移除选区元素
      if (startIndex !== endIndex) {
        draw.spliceElementList(
          elementList,
          startIndex + 1,
          endIndex - startIndex
        )
        const value = this.getValue()
        if (!value.length) {
          this.control.addPlaceholder(startIndex)
        }
        if (startIndex === 0 && elementList[0].splitTdTag) {
          return draw.fixPosition(true) ?? startIndex
        }
        return startIndex
      } else {
        const endNextElement: IElement | undefined = elementList[endIndex + 1]
        if (!endNextElement) {
          // 未找到下一个元素 判断是否是拆分单元格
          const curTd = draw.getTd()
          if (curTd?.linkTdNextId && startElement.controlId) {
            this.removeNextControlElement(startElement.controlId)
          }
        }
        if (
          endNextElement &&
          (((startElement.controlComponent === ControlComponent.PREFIX ||
            startElement.controlComponent === ControlComponent.PRE_TEXT) &&
            endNextElement.controlComponent === ControlComponent.PLACEHOLDER) ||
            endNextElement.controlComponent === ControlComponent.POSTFIX ||
            endNextElement.controlComponent === ControlComponent.POST_TEXT ||
            startElement.controlComponent === ControlComponent.PLACEHOLDER)
        ) {
          // 前缀、后缀、占位符
          return this.control.removeControl(startIndex)
        } else {
          // 文本
          draw.spliceElementList(elementList, startIndex + 1, 1)
          const value = this.getValue()
          if (!value.length) {
            this.control.addPlaceholder(startIndex)
          }
          if (startIndex === 0 && elementList[0].splitTdTag) {
            return draw.fixPosition(true) ?? startIndex
          }
          return startIndex
        }
      }
    }
    return endIndex
  }

  public cut(): number {
    if (this.control.getIsDisabledControl()) {
      return -1
    }
    this.control.shrinkBoundary()
    const { startIndex, endIndex } = this.control.getRange()
    if (startIndex === endIndex) {
      return startIndex
    }
    const draw = this.control.getDraw()
    const elementList = this.control.getElementList()
    draw.spliceElementList(elementList, startIndex + 1, endIndex - startIndex)
    const value = this.getValue()
    if (!value.length) {
      this.control.addPlaceholder(startIndex)
    }
    return startIndex
  }
}
