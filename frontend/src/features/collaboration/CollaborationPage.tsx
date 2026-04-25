import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { collabSocket } from '../../lib/ws/collabSocket'
import type { CollabEvent } from '../../lib/ws/collabSocket'
import { api } from '../../lib/api/client.ts'
import { useDocStore } from '../../store/docStore'
import { useAuthStore } from '../../store/authStore'
import type { CommentItem } from '../../types'

const members = [
    { userId: '1', username: 'lin', color: '#ff7a59', cursor: 122, online: true },
    { userId: '2', username: 'yue', color: '#4fd1c5', cursor: 89, online: true },
]

export const CollaborationPage = () => {
    const doc = useDocStore((state) => state.currentDoc)
    const user = useAuthStore((state) => state.currentUser)
    const [events, setEvents] = useState<CollabEvent[]>([])
    const [comments, setComments] = useState<CommentItem[]>([])
    const [draft, setDraft] = useState('')

    const documentId = useMemo(() => doc?.id ?? 'doc-1', [doc?.id])

    const loadComments = async () => {
        const list = await api.collaboration.listComments(documentId)
        setComments(list)
    }

    useEffect(() => {
        collabSocket.connect('wss://api.example.com/collab')
        const unsubscribe = collabSocket.onEvent((event) => {
            setEvents((prev) => [event, ...prev].slice(0, 8))
        })
        return () => unsubscribe()
    }, [])

    useEffect(() => {
        void loadComments()
    }, [documentId])

    return (
        <section className="page-grid two-col-layout">
            <article className="panel">
                <h2>实时协同状态</h2>
                <p>当前文档: {documentId}</p>
                <ul className="presence-list">
                    {members.map((member) => (
                        <li key={member.userId}>
                            <span style={{ backgroundColor: member.color }} />
                            {member.username} · 光标 {member.cursor} · {member.online ? '在线' : '离线'}
                        </li>
                    ))}
                </ul>
                <button
                    onClick={() =>
                        collabSocket.emit({
                            type: 'notification',
                            message: `${user?.username ?? '访客'} 发布了协同通知`,
                        })
                    }
                >
                    发送协同事件
                </button>
                <div className="event-feed">
                    {events.map((event, index) => (
                        <p key={`${event.type}-${index}`}>
                            {event.type === 'notification'
                                ? `通知: ${event.message}`
                                : event.type === 'cursor'
                                    ? `光标: ${event.user}`
                                    : `编辑广播(${event.op === 'input' ? '输入' : '格式'}): ${event.user} @ ${event.documentId} ${event.preview}`}
                        </p>
                    ))}
                </div>
            </article>
            <article className="panel">
                <h3>批注评论</h3>
                <div className="inline-actions">
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="输入批注内容" />
                    <button
                        onClick={async () => {
                            if (!draft.trim()) {
                                return
                            }
                            await api.collaboration.addComment(documentId, user?.username ?? 'guest', draft)
                            setDraft('')
                            await loadComments()
                        }}
                    >
                        添加批注
                    </button>
                </div>
                <ul className="comment-list">
                    {comments.map((comment) => (
                        <li key={comment.id}>
                            <div className="comment-head">
                                <strong>{comment.author}</strong>
                                <small>{dayjs(comment.createdAt).format('MM-DD HH:mm')}</small>
                            </div>
                            <p>{comment.content}</p>
                            <div className="line-actions">
                                <button
                                    onClick={async () => {
                                        const reply = window.prompt('输入回复内容')
                                        if (reply) {
                                            await api.collaboration.reply(comment.id, user?.username ?? 'guest', reply)
                                            await loadComments()
                                        }
                                    }}
                                >
                                    回复
                                </button>
                                <button
                                    onClick={async () => {
                                        await api.collaboration.remove(comment.id)
                                        await loadComments()
                                    }}
                                >
                                    删除
                                </button>
                            </div>
                            {comment.replies.map((reply) => (
                                <small key={reply.id}>
                                    {reply.author}: {reply.content}
                                </small>
                            ))}
                        </li>
                    ))}
                </ul>
            </article>
        </section>
    )
}
