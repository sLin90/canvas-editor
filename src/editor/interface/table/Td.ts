import { VerticalAlign } from '../../dataset/enum/VerticalAlign'
import { TdBorder, TdSlash } from '../../dataset/enum/table/Table'
import { IElement, IElementPosition } from '../Element'
import { IRow } from '../Row'

export interface ITd {
  conceptId?: string
  id?: string
  extension?: unknown
  externalId?: string
  x?: number
  y?: number
  width?: number
  height?: number
  colspan: number
  rowspan: number
  value: IElement[]
  trIndex?: number
  tdIndex?: number
  isLastRowTd?: boolean
  isLastColTd?: boolean
  isLastTd?: boolean
  rowIndex?: number
  colIndex?: number
  rowList?: IRow[]
  positionList?: IElementPosition[]
  verticalAlign?: VerticalAlign
  backgroundColor?: string
  borderTypes?: TdBorder[]
  slashTypes?: TdSlash[]
  mainHeight?: number // 内容 + 内边距高度
  realHeight?: number // 真实高度（包含跨列）
  realMinHeight?: number // 真实最小高度（包含跨列）
  disabled?: boolean // 内容不可编辑
  deletable?: boolean // 内容不可删除
  originalId?: string // 原始单元格ID 代表当前单元格是分页时拆分出来的
  linkTdPrevId?: string // 连接单元格ID(前一个拆分段单元格)
  linkTdNextId?: string // 连接单元格ID(后一个拆分段单元格)
  originalRowspan?: number // 拆分前原始的跨行列数
  valueStartIndex?: number // 原始值拆分的开始索引
  tableIndex?: number // 表格在全局的索引
  tableId?: string
  trId?: string
}
