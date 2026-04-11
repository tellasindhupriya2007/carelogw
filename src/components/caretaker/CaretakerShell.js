import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import ScreenHeader from '../common/ScreenHeader';
import CaretakerBottomNav from '../common/CaretakerBottomNav';
import Sidebar from '../common/Sidebar';
import { colors } from '../../styles/colors';
import { 
    HeartPulse, Pill, Activity, Mic, Bell, Clock, MessageSquare, LogOut, ChevronLeft
} from 'lucide-react';

export default function CaretakerShell({ children, title }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthContext();
    const [firstName, setFirstName] = useState('');
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 1024);
        window.addEventListener('resize', handleResize);
        if (user) {
            getDoc(doc(db, 'users', user.uid)).then(s => {
                if (s.exists()) setFirstName((s.data().name || 'User').split(' ')[0]);
            });
        }
        return () => window.removeEventListener('resize', handleResize);
    }, [user]);

    const navItems = [
        { icon: <HeartPulse size={18}/>, label: 'Dashboard', path: '/caretaker/dashboard' },
        { icon: <Pill size={18}/>, label: 'Prescriptions', path: '/caretaker/prescriptions' },
        { icon: <Activity size={18}/>, label: 'Vitals', path: '/caretaker/vitals' },
        { icon: <Mic size={18}/>, label: 'Observations', path: '/caretaker/observations' },
        { icon: <Bell size={18}/>, label: 'Alerts', path: '/caretaker/alerts' },
        { icon: <Clock size={18}/>, label: 'Shift Handover', path: '/caretaker/handover' },
        { icon: <MessageSquare size={18}/>, label: 'Messages', path: '/caretaker/messages' },
    ];

    const activeLabel = navItems.find(item => location.pathname.includes(item.path.split('/')[2]))?.label || 'Dashboard';

    return (
        <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', display: 'flex', overflow: 'hidden' }}>
            {/* DESKTOP SIDEBAR (FIXED) */}
            {!isMobile && (
                <div style={{ width: '280px', borderRight: '1px solid #EAECF0', backgroundColor: 'white', display: 'flex', flexDirection: 'column', height: '100vh' }}>
                    <div style={{ padding: '24px 32px', borderBottom: '1px solid #EAECF0' }}>
                        <div style={{ fontSize: '22px', fontWeight: '950', color: '#0052FF', letterSpacing: '-0.8px' }}>CareLog</div>
                    </div>
                    <div style={{ flex: 1, padding: '16px' }}>
                        {navItems.map(item => {
                            const isActive = location.pathname === item.path;
                            return (
                                <div 
                                    key={item.label} 
                                    onClick={() => navigate(item.path)}
                                    style={{ 
                                        padding: '14px 20px', borderRadius: '14px', marginBottom: '4px', cursor: 'pointer',
                                        backgroundColor: isActive ? '#F0F5FF' : 'transparent',
                                        color: isActive ? '#0052FF' : '#475467',
                                        display: 'flex', alignItems: 'center', gap: '14px',
                                        fontWeight: '850', fontSize: '15px',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <span style={{ opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                                    {item.label}
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ padding: '20px', borderTop: '1px solid #EAECF0' }}>
                        <div 
                            onClick={logout}
                            style={{ 
                                padding: '14px 20px', borderRadius: '14px', cursor: 'pointer',
                                color: '#D92D20', display: 'flex', alignItems: 'center', gap: '14px',
                                fontWeight: '850', fontSize: '15px'
                            }}
                        >
                            <LogOut size={18}/>
                            Sign Out
                        </div>
                    </div>
                </div>
            )}

            {/* MOBILE DRAWER SIDEBAR */}
            {isMobile && (
                <Sidebar 
                    navItems={navItems.map(n => ({ ...n, label: n.label, icon: n.label }))} // Compatibility with existing sidebar
                    isOpen={isSidebarOpen} 
                    onClose={() => setSidebarOpen(false)} 
                />
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                <ScreenHeader 
                    title={title || (isMobile ? `Morning, ${firstName}` : `Clinical Workspace — ${firstName}`)}
                    showMenuButton={isMobile}
                    onMenu={() => setSidebarOpen(true)}
                    rightIcon={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {!isMobile && (
                                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '900', color: '#101828' }}>{firstName}</span>
                                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#667085', textTransform: 'uppercase' }}>Primary Caretaker</span>
                                </div>
                            )}
                            <div onClick={() => navigate('/caretaker/alerts')} style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'white', border: '1px solid #EAECF0', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}>
                                <Bell size={20} color="#101828" />
                            </div>
                        </div>
                    }
                />

                <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
                    {children}
                </main>

                {isMobile && <CaretakerBottomNav activeTab={activeLabel} />}
            </div>
        </div>
    );
}
