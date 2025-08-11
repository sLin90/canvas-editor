import { ElementType, IElement, TableBorder, VerticalAlign } from '../../../..'
import { ZERO } from '../../../../dataset/constant/Common'
import { TABLE_CONTEXT_ATTR } from '../../../../dataset/constant/Element'
import { TdBorder, TdSlash } from '../../../../dataset/enum/table/Table'
import { DeepRequired } from '../../../../interface/Common'
import { IEditorOption } from '../../../../interface/Editor'
import { IColgroup } from '../../../../interface/table/Colgroup'
import { ITd } from '../../../../interface/table/Td'
import { ITr } from '../../../../interface/table/Tr'
import { cloneProperty, getUUID } from '../../../../utils'
import {
  formatElementContext,
  formatElementList
} from '../../../../utils/element'
import { Position } from '../../../position/Position'
import { RangeManager } from '../../../range/RangeManager'
import { Draw } from '../../Draw'
import { TableParticle } from './TableParticle'
import { TableTool } from './TableTool'

export class TableOperate {
  private draw: Draw
  private range: RangeManager
  private position: Position
  private tableTool: TableTool
  private tableParticle: TableParticle
  private options: DeepRequired<IEditorOption>

  constructor(draw: Draw) {
    this.draw = draw
    this.range = draw.getRange()
    this.position = draw.getPosition()
    this.tableTool = draw.getTableTool()
    this.tableParticle = draw.getTableParticle()
    this.options = draw.getOptions()
  }

  public insertTable(row: number, col: number) {
    const { startIndex, endIndex } = this.range.getRange()
    if (!~startIndex && !~endIndex) return
    const { defaultTrMinHeight } = this.options.table
    const elementList = this.draw.getElementList()
    let offsetX = 0
    if (elementList[startIndex]?.listId) {
      const positionList = this.position.getPositionList()
      const { rowIndex } = positionList[startIndex]
      const rowList = this.draw.getRowList()
      const row = rowList[rowIndex]
      offsetX = row?.offsetX || 0
    }
    const innerWidth = this.draw.getContextInnerWidth() - offsetX
    // colgroup
    const colgroup: IColgroup[] = []
    const colWidth = innerWidth / col
    for (let c = 0; c < col; c++) {
      colgroup.push({
        width: colWidth
      })
    }
    // trlist
    const trList: ITr[] = []
    for (let r = 0; r < row; r++) {
      const tdList: ITd[] = []
      const tr: ITr = {
        height: defaultTrMinHeight,
        tdList
      }
      for (let c = 0; c < col; c++) {
        tdList.push({
          colspan: 1,
          rowspan: 1,
          value: []
        })
      }
      trList.push(tr)
    }
    const element: IElement = {
      type: ElementType.TABLE,
      value: '',
      colgroup,
      trList
    }
    // 格式化element
    formatElementList([element], {
      editorOptions: this.options
    })
    formatElementContext(elementList, [element], startIndex, {
      editorOptions: this.options
    })
    const curIndex = startIndex + 1
    this.draw.spliceElementList(
      elementList,
      curIndex,
      startIndex === endIndex ? 0 : endIndex - startIndex,
      [element]
    )
    this.range.setRange(curIndex, curIndex)
    this.draw.render({ curIndex, isSetCursor: false })
  }

