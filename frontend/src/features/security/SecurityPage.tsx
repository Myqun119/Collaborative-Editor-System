import { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { api } from '../../lib/api/client.ts'
import type { BackupStatus, DocumentItem } from '../../types'

const NOTIFY_EVENT = 'ces:notify'

const parseScheduleMinutes = (schedule?: string) => {
    if (!schedule) {
        return 30
    }
    const match = schedule.match(/(\d+)/)
    const minutes = Number(match?.[1] ?? '30')
    return Number.isFinite(minutes) && minutes > 0 ? minutes : 30
}

export const SecurityPage = () => {
    const [status, setStatus] = useState<BackupStatus | null>(null)
    const [docs, setDocs] = useState<DocumentItem[]>([])
    const [point, setPoint] = useState('')
    const [autoBackupCount, setAutoBackupCount] = useState(0)
    const autoBackupRunningRef = useRef(false)

    const notify = (message: string, durationMs = 3200) => {
        window.dispatchEvent(
            new CustomEvent(NOTIFY_EVENT, {
                detail: {
                    message,
                    durationMs,
                },
            }),
        )
    }

    const load = async () => {
        setStatus(await api.security.getBackupStatus())
        setDocs(await api.documents.list())
    }

    useEffect(() => {
        void load()
    }, [])

    useEffect(() => {
        if (!status?.lastBackupAt) {
            return
        }

        const scheduleMinutes = parseScheduleMinutes(status.schedule)
        const timer = window.setInterval(() => {
            if (autoBackupRunningRef.current) {
                return
            }

            const due = dayjs().diff(dayjs(status.lastBackupAt), 'minute') >= scheduleMinutes
            if (!due) {
                return
            }

            autoBackupRunningRef.current = true
            void (async () => {
                try {
                    const backup = await api.security.runBackup()
                    setStatus(backup)
                    setAutoBackupCount((count) => count + 1)
                    notify(`自动备份已触发：${dayjs(backup.lastBackupAt).format('HH:mm:ss')}`)
                } finally {
                    autoBackupRunningRef.current = false
                }
            })()
        }, 15_000)

        return () => {
            window.clearInterval(timer)
        }
    }, [status])

    return (
        <section className="page-grid two-col-layout">
            <article className="panel">
                <h2>
                    数据安全与备份
                    {autoBackupCount > 0 ? (
                        <small
                            style={{
                                marginLeft: '8px',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: 'rgba(79, 209, 197, 0.2)',
                                color: '#0f766e',
                                fontSize: '0.72em',
                            }}
                        >
                            自动备份 {autoBackupCount}
                        </small>
                    ) : null}
                </h2>
                <p>传输加密状态: {status?.encrypted ? '已启用 TLS/加密协议适配' : '未启用'}</p>
                <p>最近备份: {status ? dayjs(status.lastBackupAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</p>
                <p>定时策略: {status?.schedule}</p>
                <div className="actions">
                    <button
                        onClick={async () => {
                            const backup = await api.security.runBackup()
                            setStatus(backup)
                            notify('手动备份完成')
                        }}
                    >
                        立即备份
                    </button>
                </div>
                <div className="inline-actions">
                    <input value={point} onChange={(e) => setPoint(e.target.value)} placeholder="输入异常恢复点" />
                    <button
                        onClick={async () => {
                            if (!point) {
                                return
                            }
                            await api.security.recover(point)
                            notify('异常恢复流程已提交')
                        }}
                    >
                        恢复
                    </button>
                </div>
            </article>
            <article className="panel">
                <h3>多格式导出</h3>
                <ul className="doc-list">
                    {docs.map((doc) => (
                        <li key={doc.id}>
                            <strong>{doc.title}</strong>
                            <div className="line-actions">
                                <button onClick={() => void api.security.exportDocument(doc.id, 'docx')}>导出 DOCX</button>
                                <button onClick={() => void api.security.exportDocument(doc.id, 'pdf')}>导出 PDF</button>
                                <button onClick={() => void api.security.exportDocument(doc.id, 'md')}>导出 MD</button>
                            </div>
                        </li>
                    ))}
                </ul>
            </article>
        </section>
    )
}
