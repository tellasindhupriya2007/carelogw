import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, Bell, FileText, Settings, HeartPulse, LogOut, MessageSquare } from 'lucide-react';
import { useAuthContext } from '../../context/AuthContext';

const iconMap = { Users, Bell, FileText, Settings, MessageSquare };

const items = [
    { icon: 'Users', label: 'Patients', path: '/doctor/dashboard' },
    { icon: 'Bell', label: 'Alerts', path: '/doctor/alerts' },
    { icon: 'MessageSquare', label: 'Messages', path: '/doctor/messages' },
    { icon: 'FileText', label: 'Reports', path: '/doctor/reports' },
    { icon: 'Settings', label: 'Settings', path: '/doctor/settings' },
];

export default function DoctorShell({ children, alertCount = 0 }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { logout, user } = useAuthContext();
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const titleMap = {
        '/doctor/dashboard': 'Clinical Hub',
        '/doctor/alerts': 'Alerts',
        '/doctor/messages': 'Messages',
        '/doctor/reports': 'Reports',
        '/doctor/settings': 'Settings'
    };
    const currentTitle = titleMap[pathname] || 'CareLog';

    return (
        <div style={{ 
            display: 'flex', 
            height: '100vh', 
            fontFamily: "'Inter', sans-serif", 
            overflow: 'hidden', 
            backgroundColor: '#ffffff', 
            flexDirection: isMobile ? 'column' : 'row',
            /* iOS SAFE AREA SUPPORT */
            paddingTop: isMobile ? 'env(safe-area-inset-top)' : '0'
        }}>
            {/* DESKTOP SIDEBAR */}
            {!isMobile && (
                <aside style={{
                    width: '240px', minWidth: '240px', backgroundColor: '#ffffff', borderRight: '1px solid #EAECF0', 
                    display: 'flex', flexDirection: 'column', padding: '24px 0', height: '100%'
                }}>
                    <div style={{ padding: '0 24px 32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', background: '#0052FF', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <HeartPulse size={18} color="white" strokeWidth={2.5} />
                            </div>
                            <span style={{ fontSize: '18px', fontWeight: '900', color: '#101828', letterSpacing: '-0.5px' }}>CareLog</span>
                        </div>
                    </div>

                    <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 12px' }}>
                        {items.map(item => {
                            const Icon = iconMap[item.icon];
                            const active = pathname === item.path || (item.path !== '/doctor/dashboard' && pathname.startsWith(item.path));
                            return (
                                <button key={item.path} onClick={() => navigate(item.path)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '10px', border: 'none', background: active ? '#0052FF15' : 'transparent', color: active ? '#0052FF' : '#475467', fontSize: '14px', fontWeight: active ? '700' : '600', cursor: 'pointer', transition: 'all 0.2s', width: '100%', textAlign: 'left' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {Icon && <Icon size={18} strokeWidth={active ? 2.5 : 2} />}
                                        {item.label}
                                    </div>
                                    {item.label === 'Alerts' && alertCount > 0 && <span style={{ backgroundColor: '#D92D20', color: '#ffffff', borderRadius: '6px', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '900' }}>{alertCount > 9 ? '9+' : alertCount}</span>}
                                </button>
                            );
                        })}
                    </nav>

                    <div style={{ padding: '20px 12px 0', borderTop: '1px solid #EAECF0' }}>
                        <button onClick={async () => { if (logout) await logout(); navigate('/auth/splash', { replace: true }); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '10px', border: 'none', background: '#FEF3F2', color: '#B42318', fontSize: '13px', fontWeight: '800', cursor: 'pointer', width: '100%' }}><LogOut size={16} /> Sign Out</button>
                    </div>
                </aside>
            )}

            {/* MOBILE HEADER */}
            {isMobile && (
                <header style={{ 
                    height: '56px', backgroundColor: '#ffffff', borderBottom: '1px solid #EAECF0', 
                    display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between', 
                    zIndex: 100 
                }}>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: '#101828', letterSpacing: '-0.5px' }}>{currentTitle}</span>
                    <HeartPulse size={20} color="#0052FF" strokeWidth={3} />
                </header>
            )}

            <main style={{ 
                flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', 
                backgroundColor: '#ffffff', 
                /* LEAVE SPACE FOR BOTTOM NAV ON MOBILE */
                paddingBottom: isMobile ? 'calc(72px + env(safe-area-inset-bottom))' : '0' 
            }}>
                {children}
            </main>

            {/* HIGH-FIDELITY MOBILE BOTTOM TAB BAR */}
            {isMobile && (
                <nav style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(20px)',
                    borderTop: '1px solid #EAECF0', height: 'calc(64px + env(safe-area-inset-bottom))',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-around', 
                    paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 1000
                }}>
                    {items.map(item => {
                        const Icon = iconMap[item.icon];
                        const active = pathname === item.path || (item.path !== '/doctor/dashboard' && pathname.startsWith(item.path));
                        return (
                            <button key={item.path} onClick={() => navigate(item.path)} style={{ 
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', 
                                padding: '8px', border: 'none', background: 'none', flex: 1,
                                color: active ? '#0052FF' : '#94A3B8', transition: 'all 0.2s'
                            }}>
                                <div style={{ position: 'relative' }}>
                                    {Icon && <Icon size={22} strokeWidth={active ? 2.5 : 2} />}
                                    {item.label === 'Alerts' && alertCount > 0 && <span style={{ position: 'absolute', top: '-4px', right: '-8px', backgroundColor: '#D92D20', color: 'white', borderRadius: '50%', width: '14px', height: '14px', fontSize: '8px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{alertCount > 9 ? '!' : alertCount}</span>}
                                </div>
                                <span style={{ fontSize: '10px', fontWeight: '800' }}>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            )}
        </div>
    );
}