  public insertTableTopRow() {
    const positionContext = this.position.getPositionContext()
    if (!positionContext.isTable) return
    let { index, trIndex, tdIndex, tableId } = positionContext
    const originalElementList = this.draw.getOriginalElementList()
    let element = originalElementList[index!]
    let curTrList = element.trList!
    let curTr = curTrList[trIndex!]
    let curTd = curTr.tdList[tdIndex!]
    let curTdList = curTr.tdList.filter(td => !td.originalId)
    if (curTd.linkTdPrevId) {
      const prevTd = this.draw.getFirstLinkTd(curTd.linkTdPrevId)
      if (prevTd) {
        index = prevTd.tableIndex
        tableId = prevTd.tableId
        trIndex = prevTd.trIndex
        tdIndex = prevTd.tdIndex
        element = originalElementList[index!]
        curTrList = element.trList!
        curTr = curTrList[trIndex!]
        curTdList = curTr.tdList.filter(td => !td.originalId)
        curTd = prevTd
      }
    }

    // 之前跨行的增加跨行数
    if (curTr.tdList.length < element.colgroup!.length) {
      const curTrNo = curTr.tdList[0].rowIndex!
      for (let t = 0; t < trIndex!; t++) {
        const tr = curTrList[t]
        for (let d = 0; d < tr.tdList.length; d++) {
          const td = tr.tdList[d]
          if (td.rowspan > 1 && td.rowIndex! + td.rowspan >= curTrNo + 1) {
            td.rowspan += 1
            if (td.originalId) {
              const originalTd = this.draw.getTdById(td.originalId)
              if (originalTd) {
                originalTd.originalRowspan! += 1
              }
            } else if (td.originalRowspan !== undefined) {
              td.originalRowspan += 1
            }
          }
        }
      }
    } else {
      // 可能存在分页单元格
      curTr.tdList.forEach(td => {
        if (td.originalId) {
          const originalTd = this.draw.getTdById(td.originalId)
          if (originalTd) {
            originalTd.originalRowspan! += 1
          }
        }
      })
    }
    // 增加当前行
    const newTrId = getUUID()
    const newTr: ITr = {
      height: curTr.height,
      id: newTrId,
      tdList: []
    }
    for (let t = 0; t < curTdList.length; t++) {
      const curTd = curTr.tdList[t]
      const newTdId = getUUID()
      newTr.tdList.push({
        id: newTdId,
        rowspan: 1,
        colspan: curTd.colspan,
        value: [
          {
            value: ZERO,
            size: 16,
            tableId,
            trId: newTrId,
            tdId: newTdId
          }
        ]
      })
    }
    curTrList.splice(trIndex!, 0, newTr)
    // 重新设置上下文
    this.position.setPositionContext({
      isTable: true,
      index,
      trIndex,
      tdIndex: 0,
      tdId: newTr.tdList[0].id,
      trId: newTr.id,
      tableId
    })
    this.range.setRange(0, 0)
    // 重新渲染
    this.draw.render({ curIndex: 0 })
    this.tableTool.render()
  }

  public insertTableBottomRow() {
    const positionContext = this.position.getPositionContext()
    if (!positionContext.isTable) return
    let { index, trIndex, tableId, tdIndex } = positionContext
    const originalElementList = this.draw.getOriginalElementList()
    let element = originalElementList[index!]
    let curTrList = element.trList!
    let curTr = curTrList[trIndex!]
    let curTd = curTr.tdList[tdIndex!]
    if (curTd.linkTdNextId) {
      const nextTd = this.draw.getFirstLinkTd(curTd.linkTdNextId)
      if (nextTd) {
        index = nextTd.tableIndex
        tableId = nextTd.tableId
        trIndex = nextTd.trIndex
        tdIndex = nextTd.tdIndex
        element = originalElementList[index!]
        curTrList = element.trList!
        curTr = curTrList[trIndex!]
        curTd = nextTd
      }
    }
    const anchorTr =
      curTrList.length - 1 === trIndex ? curTr : curTrList[trIndex! + 1]
    // 之前/当前行跨行的增加跨行数
    if (anchorTr.tdList.length < element.colgroup!.length) {
      const curTrNo = anchorTr.tdList[0].rowIndex!
      for (let t = 0; t < trIndex! + 1; t++) {
        const tr = curTrList[t]
        for (let d = 0; d < tr.tdList.length; d++) {
          const td = tr.tdList[d]
          if (td.rowspan > 1 && td.rowIndex! + td.rowspan >= curTrNo + 1) {
            td.rowspan += 1
            if (td.originalId) {
              const originalTd = this.draw.getTdById(td.originalId)
              if (originalTd) {
                originalTd.originalRowspan! += 1
              }
            } else if (td.originalRowspan !== undefined) {
              td.originalRowspan += 1
            }
          }
        }
      }
    }
    // 增加当前行
    const newTrId = getUUID()
    const newTr: ITr = {
      height: anchorTr.height,
      id: newTrId,
      tdList: []
    }
    for (let t = 0; t < anchorTr.tdList.length; t++) {
      const curTd = anchorTr.tdList[t]
      const newTdId = getUUID()
      newTr.tdList.push({
        id: newTdId,
        rowspan: 1,
        colspan: curTd.colspan,
        value: [
          {
            value: ZERO,
            size: 16,
            tableId,
            trId: newTrId,
            tdId: newTdId
          }
        ]
      })
    }
    curTrList.splice(trIndex! + 1, 0, newTr)
    // 重新设置上下文
    this.position.setPositionContext({
      isTable: true,
      index,
      trIndex: trIndex! + 1,
      tdIndex: 0,
      tdId: newTr.tdList[0].id,
      trId: newTr.id,
      tableId: element.id
    })
    this.range.setRange(0, 0)
    // 重新渲染
    this.draw.render({ curIndex: 0 })
  }

