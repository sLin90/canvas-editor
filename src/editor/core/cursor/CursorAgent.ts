import { EDITOR_PREFIX } from '../../dataset/constant/Editor'
import { EventBusMap } from '../../interface/EventBus'
import { Draw } from '../draw/Draw'
import { CanvasEvent } from '../event/CanvasEvent'
import { EventBus } from '../event/eventbus/EventBus'
import { pasteByEvent } from '../event/handlers/paste'

export class CursorAgent {
  private draw: Draw
  private container: HTMLDivElement
  private agentCursorDom: HTMLTextAreaElement
  private canvasEvent: CanvasEvent
  private eventBus: EventBus<EventBusMap>

  constructor(draw: Draw, canvasEvent: CanvasEvent) {
    this.draw = draw
    this.container = draw.getContainer()
    this.canvasEvent = canvasEvent
    this.eventBus = draw.getEventBus()
    // 代理光标绘制
    const agentCursorDom = document.createElement('textarea')
    agentCursorDom.autocomplete = 'off'
    agentCursorDom.classList.add(`${EDITOR_PREFIX}-inputarea`)
    agentCursorDom.innerText = ''
    this.container.append(agentCursorDom)
    this.agentCursorDom = agentCursorDom
    // 事件
    agentCursorDom.onkeydown = (evt: KeyboardEvent) => this._keyDown(evt)
    agentCursorDom.oninput = this._input.bind(this)
    agentCursorDom.onpaste = (evt: ClipboardEvent) => this._paste(evt)
    agentCursorDom.addEventListener(
      'compositionstart',
      this._compositionstart.bind(this)
    )
    agentCursorDom.addEventListener(
      'compositionupdate',
      this._compositionupdate.bind(this)
    )
    agentCursorDom.addEventListener(
      'compositionend',
      this._compositionend.bind(this)
    )
    this.eventBus.on("rangeStyleChange",(payload)=>{
      // 监听当前选中字体大小 动态修改代理光标字体大小
      this.agentCursorDom.style.fontSize = Math.max(payload.size,18) + 'px';
    })
  }

  public getAgentCursorDom(): HTMLTextAreaElement {
    return this.agentCursorDom
  }

  private _keyDown(evt: KeyboardEvent) {
    this.canvasEvent.keydown(evt)
  }

  private _input(evt: Event) {
    const data = (<InputEvent>evt).data
    if (data) {
      this.canvasEvent.input(data)
    }
    if (this.eventBus.isSubscribe('input')) {
      this.eventBus.emit('input', evt)
    }
  }

  private _paste(evt: ClipboardEvent) {
    const isReadonly = this.draw.isReadonly()
    if (isReadonly) return
    const clipboardData = evt.clipboardData
    if (!clipboardData) return
    pasteByEvent(this.canvasEvent, evt)
    evt.preventDefault()
  }

  private _compositionstart() {
    this.agentCursorDom.style.zIndex = "1000"
    this.agentCursorDom.style.width = '0px';
    this.canvasEvent.compositionstart()
  }
  private _compositionupdate() {
    this.agentCursorDom.style.width = this.agentCursorDom.scrollWidth + 'px';
  }

  private _compositionend(evt: CompositionEvent) {
    this.agentCursorDom.style.zIndex = "-1"
    this.canvasEvent.compositionend(evt)
  }
}
