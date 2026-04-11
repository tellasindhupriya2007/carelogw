import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import DoctorShell from './DoctorShell';
import { Bell, AlertTriangle, Clock } from 'lucide-react';

const SEVERITY_TABS = ['All', 'Critical', 'Warning', 'Resolved'];

export default function DoctorAlerts() {
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!user?.uid) return;
        const q = query(collection(db, 'alerts'), where('doctorId', '==', user.uid));
        return onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
                const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                return dateB - dateA;
            });
            setAlerts(data);
            setLoading(false);
        });
    }, [user?.uid]);

    const handleResolve = async (alertId) => {
        await updateDoc(doc(db, 'alerts', alertId), { isRead: true, status: 'resolved' });
    };

    const filtered = alerts.filter(a => {
        if (activeTab === 'All') return a.status !== 'resolved';
        if (activeTab === 'Resolved') return a.status === 'resolved';
        return a.severity === activeTab.toLowerCase() && a.status !== 'resolved';
    });

    const stats = [
        { label: 'All', value: alerts.filter(a => a.status !== 'resolved').length, color: '#0052FF' },
        { label: 'Critical', value: alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length, color: '#D92D20' },
        { label: 'Warning', value: alerts.filter(a => a.severity === 'warning' && a.status !== 'resolved').length, color: '#F79009' }
    ];

    return (
        <DoctorShell alertCount={alerts.filter(a => !a.isRead && a.status !== 'resolved').length}>
            <div style={{ 
                width: '100%', 
                height: '100%', 
                overflowY: 'auto', 
                backgroundColor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <div style={{ 
                    padding: isMobile ? '16px 14px' : '40px', 
                    width: '100%',
                    maxWidth: '1200px', 
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    
                    <header style={{ marginBottom: isMobile ? '20px' : '32px', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <div style={{ width: '12px', height: '2px', backgroundColor: '#0052FF' }}></div>
                            <span style={{ fontSize: '11px', fontWeight: '900', color: '#0052FF', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Clinical Monitoring Center</span>
                        </div>
                        <h1 style={{ fontSize: isMobile ? '24px' : '36px', fontWeight: '1000', color: '#101828', margin: 0, letterSpacing: '-1.5px' }}>Diagnostic Board</h1>
                    </header>

                {/* Metric Filter Cards - Guaranteed Identical Dimensions */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px', width: '100%' }}>
                    {stats.map((s, i) => {
                        const active = activeTab === s.label;
                        return (
                            <div 
                                key={i} 
                                onClick={() => setActiveTab(s.label)}
                                style={{ 
                                    background: active ? '#0052FF' : 'white', 
                                    padding: isMobile ? '16px 12px' : '24px 20px', 
                                    borderRadius: '16px', 
                                    border: active ? '2.5px solid #0052FF' : '1.5px solid #EAECF0',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease-in-out',
                                    boxShadow: active ? '0 8px 20px rgba(0, 82, 255, 0.2)' : 'none',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    minHeight: isMobile ? '80px' : '100px'
                                }}
                            >
                                <div style={{ fontSize: isMobile ? '22px' : '32px', fontWeight: '950', color: active ? 'white' : s.color, lineHeight: 1 }}>{s.value}</div>
                                <div style={{ fontSize: '10px', fontWeight: '900', color: active ? 'rgba(255,255,255,0.8)' : '#667085', textTransform: 'uppercase', marginTop: '6px', letterSpacing: '0.5px' }}>{s.label}</div>
                            </div>
                        );
                    })}
                </div>

                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '24px', scrollbarWidth: 'none' }}>
                    {['All', 'Critical', 'Warning', 'Resolved'].map(tab => {
                        const active = activeTab === tab;
                        return (
                            <button 
                                key={tab} 
                                onClick={() => setActiveTab(tab)} 
                                style={{ 
                                    padding: '10px 20px', borderRadius: '12px', 
                                    border: active ? '2px solid #0052FF' : '1.5px solid #EAECF0',
                                    background: active ? '#0052FF' : 'white', 
                                    color: active ? 'white' : '#475467',
                                    fontSize: '13px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.1s'
                                }}
                            >
                                {tab}
                            </button>
                        );
                    })}
                </div>

                {/* Alert Cards - Fixed Max Width & Standardized Transitions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '40px', width: '100%', maxWidth: '100%' }}>
                    {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#98A2B3', fontSize: '13px', fontWeight: '800' }}>Synchronizing Clinical Streams...</div> : 
                     filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '80px 20px', background: 'white', borderRadius: '24px', border: '1.5px dashed #EAECF0', width: '100%', boxSizing: 'border-box' }}>
                            <div style={{ width: '56px', height: '56px', background: '#F2F4F7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <Bell size={24} color="#98A2B3" />
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: '900', color: '#101828' }}>Board Clear</div>
                            <p style={{ fontSize: '12px', color: '#667085', marginTop: '4px', fontWeight: '700' }}>No active triage required for this sector.</p>
                        </div>
                     ) :
                     filtered.map(alert => (
                        <AlertCard key={alert.id} alert={alert} onResolve={handleResolve} isMobile={isMobile} navigate={navigate} />
                    ))}
                </div>
            </div>
        </div>
    </DoctorShell>
    );
}

function AlertCard({ alert, onResolve, isMobile, navigate }) {
    const isCritical = alert.severity === 'critical';
    const isWarning = alert.severity === 'warning';
    
    const statusColor = isCritical ? '#D92D20' : isWarning ? '#F79009' : '#079455';
    const statusBg = isCritical ? '#FEF3F2' : isWarning ? '#FFFAEB' : '#ECFDF5';

    return (
        <div style={{ 
            background: 'white', borderRadius: '24px', padding: isMobile ? '20px' : '28px', 
            border: '1.5px solid #EAECF0',
            position: 'relative',
            width: '100%',
            boxSizing: 'border-box',
            transition: 'transform 0.2s ease',
            cursor: 'default'
        }}>
            <div style={{ position: 'absolute', left: 0, top: 24, bottom: 24, width: '4px', borderRadius: '0 4px 4px 0', backgroundColor: statusColor }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: statusBg, color: statusColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bell size={22} strokeWidth={2.5}/>
                    </div>
                    <div>
                        <div style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '950', color: '#101828', letterSpacing: '-0.5px' }}>{alert.patientName || 'Anonymous Case'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#667085', fontWeight: '800', marginTop: '4px' }}>
                            <Clock size={13}/> {(() => {
                                const d = alert.createdAt?.toMillis ? alert.createdAt.toDate() : (alert.createdAt ? new Date(alert.createdAt) : null);
                                return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently';
                            })()}
                        </div>
                    </div>
                </div>
                <div style={{ 
                    fontSize: '11px', fontWeight: '950', padding: '6px 14px', borderRadius: '10px', 
                    background: statusBg, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.8px' 
                }}>
                    {alert.severity}
                </div>
            </div>

            <p style={{ fontSize: isMobile ? '14px' : '16px', color: '#344054', lineHeight: 1.6, margin: '0 0 28px 0', fontWeight: '600' }}>{alert.message}</p>

            {/* Standardized Button Widths & Alignment */}
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button 
                    onClick={() => navigate(`/doctor/dashboard`)} 
                    style={{ 
                        flex: 1, height: '52px', background: 'white', border: '1.5px solid #EAECF0', 
                        borderRadius: '16px', fontSize: '13px', fontWeight: '900', cursor: 'pointer',
                        transition: 'all 0.1s', color: '#344054'
                    }}
                >
                    Review Case
                </button>
                {alert.status !== 'resolved' && (
                    <button 
                        onClick={() => onResolve(alert.id)} 
                        style={{ 
                            flex: 1, height: '52px', background: '#0052FF', color: 'white', border: 'none', 
                            borderRadius: '16px', fontSize: '13px', fontWeight: '950', cursor: 'pointer',
                            boxShadow: '0 8px 16px rgba(0, 82, 255, 0.2)', transition: 'all 0.1s'
                        }}
                    >
                        Resolve Case
                    </button>
                )}
                {/* Ensure spacing remains consistent even if Resolve button is absent */}
                {alert.status === 'resolved' && <div style={{ flex: 1 }} />}
            </div>
        </div>
    );
}
