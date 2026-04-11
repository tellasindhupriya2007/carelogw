import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../context/AuthContext';
import CaretakerShell from './CaretakerShell';
import { AlertTriangle, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function AlertsScreen() {
    const { patientId } = useAuthContext();
    const [alerts, setAlerts] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!patientId) return;
        const q = query(
            collection(db, 'alerts'),
            where('patientId', '==', patientId),
            where('status', '==', 'active')
        );
        return onSnapshot(q, (snap) => {
            const fetched = snap.docs.map(d => ({ ...d.data(), id: d.id }))
                .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
            setAlerts(fetched);
            setLoading(false);
        });
    }, [patientId]);

    const handleAcknowledge = async (alertId) => {
        try {
            await updateDoc(doc(db, 'alerts', alertId), {
                status: 'acknowledged',
                acknowledgedAt: serverTimestamp()
            });
        } catch (e) { console.error("Err ack:", e); }
    };

    const filtered = alerts.filter(a => filter === 'all' || a.type === filter);

    return (
        <CaretakerShell title="Alerts Overview">
            <div style={{ padding: isMobile ? '12px' : '32px', maxWidth: '800px', margin: '0 auto' }}>
                {/* Filter Bar */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '8px', scrollbarWidth: 'none' }}>
                    {['all', 'critical', 'warning', 'info'].map((f) => (
                        <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 20px', borderRadius: '40px', border: filter === f ? 'none' : '1px solid #EAECF0', background: filter === f ? '#0052FF' : 'white', color: filter === f ? 'white' : '#667085', fontWeight: '900', fontSize: '12px', textTransform: 'capitalize', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {f}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '900', color: '#101828' }}>Recent Alerts</h3>
                    <span style={{ fontSize: '11px', color: '#667085', fontWeight: '800' }}>{alerts.length} total</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filtered.length > 0 ? filtered.map((alert) => (
                        <div key={alert.id} style={{ 
                            background: 'white', border: `1px solid ${alert.type === 'critical' ? '#FDA29B' : '#EAECF0'}`, 
                            padding: '20px', borderRadius: '24px', position: 'relative',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                        }}>
                            {/* ROBUST MOBILE STACKING */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                    <div style={{ 
                                        width: '44px', height: '44px', borderRadius: '12px', 
                                        backgroundColor: alert.type === 'critical' ? '#FEF3F2' : '#F9FAFB',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                    }}>
                                        <AlertTriangle size={24} color={alert.type === 'critical' ? '#D92D20' : '#B45309'} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '10px', fontWeight: '900', color: alert.type === 'critical' ? '#B42318' : '#B45309', textTransform: 'uppercase' }}>{alert.type}</span>
                                            <span style={{ fontSize: '10px', fontWeight: '900', color: '#98A2B3' }}>• {alert.source || 'TASK'}</span>
                                        </div>
                                        <h4 style={{ fontSize: '14px', fontWeight: '850', color: '#101828', margin: '0 0 6px 0', lineHeight: 1.4, wordBreak: 'break-word' }}>
                                            {alert.message}
                                        </h4>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#667085' }}>
                                            <Clock size={12} />
                                            <span style={{ fontSize: '11px', fontWeight: '700' }}>{new Date(alert.createdAt?.toMillis?.() || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                </div>

                                <button onClick={() => handleAcknowledge(alert.id)} style={{ 
                                    width: '100%', height: '44px', background: '#0052FF', color: 'white', border: 'none', 
                                    borderRadius: '12px', fontSize: '13px', fontWeight: '950', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}>
                                    <ShieldCheck size={18} /> Acknowledge
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div style={{ padding: '64px 20px', textAlign: 'center', background: '#F9FAFB', borderRadius: '24px', border: '1px dashed #EAECF0' }}>
                            <CheckCircle2 size={32} color="#039855" style={{ margin: '0 auto 12px' }} />
                            <h3 style={{ fontSize: '14px', fontWeight: '900' }}>No active alerts</h3>
                        </div>
                    )}
                </div>
            </div>
        </CaretakerShell>
    );
}