  public adjustColWidth(element: IElement) {
    if (element.type !== ElementType.TABLE) return
    const { defaultColMinWidth } = this.options.table
    const colgroup = element.colgroup!
    const colgroupWidth = colgroup.reduce((pre, cur) => pre + cur.width, 0)
    const width = this.draw.getOriginalInnerWidth()
    if (colgroupWidth > width) {
      // 过滤大于最小宽度的列（可能减少宽度的列）
      const greaterMinWidthCol = colgroup.filter(
        col => col.width > defaultColMinWidth
      )
      // 均分多余宽度
      const adjustWidth = (colgroupWidth - width) / greaterMinWidthCol.length
      for (let g = 0; g < colgroup.length; g++) {
        const group = colgroup[g]
        // 小于最小宽度的列不处理
        if (group.width - adjustWidth >= defaultColMinWidth) {
          group.width -= adjustWidth
        }
      }
    }
  }

  public insertTableLeftCol() {
    const positionContext = this.position.getPositionContext()
    if (!positionContext.isTable) return
    const { index, trIndex, tdIndex, tableId } = positionContext
    const originalElementList = this.draw.getOriginalElementList()
    const element = originalElementList[index!]
    const curTd = element.trList![trIndex!].tdList[tdIndex!]
    const curColIndex = curTd.colIndex!
    let curTrAddTd: ITd | undefined

    this.draw
      .getTablesByPagingId(originalElementList, element.pagingId!, index!)
      .list.forEach(table => {
        const curTrList = table.trList!
        // 增加列
        for (let t = 0; t < curTrList.length; t++) {
          const tr = curTrList[t]
          const tdId = getUUID()
          if (!tr.tdList.filter(td => !td.originalId).length) {
            break
          }
          let insertIndex = tr.tdList.findIndex(
            td => td.colIndex == curColIndex
          )
          let createTd = insertIndex >= 0
          if (!createTd) {
            for (let i = 0; i < tr.tdList.length; i++) {
              const td = tr.tdList[i]
              if (
                td.colIndex! < curColIndex &&
                td.colIndex! + td.colspan - 1 >= curColIndex
              ) {
                // 跨列时 跨度+1
                td.colspan += 1
                createTd = false
                break
              }
              if (i === tr.tdList.length - 1) {
                // 未找到
                createTd = true
                insertIndex = tr.tdList.filter(
                  td => td.colIndex! < curColIndex
                ).length
              }
            }
          }
          if (createTd) {
            const addTd: ITd = {
              id: tdId,
              rowspan: 1,
              colspan: 1,
              value: [
                {
                  value: ZERO,
                  size: 16,
                  tableId,
                  trId: tr.id,
                  tdId
                }
              ]
            }
            tr.tdList.splice(insertIndex, 0, addTd)
            if (
              t === trIndex &&
              tdIndex! === insertIndex &&
              table.id === element.id
            ) {
              curTrAddTd = addTd
            }
          }
        }
        // 重新计算宽度
        const colgroup = table.colgroup!
        const { defaultColMinWidth } = this.options.table
        colgroup.splice(curColIndex, 0, {
          width: defaultColMinWidth
        })
        // 初始化列索引
        this.draw.initTableElementIndex(table, index)
        this.adjustColWidth(table)
      })

    // 重新设置上下文
    this.position.setPositionContext({
      isTable: true,
      index,
      trIndex: curTrAddTd?.trIndex,
      tdIndex: curTrAddTd?.tdIndex,
      tdId: curTrAddTd?.id,
      trId: curTrAddTd?.trId,
      tableId
    })
    this.range.setRange(0, 0)
    // 重新渲染
    this.draw.render({ curIndex: 0 })
    this.tableTool.render()
  }

