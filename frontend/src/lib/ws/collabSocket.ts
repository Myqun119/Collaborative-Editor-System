import { io, Socket } from 'socket.io-client'

export type CollabEvent =
    | { type: 'cursor'; user: string; position: number }
    | { type: 'notification'; message: string }
    | {
        type: 'editor-op'
        user: string
        documentId: string
        op: 'input' | 'format'
        preview: string
        html: string
        at: string
    }

class CollabSocketClient {
    private socket: Socket | null = null
    private listeners: Array<(event: CollabEvent) => void> = []

    connect(endpoint: string) {
        if (this.socket) {
            return
        }
        try {
            this.socket = io(endpoint, {
                transports: ['websocket'],
                autoConnect: true,
            })

            this.socket.on('collab:event', (event: CollabEvent) => {
                this.listeners.forEach((listener) => listener(event))
            })
        } catch {
            this.mockPulse()
        }
    }

    onEvent(listener: (event: CollabEvent) => void) {
        this.listeners.push(listener)
        return () => {
            this.listeners = this.listeners.filter((item) => item !== listener)
        }
    }

    emit(event: CollabEvent) {
        this.socket?.emit('collab:event', event)
        this.listeners.forEach((listener) => listener(event))
    }

    private mockPulse() {
        window.setInterval(() => {
            const event: CollabEvent = {
                type: 'notification',
                message: `同步信号 ${new Date().toLocaleTimeString()}`,
            }
            this.listeners.forEach((listener) => listener(event))
        }, 10000)
    }
}

export const collabSocket = new CollabSocketClient()
