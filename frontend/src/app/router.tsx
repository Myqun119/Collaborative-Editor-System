import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProviders } from './providers/AppProviders'
import { MainLayout } from './layout/MainLayout'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { AuthPage } from '../features/auth/AuthPage'
import { UserManagePage } from '../features/auth/UserManagePage'
import { DocumentPage } from '../features/documents/DocumentPage'
import { CollaborationPage } from '../features/collaboration/CollaborationPage'
import { VersionPage } from '../features/versions/VersionPage'
import { PermissionPage } from '../features/permissions/PermissionPage'
import { SecurityPage } from '../features/security/SecurityPage'
import { AdminPage } from '../features/admin/AdminPage'

export const AppRouter = () => {
    return (
        <AppProviders>
            <BrowserRouter>
                <Routes>
                    <Route path="/auth" element={<AuthPage />} />
                    <Route
                        path="/app"
                        element={
                            <ProtectedRoute>
                                <MainLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<Navigate to="documents" replace />} />
                        <Route path="user" element={<UserManagePage />} />
                        <Route path="documents" element={<DocumentPage />} />
                        <Route path="collaboration" element={<CollaborationPage />} />
                        <Route path="versions" element={<VersionPage />} />
                        <Route path="permissions" element={<PermissionPage />} />
                        <Route path="security" element={<SecurityPage />} />
                        <Route path="admin" element={<AdminPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/auth" replace />} />
                </Routes>
            </BrowserRouter>
        </AppProviders>
    )
}