  public insertTableRightCol() {
    const positionContext = this.position.getPositionContext()
    if (!positionContext.isTable) return
    const { index, trIndex, tdIndex, tableId } = positionContext
    const originalElementList = this.draw.getOriginalElementList()
    const element = originalElementList[index!]
    const curTd = element.trList![trIndex!].tdList[tdIndex!]
    const curColIndex = curTd.colIndex! + curTd.colspan - 1
    let curTrAddTd: ITd | undefined

    this.draw
      .getTablesByPagingId(originalElementList, element.pagingId!, index!)
      .list.forEach(table => {
        const curTrList = table.trList!
        // 增加列
        for (let t = 0; t < curTrList.length; t++) {
          const tr = curTrList[t]
          const tdId = getUUID()
          if (!tr.tdList.filter(td => !td.originalId).length) {
            break
          }
          let insertIndex = tr.tdList.findIndex(
            td => td.colIndex == curColIndex
          )
          let createTd = insertIndex >= 0
          if (!createTd) {
            for (let i = 0; i < tr.tdList.length; i++) {
              const td = tr.tdList[i]
              if (
                td.colIndex! < curColIndex &&
                td.colIndex! + td.colspan - 1 >= curColIndex
              ) {
                // 跨列时 跨度+1
                td.colspan += 1
                createTd = false
                break
              }
              if (i === tr.tdList.length - 1) {
                // 未找到
                createTd = true
                insertIndex = tr.tdList.filter(
                  td => td.colIndex! < curColIndex
                ).length
              }
            }
          }
          if (createTd) {
            const addTd: ITd = {
              id: tdId,
              rowspan: 1,
              colspan: 1,
              value: [
                {
                  value: ZERO,
                  size: 16,
                  tableId,
                  trId: tr.id,
                  tdId
                }
              ]
            }
            tr.tdList.splice(insertIndex + 1, 0, addTd)
            if (
              t === trIndex &&
              tdIndex! === insertIndex &&
              table.id === element.id
            ) {
              curTrAddTd = addTd
            }
          }
        }
        // 重新计算宽度
        const colgroup = table.colgroup!
        const { defaultColMinWidth } = this.options.table
        colgroup.splice(curColIndex + 1, 0, {
          width: defaultColMinWidth
        })
        // 初始化列索引
        this.draw.initTableElementIndex(table, index)
        this.adjustColWidth(table)
      })

    // 重新设置上下文
    this.position.setPositionContext({
      isTable: true,
      index,
      trIndex: curTrAddTd?.trIndex,
      tdIndex: curTrAddTd?.tdIndex,
      tdId: curTrAddTd?.id,
      trId: curTrAddTd?.trId,
      tableId
    })
    this.range.setRange(0, 0)
    // 重新渲染
    this.draw.render({ curIndex: 0 })
  }

  public deleteTableRow() {
    const positionContext = this.position.getPositionContext()
    if (!positionContext.isTable) return
    const { index, trIndex, tdIndex } = positionContext
    const originalElementList = this.draw.getOriginalElementList()
    let element = originalElementList[index!]
    let trList = element.trList!
    let curTr = trList[trIndex!]
    let curTd = curTr.tdList[tdIndex!]
    if (curTd.originalId) {
      curTd = this.draw.getTdById(curTd.originalId)!
      element = originalElementList[curTd.tableIndex!]
      trList = element.trList!
      curTr = trList[trIndex!]!
    }
    // 获取当前表格的行数
    const { list } = this.draw.getTablesByPagingId(
      originalElementList,
      element.pagingId!,
      index!
    )
    const trCount = list
      .map(table =>
        table
          .trList!.map((tr): number =>
            tr.tdList.filter(td => !td.originalId).length ? 1 : 0
          )
          .reduce((pre, cur) => pre + cur, 0)
      )
      .reduce((pre, cur) => pre + cur, 0)
    // 如果是最后一行，直接删除整个表格（如果是拆分表格按照正常逻辑走）
    if (trCount === 1) {
      this.deleteTable()
      return
    }
    const curTdRowIndex = curTd.rowIndex!

    // 之前行缩小rowspan
    for (let r = 0; r < curTdRowIndex; r++) {
      const tr = trList[r]
      const tdList = tr.tdList
      for (let d = 0; d < tdList.length; d++) {
        const td = tdList[d]
        if (td.rowIndex! + td.rowspan > curTdRowIndex) {
          td.rowspan--
          if (td.originalId) {
            const originalTd = this.draw.getTdById(td.originalId)
            if (originalTd) {
              originalTd.originalRowspan! -= 1
            }
          } else if (td.originalRowspan !== undefined) {
            td.originalRowspan -= 1
          }
        }
      }
    }
    for (let d = 0; d < curTr.tdList.length; d++) {
      const td = curTr.tdList[d]
      if (
        !td.linkTdNextId &&
        td.linkTdPrevId &&
        this.draw.getTdById(td.linkTdPrevId)?.originalRowspan === 1
      ) {
        // 拆分单元格 并且原始单元格之有一行 需要连带前一页的单元格一并删除
        this.draw.removeLinkTd(originalElementList, td.linkTdPrevId)
        d--
      }
      if (!td.originalId && td.linkTdNextId) {
        // 拆分单元格首页 需要连带后一页的单元格一并删除
        this.draw.removeLinkTd(originalElementList, td.linkTdNextId)
        d--
      }
      if (td.rowspan > 1) {
        // 补跨行
        const tdId = getUUID()
        const nextTr = trList[trIndex! + 1]
        nextTr.tdList.splice(d, 0, {
          id: tdId,
          rowspan: td.rowspan - 1,
          colspan: td.colspan,
          value: [
            {
              value: ZERO,
              size: 16,
              tableId: element.id,
              trId: nextTr.id,
              tdId
            }
          ]
        })
      }
    }
    // 删除当前行
    trList.splice(trIndex!, 1)
    this.draw.initTableElementIndex(element, index)
    // 重新设置上下文
    this.position.setPositionContext({
      isTable: false
    })
    this.range.clearRange()
    // 重新渲染
    this.draw.render()
    this.tableTool.dispose()
  }

