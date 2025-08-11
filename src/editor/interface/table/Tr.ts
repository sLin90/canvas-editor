import { ITd } from './Td'

export interface ITr {
  id?: string
  extension?: unknown
  externalId?: string
  height: number
  tdList: ITd[]
  minHeight?: number
  pagingRepeat?: boolean // 在各页顶端以标题行的形式重复出现
  originalMinHeight?: number // 原始行最小高度
  originalId?: string // 原始行ID 代表当前行是分页时拆分出来的
}
