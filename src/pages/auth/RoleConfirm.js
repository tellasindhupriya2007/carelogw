import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import logo from '../../assets/logo.png';

const roleConfig = {
    family: { label: 'Family Member', bg: '#EFF6FF', color: '#2D6BE4' },
    caretaker: { label: 'Caretaker', bg: '#F0FDF4', color: '#16A34A' },
    doctor: { label: 'Doctor', bg: '#FFF7ED', color: '#EA580C' },
};

export default function RoleConfirmScreen() {
    const navigate = useNavigate();
    const location = useLocation();
    const { signInWithGoogle, devLogin } = useAuthContext();

    const selectedRole = location.state?.role || 'family';
    const config = roleConfig[selectedRole] || roleConfig.family;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError('');
        try {
            const { isNewUser, userRole, userPatientId } = await signInWithGoogle(selectedRole);
            routeUser(isNewUser, userRole, userPatientId);
        } catch (err) {
            console.error('Google Sign In Error:', err);
            // Show the specific error message for debugging (e.g., auth/unauthorized-domain)
            setError(err.message || 'Sign in failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };
    
    const handleDevLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const { isNewUser, userRole, userPatientId } = await devLogin(selectedRole);
            routeUser(isNewUser, userRole, userPatientId);
        } catch (err) {
            console.error('Dev Login Error:', err);
            setError('Dev Login failed.');
        } finally {
            setLoading(false);
        }
    };

    const routeUser = (isNewUser, userRole, userPatientId) => {
        if (!isNewUser) {
            if (userRole === 'family') navigate('/family/dashboard', { replace: true });
            else if (userRole === 'caretaker') navigate('/caretaker/dashboard', { replace: true });
            else if (userRole === 'doctor') navigate('/doctor/dashboard', { replace: true });
            else navigate('/auth/splash', { replace: true });
        } else {
            if (selectedRole === 'family') navigate('/family/onboarding/step-1', { replace: true });
            else if (selectedRole === 'caretaker') navigate('/caretaker/dashboard', { replace: true });
            else if (selectedRole === 'doctor') navigate('/doctor/dashboard', { replace: true });
            else navigate('/auth/splash', { replace: true });
        }
    };

    return (
        <div className="auth-desktop-container" style={{ 
            background: 'linear-gradient(to bottom right, #f8fafc, #eef2ff)',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div className="auth-desktop-card" style={{ 
                backgroundColor: '#ffffff', 
                padding: '48px 40px', 
                borderRadius: '24px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                border: '1px solid rgba(0,0,0,0.03)',
                width: '90%',
                maxWidth: '440px',
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>

                    {/* Logo & Brand */}
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <img 
                            src={logo} 
                            alt="CareLog Logo" 
                            style={{ 
                                width: '120px', 
                                height: 'auto', 
                                objectFit: 'contain', 
                                marginBottom: '16px',
                                mixBlendMode: 'multiply'
                            }} 
                        />
                        <h1 style={{ fontSize: '32px', fontWeight: '600', color: '#0F172A', letterSpacing: '-0.5px', marginBottom: '8px' }}>CareLog</h1>
                        <p style={{ fontSize: '15px', color: '#64748B' }}>Caring made simple</p>
                    </div>

                    {/* Role Badge */}
                    <div style={{
                        backgroundColor: '#DCFCE7',
                        color: '#166534',
                        padding: '6px 14px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        fontWeight: '600',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        border: '1px solid rgba(22, 101, 52, 0.1)'
                    }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#166534', display: 'inline-block' }} />
                        {config.label}
                    </div>

                    {/* Google Sign In Button */}
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            className="primary-login-btn"
                            style={{
                                width: '100%',
                                minHeight: '52px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #E2E8F0',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                opacity: loading ? 0.7 : 1,
                            }}
                        >
                            {loading ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div className="btn-spinner" />
                                    <span style={{ fontSize: '15px', fontWeight: '600', color: '#1E293B' }}>Signing in…</span>
                                </div>
                            ) : (
                                <>
                                    <svg width="20" height="20" viewBox="0 0 48 48">
                                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                        <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.9 23.9 0 000 24c0 3.77.9 7.34 2.44 10.53l8.09-5.94z" />
                                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                                    </svg>
                                    <span style={{ fontSize: '15px', fontWeight: '600', color: '#1E293B' }}>Continue with Google</span>
                                </>
                            )}
                        </button>

                        {error && (
                            <div style={{
                                backgroundColor: '#FEF2F2', padding: '12px', borderRadius: '10px',
                                border: '1px solid #FEE2E2', textAlign: 'center'
                            }}>
                                <span style={{ fontSize: '13px', color: '#991B1B', fontWeight: '500' }}>{error}</span>
                            </div>
                        )}

                        <p style={{ fontSize: '13px', color: '#94A3B8', textAlign: 'center', lineHeight: '1.5' }}>
                            Secure authentication powered by Google Cloud.
                        </p>

                        <button
                            onClick={handleDevLogin}
                            style={{
                                width: '100%',
                                padding: '10px',
                                backgroundColor: '#F1F5F9',
                                border: '1px dashed #CBD5E1',
                                borderRadius: '8px',
                                color: '#64748B',
                                fontSize: '13px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                marginTop: '10px'
                            }}
                        >
                            🛠️ Dev Mode: Skip Login
                        </button>
                    </div>

                    {/* Back link */}
                    <button
                        onClick={() => navigate('/auth/splash')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#64748B', fontWeight: '500', transition: 'color 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#2563EB'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#64748B'}
                    >
                        ← Back to roles
                    </button>
                </div>

                <style>{`
                    .primary-login-btn:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 6px 16px rgba(0,0,0,0.06);
                        border-color: #CBD5E1;
                    }
                    .btn-spinner {
                        width: 18px; height: 18px; border: 2px solid #E2E8F0;
                        border-top: 2px solid #2563EB; borderRadius: 50%;
                        animation: spin 0.8s linear infinite;
                    }
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </div>
        </div>
    );
}