  public deleteTableCol() {
    const positionContext = this.position.getPositionContext()
    if (!positionContext.isTable) return
    const { index, tdIndex, trIndex } = positionContext
    const originalElementList = this.draw.getOriginalElementList()
    const element = originalElementList[index!]
    const curTrList = element.trList!
    const curTd = curTrList[trIndex!].tdList[tdIndex!]
    const curColIndex = curTd.colIndex!
    const curColSpan = curTd.colspan
    const curColEnd = curColIndex + curColSpan - 1
    const { list, startIndex } = this.draw.getTablesByPagingId(
      originalElementList,
      element.pagingId!,
      index!
    )

    for (let i = 0; i < list.length; i++) {
      const table = list[i]
      // 删除colgroup
      table.colgroup?.splice(curColIndex, curColSpan)
      if (!table.colgroup?.length) {
        // 删除全部
        originalElementList.splice(startIndex, list.length)
        break
      }
      for (let trIndex = 0; trIndex < table.trList!.length; trIndex++) {
        const tr = table.trList![trIndex]
        for (let tdIndex = 0; tdIndex < tr.tdList.length; tdIndex++) {
          const td = tr.tdList[tdIndex]
          if (
            td.colIndex! <= curColEnd &&
            td.colIndex! + td.colspan > curColIndex
          ) {
            if (td.colspan > 1) {
              const span =
                curColEnd === curColIndex
                  ? 1
                  : Math.min(td.colIndex! + td.colspan - 1, curColEnd) -
                    Math.max(td.colIndex!, curColIndex) +
                    1
              if (span < td.colspan) {
                td.colspan -= span
                if (td.colIndex! >= curColIndex) {
                  td.value = []
                }
                continue
              }
            }
            // 全部删除
            tr.tdList.splice(tdIndex, 1)
            tdIndex--
          }
        }
      }
    }
    // 重新设置上下文
    this.position.setPositionContext({
      isTable: false
    })
    this.range.setRange(0, 0)
    // 重新渲染
    this.draw.render({
      curIndex: positionContext.index
    })
    this.tableTool.dispose()
  }

  public deleteTable() {
    const positionContext = this.position.getPositionContext()
    if (!positionContext.isTable) return
    const originalElementList = this.draw.getOriginalElementList()
    const tableElement = originalElementList[positionContext.index!]

    const { list, startIndex } = this.draw.getTablesByPagingId(
      originalElementList,
      tableElement.pagingId!,
      positionContext.index!
    )
    // 删除
    originalElementList.splice(startIndex, list.length)
    const curIndex = startIndex - 1
    this.position.setPositionContext({
      isTable: false,
      index: curIndex
    })
    this.range.setRange(curIndex, curIndex)
    this.draw.render({ curIndex })
    this.tableTool.dispose()
  }

