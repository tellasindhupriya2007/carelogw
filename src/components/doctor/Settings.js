import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import DoctorShell from './DoctorShell';
import { LogOut, Save, User as UserIcon } from 'lucide-react';
import { colors } from '../../styles/colors';

const TOGGLE_ITEMS = [
    { key: 'criticalAlerts', label: 'Critical Alerts', desc: 'Real-time threshold breach alerts' },
    { key: 'missedMeds', label: 'Compliance Reports', desc: 'Reports of non-adherence' },
    { key: 'careLogUpdates', label: 'Operational Sync', desc: 'Daily care directive updates' },
    { key: 'familyMessages', label: 'Family Hub', desc: 'New message notifications' },
];

export default function DoctorSettings() {
    const navigate = useNavigate();
    const { user, logout } = useAuthContext();
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [saved, setSaved] = useState(false);
    const [toggles, setToggles] = useState({
        criticalAlerts: true, missedMeds: true, careLogUpdates: true, familyMessages: false
    });

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <DoctorShell alertCount={0}>
            <div className="clinical-page-container" style={{ padding: isMobile ? '16px' : '40px', maxWidth: '820px', margin: '0 auto' }}>
                <header style={{ marginBottom: '32px' }}>
                    <h1 style={{ fontWeight: '900', color: '#101828', fontSize: isMobile ? '24px' : '32px', letterSpacing: '-1px', margin: 0 }}>Institutional Settings</h1>
                    <p style={{ color: '#667085', fontSize: '14px', marginTop: '4px' }}>Configure your clinical oversight parameters.</p>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Identity Card */}
                    <section style={{ backgroundColor: 'white', borderRadius: '24px', padding: isMobile ? '20px' : '32px', border: '1px solid #EAECF0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0052FF' }} />
                            <span style={{ fontSize: '11px', fontWeight: '900', color: '#98A2B3', textTransform: 'uppercase', letterSpacing: '1px' }}>Practitioner Identity</span>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: '20px', marginBottom: '24px' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#F0F5FF', color: '#0052FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <UserIcon size={32} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: '#101828', wordBreak: 'break-word', lineHeight: 1.2 }}>Dr. {user?.displayName || 'Tella Sindhu Priya'}</div>
                                <div style={{ color: '#667085', fontSize: '13px', marginTop: '2px', fontWeight: '600' }}>{user?.email || 'practioner@carelog.health'}</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                            {[
                                { label: 'Assigned Hospital', value: 'CareLog Health Net' },
                                { label: 'Registry Licensing', value: 'MCI-2024-EX-V4' }
                            ].map((item, i) => (
                                <div key={i} style={{ padding: '14px 18px', backgroundColor: '#F9FAFB', borderRadius: '16px', border: '1px solid #F2F4F7' }}>
                                    <div style={{ fontSize: '10px', color: '#98A2B3', fontWeight: '900', textTransform: 'uppercase', marginBottom: '4px' }}>{item.label}</div>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1D2939' }}>{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Notification Toggles */}
                    <section style={{ backgroundColor: 'white', borderRadius: '24px', padding: isMobile ? '20px' : '32px', border: '1px solid #EAECF0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444' }} />
                            <span style={{ fontSize: '11px', fontWeight: '900', color: '#98A2B3', textTransform: 'uppercase', letterSpacing: '1px' }}>Oversight Alerts</span>
                        </div>
                        
                        {TOGGLE_ITEMS.map((item, idx) => (
                            <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: idx === TOGGLE_ITEMS.length - 1 ? 'none' : '1px solid #F2F4F7' }}>
                                <div style={{ paddingRight: '16px' }}>
                                    <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '800', color: '#1D2939' }}>{item.label}</div>
                                    <div style={{ fontSize: '12px', color: '#667085', marginTop: '2px' }}>{item.desc}</div>
                                </div>
                                <Toggle active={toggles[item.key]} onClick={() => setToggles(prev => ({ ...prev, [item.key]: !prev[item.key] }))} />
                            </div>
                        ))}
                    </section>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', marginTop: '8px' }}>
                        <button onClick={handleSave} style={{ flex: 1, height: '56px', backgroundColor: '#0052FF', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,82,255,0.2)' }}>
                            <Save size={20} /> {saved ? 'System Updated' : 'Commit Changes'}
                        </button>
                        <button onClick={async () => { await logout(); navigate('/auth/splash'); }} style={{ height: '56px', backgroundColor: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: '16px', fontWeight: '900', padding: '0 24px', cursor: 'pointer' }}>
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </DoctorShell>
    );
}

function Toggle({ active, onClick }) {
    return (
        <div 
            onClick={onClick}
            style={{ 
                width: '44px', height: '24px', borderRadius: '20px', 
                backgroundColor: active ? '#0052FF' : '#E2E8F0',
                position: 'relative', cursor: 'pointer', transition: '0.3s'
            }}
        >
            <div style={{ 
                position: 'absolute', top: '2px', left: active ? '22px' : '2px', 
                width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%',
                transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }} />
        </div>
    );
}
