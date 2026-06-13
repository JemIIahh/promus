import type { PromusEvent } from './types'

/**
 * Minimal in-memory FIFO queue. Async-iterable so consumers `for await` over
 * incoming events. Enqueue resolves immediately; dequeue awaits the next event.
 */
export class EventQueue {
  private buffer: PromusEvent[] = []
  private waiters: Array<(ev: PromusEvent) => void> = []
  private closed = false

  enqueue(ev: PromusEvent): void {
    if (this.closed) throw new Error('EventQueue closed')
    const w = this.waiters.shift()
    if (w) {
      w(ev)
      return
    }
    this.buffer.push(ev)
  }

  async dequeue(): Promise<PromusEvent> {
    const head = this.buffer.shift()
    if (head) return head
    if (this.closed) throw new Error('EventQueue closed')
    return new Promise<PromusEvent>(resolve => {
      this.waiters.push(resolve)
    })
  }

  /** Close and wake all waiters with error. */
  close(): void {
    this.closed = true
    for (const w of this.waiters) {
      Promise.resolve().then(() => w({} as PromusEvent))
    }
    this.waiters = []
  }

  get length(): number {
    return this.buffer.length
  }

  get isClosed(): boolean {
    return this.closed
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<PromusEvent> {
    while (!this.closed) {
      try {
        yield await this.dequeue()
      } catch {
        return
      }
    }
  }
}

let counter = 0
export function newEventId(): string {
  counter += 1
  return `${Date.now().toString(36)}-${counter.toString(36)}`
}