  public mergeTableCell() {
    const positionContext = this.position.getPositionContext()
    if (!positionContext.isTable) return
    const {
      isCrossRowCol,
      startTdIndex,
      endTdIndex,
      startTrIndex,
      endTrIndex
    } = this.range.getRange()
    if (!isCrossRowCol) return
    const { index } = positionContext
    const originalElementList = this.draw.getOriginalElementList()
    const element = originalElementList[index!]
    const curTrList = element.trList!
    let startTd = curTrList[startTrIndex!].tdList[startTdIndex!]
    let endTd = curTrList[endTrIndex!].tdList[endTdIndex!]
    // 交换起始位置
    if (startTd.x! > endTd.x! || startTd.y! > endTd.y!) {
      // prettier-ignore
      [startTd, endTd] = [endTd, startTd]
    }
    const startColIndex = startTd.colIndex!
    const endColIndex = endTd.colIndex! + (endTd.colspan - 1)
    const startRowIndex = startTd.rowIndex!
    const endRowIndex = endTd.rowIndex! + (endTd.rowspan - 1)
    // 选区行列
    const rowCol: ITd[][] = []
    for (let t = 0; t < curTrList.length; t++) {
      const tr = curTrList[t]
      const tdList: ITd[] = []
      for (let d = 0; d < tr.tdList.length; d++) {
        const td = tr.tdList[d]
        const tdColIndex = td.colIndex!
        const tdRowIndex = td.rowIndex!
        if (
          tdColIndex >= startColIndex &&
          tdColIndex <= endColIndex &&
          tdRowIndex >= startRowIndex &&
          tdRowIndex <= endRowIndex
        ) {
          tdList.push(td)
        }
      }
      if (tdList.length) {
        rowCol.push(tdList)
      }
    }
    if (!rowCol.length) return
    // 是否是矩形
    const lastRow = rowCol[rowCol.length - 1]
    const leftTop = rowCol[0][0]
    const rightBottom = lastRow[lastRow.length - 1]
    const startX = leftTop.x!
    const startY = leftTop.y!
    const endX = rightBottom.x! + rightBottom.width!
    const endY = rightBottom.y! + rightBottom.height!
    for (let t = 0; t < rowCol.length; t++) {
      const tr = rowCol[t]
      for (let d = 0; d < tr.length; d++) {
        const td = tr[d]
        const tdStartX = td.x!
        const tdStartY = td.y!
        const tdEndX = tdStartX + td.width!
        const tdEndY = tdStartY + td.height!
        // 存在不符合项
        if (
          startX > tdStartX ||
          startY > tdStartY ||
          endX < tdEndX ||
          endY < tdEndY
        ) {
          return
        }
      }
    }
    // 合并单元格
    const mergeTdIdList: string[] = []
    const anchorTd = rowCol[0][0]
    const anchorElement = anchorTd.value[0]
    for (let t = 0; t < rowCol.length; t++) {
      const tr = rowCol[t]
      for (let d = 0; d < tr.length; d++) {
        const td = tr[d]
        const isAnchorTd = t === 0 && d === 0
        // 缓存待删除单元id并合并单元格内容
        if (!isAnchorTd) {
          mergeTdIdList.push(td.id!)
          const values = td.linkTdNextId
            ? this.draw.getSplitTdValues(td.id!) ?? []
            : td.value
          // 被合并单元格没内容时忽略换行符
          const startTdValueIndex = values.length > 1 ? 0 : 1
          // 复制表格属性后追加
          for (let d = startTdValueIndex; d < values.length; d++) {
            const tdElement = values[d]
            cloneProperty<IElement>(
              TABLE_CONTEXT_ATTR,
              anchorElement,
              tdElement
            )
            anchorTd.value.push(tdElement)
          }
        }
        // 列合并
        if (t === 0 && d !== 0) {
          anchorTd.colspan += td.colspan
        }
        // 行合并
        if (t !== 0) {
          if (anchorTd.colIndex === td.colIndex) {
            anchorTd.rowspan += td.rowspan
            if (anchorTd.originalId) {
              const originalTd = this.draw.getTdById(anchorTd.originalId)!
              originalTd.originalRowspan! += td.rowspan
            }
          }
        }
      }
    }
    // 移除多余单元格
    for (let t = 0; t < curTrList.length; t++) {
      const tr = curTrList[t]
      let d = 0
      while (d < tr.tdList.length) {
        const td = tr.tdList[d]
        if (mergeTdIdList.includes(td.id!)) {
          if (td.linkTdNextId) {
            this.draw.removeLinkTd(originalElementList, td.id!)
          } else {
            tr.tdList.splice(d, 1)
          }
          d--
        }
        d++
      }
    }
    // 设置上下文信息
    this.position.setPositionContext({
      ...positionContext,
      trIndex: anchorTd.trIndex,
      trId: anchorTd.trId,
      tdIndex: anchorTd.tdIndex,
      tdId: anchorTd.id
    })
    const curIndex = anchorTd.value.length - 1
    this.range.setRange(curIndex, curIndex)
    // 重新渲染
    this.draw.render()
    this.tableTool.render()
  }

  public cancelMergeTableCell() {
    const positionContext = this.position.getPositionContext()
    if (!positionContext.isTable) return
    const { index, tdIndex, trIndex } = positionContext
    const originalElementList = this.draw.getOriginalElementList()
    let element = originalElementList[index!]
    let curTrList = element.trList!
    let curTr = curTrList[trIndex!]!
    let curTd = curTr.tdList[tdIndex!]
    if (curTd.originalId) {
      curTd = this.draw.getTdById(curTd.originalId)!
      element = originalElementList[curTd.tableIndex!]
      curTrList = element.trList!
      curTr = curTrList[trIndex!]!
    }

    if (curTd.rowspan === 1 && curTd.colspan === 1) return
    const colspan = curTd.colspan
    // 设置跨列
    if (curTd.colspan > 1) {
      for (let c = 1; c < curTd.colspan; c++) {
        const tdId = getUUID()
        curTr.tdList.splice(tdIndex! + c, 0, {
          id: tdId,
          rowspan: 1,
          colspan: 1,
          value: [
            {
              value: ZERO,
              size: 16,
              tableId: element.id,
              trId: curTr.id,
              tdId
            }
          ]
        })
      }
      curTd.colspan = 1
    }
    // 设置跨行
    if (curTd.rowspan > 1) {
      for (let r = 1; r < curTd.rowspan; r++) {
        const tr = curTrList[trIndex! + r]
        for (let c = 0; c < colspan; c++) {
          const tdId = getUUID()
          tr.tdList.splice(curTd.tdIndex!, 0, {
            id: tdId,
            rowspan: 1,
            colspan: 1,
            value: [
              {
                value: ZERO,
                size: 16,
                tableId: element.id,
                trId: tr.id,
                tdId
              }
            ]
          })
        }
      }
      curTd.rowspan = 1
      curTd.originalRowspan = 1
    }
    // 重新渲染
    const curIndex = curTd.value.length - 1
    this.range.setRange(curIndex, curIndex)
    this.draw.render()
    this.tableTool.render()
  }

