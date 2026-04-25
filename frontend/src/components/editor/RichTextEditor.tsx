import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useDocStore } from '../../store/docStore'
import { collabSocket } from '../../lib/ws/collabSocket'

interface RichTextEditorProps {
    content: string
    onChange: (value: string) => void
    editable?: boolean
}

export const RichTextEditor = ({ content, onChange, editable = true }: RichTextEditorProps) => {
    const user = useAuthStore((state) => state.currentUser)
    const currentDoc = useDocStore((state) => state.currentDoc)
    const previousHtmlRef = useRef(content)

    const getText = (value: string) => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: '输入文档内容，支持多人协同编辑...',
            }),
        ],
        content,
        editorProps: {
            attributes: {
                class: 'tiptap',
            },
        },
        onUpdate: ({ editor: activeEditor }) => {
            const html = activeEditor.getHTML()
            const previousHtml = previousHtmlRef.current
            const previousText = getText(previousHtml)
            const nextText = getText(html)

            onChange(html)

            if (previousHtml !== html) {
                const op: 'input' | 'format' = previousText !== nextText ? 'input' : 'format'
                collabSocket.emit({
                    type: 'editor-op',
                    user: user?.username ?? 'guest',
                    documentId: currentDoc?.id ?? 'doc-unknown',
                    op,
                    preview: nextText.slice(0, 60),
                    html,
                    at: new Date().toISOString(),
                })
                previousHtmlRef.current = html
            }
        },
        editable,
        immediatelyRender: false,
    })

    useEffect(() => {
        if (editor && editor.getHTML() !== content) {
            editor.commands.setContent(content, { emitUpdate: false })
        }
        previousHtmlRef.current = content
    }, [content, editor])

    useEffect(() => {
        if (editor) {
            editor.setEditable(editable)
        }
    }, [editable, editor])

    if (!editor) {
        return null
    }

    return (
        <div className="editor-wrap">
            <div className="toolbar">
                <button type="button" disabled={!editable} onClick={() => editor.chain().focus().toggleBold().run()}>
                    粗体
                </button>
                <button type="button" disabled={!editable} onClick={() => editor.chain().focus().toggleItalic().run()}>
                    斜体
                </button>
                <button type="button" disabled={!editable} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                    列表
                </button>
                <button type="button" disabled={!editable} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                    H2
                </button>
            </div>
            <EditorContent editor={editor} />
        </div>
    )
}
