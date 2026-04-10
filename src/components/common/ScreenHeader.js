import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { ArrowLeft, LogOut, Menu } from 'lucide-react';
import { colors } from '../../styles/colors';

const roleColors = {
    family: { bg: '#EFF6FF', color: '#2D6BE4' },
    caretaker: { bg: '#F0FDF4', color: '#16A34A' },
    doctor: { bg: '#FFF7ED', color: '#EA580C' },
};

export default function ScreenHeader({ title, showBack, rightIcon, onBack, onMenu, showMenuButton }) {
    const navigate = useNavigate();
    const { user, role, photoURL, logout } = useAuthContext();
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };
        if (showMenu) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMenu]);

    const handleLogout = async () => {
        setShowMenu(false);
        await logout();
        navigate('/auth/splash', { replace: true });
    };

    const handleBack = () => {
        if (onBack) onBack();
        else navigate(-1);
    };

    const rc = roleColors[role] || roleColors.family;

    const ProfileAvatar = user ? (
        <div
            onClick={() => setShowMenu(!showMenu)}
            style={{ position: 'relative', cursor: 'pointer', zIndex: 20, marginLeft: '12px' }}
            ref={menuRef}
        >
            {photoURL ? (
                <img
                    src={photoURL}
                    alt="Profile"
                    style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        objectFit: 'cover', border: `2px solid ${colors.border}`
                    }}
                    referrerPolicy="no-referrer"
                />
            ) : (
                <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: colors.primaryBlue,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${colors.border}`
                }}>
                    <span style={{ color: colors.white, fontSize: '14px', fontWeight: '700' }}>
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                    </span>
                </div>
            )}

            {showMenu && (
                <div style={{
                    position: 'absolute', top: '40px', right: '0',
                    backgroundColor: colors.white, borderRadius: '12px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)', padding: '16px',
                    width: '240px', zIndex: 9999, border: `1px solid ${colors.border}`,
                    animation: 'fadeInDown 0.2s ease-out'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px', textAlign: 'left' }}>
                        <span style={{ fontSize: '15px', fontWeight: '600', color: colors.textPrimary }}>
                            {user.displayName || 'CareLog User'}
                        </span>
                        <span style={{ fontSize: '12px', color: colors.textSecondary, wordBreak: 'break-all' }}>
                            {user.email || ''}
                        </span>
                        {role && (
                            <span style={{
                                backgroundColor: rc.bg, color: rc.color,
                                padding: '4px 12px', borderRadius: '20px',
                                fontSize: '12px', fontWeight: '600',
                                display: 'inline-block', width: 'fit-content'
                            }}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                            </span>
                        )}
                    </div>
                    <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '12px' }}>
                        <button
                            onClick={handleLogout}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '8px 0', width: '100%', minHeight: '44px'
                            }}
                        >
                            <LogOut size={16} color={colors.alertRed} />
                            <span style={{ fontSize: '14px', fontWeight: '600', color: colors.alertRed }}>Log Out</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    ) : null;

    return (
        <header style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '64px',
            padding: '0 24px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: colors.white,
            position: 'sticky',
            top: 0,
            zIndex: 50,
            width: '100%',
            boxSizing: 'border-box'
        }}>
            {/* Left Box */}
            <div style={{ minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                {showBack && (
                    <button 
                        onClick={handleBack}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px',
                            margin: '-8px',
                            color: colors.textPrimary
                        }}
                    >
                        <ArrowLeft size={20} strokeWidth={2.5} />
                    </button>
                )}
                {showMenuButton && !showBack && (
                    <button 
                        onClick={onMenu}
                        className="mobile-only"
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px',
                            margin: '-8px',
                            color: colors.textPrimary
                        }}
                    >
                        <Menu size={20} strokeWidth={2.5} />
                    </button>
                )}
            </div>

            {/* Center Box (Flexible, Always Centered) */}
            <div style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
                <h1 style={{ 
                    margin: 0, 
                    fontSize: '17px', 
                    fontWeight: '800', 
                    color: colors.textPrimary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    letterSpacing: '-0.3px'
                }}> {title} </h1>
            </div>

            {/* Right Box */}
            <div style={{ minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                {rightIcon}
                {ProfileAvatar}
            </div>

            <style>{`
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </header>
    );
}