  public splitVerticalTableCell() {
    const positionContext = this.position.getPositionContext()
    if (!positionContext.isTable) return
    // 暂时忽略跨行列选择
    const range = this.range.getRange()
    if (range.isCrossRowCol) return
    const { index, tdIndex, trIndex } = positionContext
    const originalElementList = this.draw.getOriginalElementList()
    const element = originalElementList[index!]
    const curTrList = element.trList!
    const curTr = curTrList[trIndex!]!
    const curTd = curTr.tdList[tdIndex!]
    // 增加列属性
    element.colgroup!.splice(tdIndex! + 1, 0, {
      width: this.options.table.defaultColMinWidth
    })
    // 同行增加td，非同行增加跨列数
    for (let t = 0; t < curTrList.length; t++) {
      const tr = curTrList[t]
      let d = 0
      while (d < tr.tdList.length) {
        const td = tr.tdList[d]
        // 非同行：存在交叉时增加跨列数
        if (td.rowIndex !== curTd.rowIndex) {
          if (
            td.colIndex! <= curTd.colIndex! &&
            td.colIndex! + td.colspan > curTd.colIndex!
          ) {
            td.colspan++
          }
        } else {
          // 当前单元格：往右插入td
          if (td.id === curTd.id) {
            const tdId = getUUID()
            curTr.tdList.splice(d + curTd.colspan, 0, {
              id: tdId,
              rowspan: curTd.rowspan,
              colspan: 1,
              value: [
                {
                  value: ZERO,
                  size: 16,
                  tableId: element.id,
                  trId: tr.id,
                  tdId
                }
              ]
            })
            d++
          }
        }
        d++
      }
    }
    // 重新渲染
    this.draw.render()
    this.tableTool.render()
  }

  public splitHorizontalTableCell() {
    const positionContext = this.position.getPositionContext()
    if (!positionContext.isTable) return
    // 暂时忽略跨行列选择
    const range = this.range.getRange()
    if (range.isCrossRowCol) return
    const { index, tdIndex, trIndex } = positionContext
    const originalElementList = this.draw.getOriginalElementList()
    const element = originalElementList[index!]
    const curTrList = element.trList!
    const curTr = curTrList[trIndex!]!
    const curTd = curTr.tdList[tdIndex!]
    // 追加的行跳出循环
    let appendTrIndex = -1
    // 交叉行增加rowspan，当前单元格往下追加一行tr
    let t = 0
    while (t < curTrList.length) {
      if (t === appendTrIndex) {
        t++
        continue
      }
      const tr = curTrList[t]
      let d = 0
      while (d < tr.tdList.length) {
        const td = tr.tdList[d]
        if (td.id === curTd.id) {
          const trId = getUUID()
          const tdId = getUUID()
          curTrList.splice(t + curTd.rowspan, 0, {
            id: trId,
            height: this.options.table.defaultTrMinHeight,
            tdList: [
              {
                id: tdId,
                rowspan: 1,
                colspan: curTd.colspan,
                value: [
                  {
                    value: ZERO,
                    size: 16,
                    tableId: element.id,
                    trId,
                    tdId
                  }
                ]
              }
            ]
          })
          appendTrIndex = t + curTd.rowspan
        } else if (
          td.rowIndex! >= curTd.rowIndex! &&
          td.rowIndex! < curTd.rowIndex! + curTd.rowspan &&
          td.rowIndex! + td.rowspan >= curTd.rowIndex! + curTd.rowspan
        ) {
          // 1. 循环td上方大于等于当前td上方 && 小于当前td的下方=>存在交叉
          // 2. 循环td下方大于或等于当前td下方
          td.rowspan++
        }
        d++
      }
      t++
    }
    // 重新渲染
    this.draw.render()
    this.tableTool.render()
  }

