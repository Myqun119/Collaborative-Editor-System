import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api/client.ts'
import { useAuthStore } from '../../store/authStore'
import { usePreferenceStore } from '../../store/preferenceStore'

const loginSchema = z.object({
    account: z.string().min(3, '请输入账号或邮箱'),
    password: z.string().min(6, '密码至少 6 位'),
})

const registerSchema = z.object({
    username: z.string().min(3, '用户名至少 3 位'),
    email: z.email('请输入正确邮箱'),
    password: z.string().min(6, '密码至少 6 位'),
})

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

export const AuthPage = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const [mode, setMode] = useState<'login' | 'register'>('login')
    const [message, setMessage] = useState('')
    const setSession = useAuthStore((state) => state.setSession)
    const setPreference = usePreferenceStore((state) => state.setPreference)
    const redirectTarget = useMemo(() => {
        const from = (location.state as { from?: string } | null)?.from
        return from && from.startsWith('/app') ? from : '/app/documents'
    }, [location.state])

    useEffect(() => {
        const reason = (location.state as { reason?: string } | null)?.reason
        if (reason === 'expired') {
            setMessage('登录状态已过期，请重新登录')
        }
    }, [location.state])

    const loginForm = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            account: 'admin',
            password: '123456',
        },
    })

    const registerForm = useForm<RegisterForm>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            username: '',
            email: '',
            password: '',
        },
    })

    const doLogin = loginForm.handleSubmit(async (values) => {
        try {
            const result = await api.auth.login(values)
            setSession(result.token, result.user)
            setPreference(result.user.preferences)
            navigate(redirectTarget, { replace: true })
        } catch (error) {
            setMessage(error instanceof Error ? error.message : '登录失败')
        }
    })

    const doRegister = registerForm.handleSubmit(async (values) => {
        try {
            await api.auth.register(values)
            setMessage('注册成功，请登录')
            setMode('login')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : '注册失败')
        }
    })

    return (
        <div className="auth-page">
            <div className="auth-panel">
                <h1>在线协同编辑器</h1>
                <p>覆盖用户、文档、实时协作、版本与权限全链路前端能力</p>
                <div className="switcher">
                    <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
                        登录
                    </button>
                    <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
                        注册
                    </button>
                </div>
                {mode === 'login' ? (
                    <form className="form" onSubmit={doLogin}>
                        <label>
                            账号
                            <input {...loginForm.register('account')} placeholder="用户名或邮箱" />
                            <span>{loginForm.formState.errors.account?.message}</span>
                        </label>
                        <label>
                            密码
                            <input type="password" {...loginForm.register('password')} placeholder="至少 6 位" />
                            <span>{loginForm.formState.errors.password?.message}</span>
                        </label>
                        <button type="submit">登录并进入工作台</button>
                    </form>
                ) : (
                    <form className="form" onSubmit={doRegister}>
                        <label>
                            用户名
                            <input {...registerForm.register('username')} />
                            <span>{registerForm.formState.errors.username?.message}</span>
                        </label>
                        <label>
                            邮箱
                            <input {...registerForm.register('email')} />
                            <span>{registerForm.formState.errors.email?.message}</span>
                        </label>
                        <label>
                            密码
                            <input type="password" {...registerForm.register('password')} />
                            <span>{registerForm.formState.errors.password?.message}</span>
                        </label>
                        <button type="submit">提交注册</button>
                    </form>
                )}
                {message ? <p className="message">{message}</p> : null}
            </div>
        </div>
    )
}
