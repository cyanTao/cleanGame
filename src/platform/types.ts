/** 平台能力抽象。引擎与 UI 只能通过此接口访问平台能力。 */
export interface Pointer {
  readonly x: number
  readonly y: number
}

export interface InputEvent {
  readonly type: 'down' | 'move' | 'up'
  readonly pointer: Pointer
  readonly id: number
}

export interface Size {
  readonly width: number
  readonly height: number
  readonly dpr: number
}

export interface SafeArea {
  readonly top: number
  readonly bottom: number
}

export interface Storage {
  get<T>(key: string): T | null
  set(key: string, value: unknown): void
}

export interface Platform {
  createCanvas(): HTMLCanvasElement
  size(): Size
  safeArea(): SafeArea
  /** 订阅输入事件流，返回取消订阅函数 */
  onInput(cb: (e: InputEvent) => void): () => void
  /** 订阅屏幕尺寸变化（地址栏收放/旋转），返回取消订阅函数；平台可缺省 */
  onResize?(cb: () => void): () => void
  loadAsset(url: string): Promise<ArrayBuffer>
  storage: Storage
}