  public tableTdVerticalAlign(payload: VerticalAlign) {
    const rowCol = this.tableParticle.getRangeRowCol()
    if (!rowCol) return
    for (let r = 0; r < rowCol.length; r++) {
      const row = rowCol[r]
      for (let c = 0; c < row.length; c++) {
        const td = row[c]
        if (
          !td ||
          td.verticalAlign === payload ||
          (!td.verticalAlign && payload === VerticalAlign.TOP)
        ) {
          continue
        }
        // 重设垂直对齐方式
        td.verticalAlign = payload
      }
    }
    const { endIndex } = this.range.getRange()
    this.draw.render({
      curIndex: endIndex
    })
  }

  public tableBorderType(payload: TableBorder) {
    const positionContext = this.position.getPositionContext()
    if (!positionContext.isTable) return
    const { index } = positionContext
    const originalElementList = this.draw.getOriginalElementList()
    const element = originalElementList[index!]
    if (
      (!element.borderType && payload === TableBorder.ALL) ||
      element.borderType === payload
    ) {
      return
    }
    element.borderType = payload
    const { endIndex } = this.range.getRange()
    this.draw.render({
      curIndex: endIndex
    })
  }

  public tableBorderColor(payload: string) {
    const positionContext = this.position.getPositionContext()
    if (!positionContext.isTable) return
    const { index } = positionContext
    const originalElementList = this.draw.getOriginalElementList()
    const element = originalElementList[index!]
    if (
      (!element.borderColor &&
        payload === this.options.table.defaultBorderColor) ||
      element.borderColor === payload
    ) {
      return
    }
    element.borderColor = payload
    const { endIndex } = this.range.getRange()
    this.draw.render({
      curIndex: endIndex,
      isCompute: false
    })
  }

  public tableTdBorderType(payload: TdBorder) {
    const rowCol = this.tableParticle.getRangeRowCol()
    if (!rowCol) return
    const tdList = rowCol.flat()
    // 存在则设置边框类型，否则取消设置
    const isSetBorderType = tdList.some(
      td => !td.borderTypes?.includes(payload)
    )
    tdList.forEach(td => {
      if (!td.borderTypes) {
        td.borderTypes = []
      }
      const borderTypeIndex = td.borderTypes.findIndex(type => type === payload)
      if (isSetBorderType) {
        if (!~borderTypeIndex) {
          td.borderTypes.push(payload)
        }
      } else {
        if (~borderTypeIndex) {
          td.borderTypes.splice(borderTypeIndex, 1)
        }
      }
      // 不存在边框设置时删除字段
      if (!td.borderTypes.length) {
        delete td.borderTypes
      }
    })
    const { endIndex } = this.range.getRange()
    this.draw.render({
      curIndex: endIndex
    })
  }

  public tableTdSlashType(payload: TdSlash) {
    const rowCol = this.tableParticle.getRangeRowCol()
    if (!rowCol) return
    const tdList = rowCol.flat()
    // 存在则设置单元格斜线类型，否则取消设置
    const isSetTdSlashType = tdList.some(
      td => !td.slashTypes?.includes(payload)
    )
    tdList.forEach(td => {
      if (!td.slashTypes) {
        td.slashTypes = []
      }
      const slashTypeIndex = td.slashTypes.findIndex(type => type === payload)
      if (isSetTdSlashType) {
        if (!~slashTypeIndex) {
          td.slashTypes.push(payload)
        }
      } else {
        if (~slashTypeIndex) {
          td.slashTypes.splice(slashTypeIndex, 1)
        }
      }
      // 不存在斜线设置时删除字段
      if (!td.slashTypes.length) {
        delete td.slashTypes
      }
    })
    const { endIndex } = this.range.getRange()
    this.draw.render({
      curIndex: endIndex
    })
  }

  public tableTdBackgroundColor(payload: string) {
    const rowCol = this.tableParticle.getRangeRowCol()
    if (!rowCol) return
    for (let r = 0; r < rowCol.length; r++) {
      const row = rowCol[r]
      for (let c = 0; c < row.length; c++) {
        const col = row[c]
        col.backgroundColor = payload
      }
    }
    const { endIndex } = this.range.getRange()
    this.range.setRange(endIndex, endIndex)
    this.draw.render({
      isCompute: false
    })
  }

  public tableSelectAll() {
    const positionContext = this.position.getPositionContext()
    const { index, tableId, isTable } = positionContext
    if (!isTable || !tableId) return
    const { startIndex, endIndex } = this.range.getRange()
    const originalElementList = this.draw.getOriginalElementList()
    const trList = originalElementList[index!].trList!
    // 最后单元格位置
    const endTrIndex = trList.length - 1
    const endTdIndex = trList[endTrIndex].tdList.length - 1
    this.range.replaceRange({
      startIndex,
      endIndex,
      tableId,
      startTdIndex: 0,
      endTdIndex,
      startTrIndex: 0,
      endTrIndex
    })
    this.draw.render({
      isCompute: false,
      isSubmitHistory: false
    })
  }
}
