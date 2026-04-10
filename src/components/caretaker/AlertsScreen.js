import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    AlertTriangle, Bell, Clock, CheckCircle2, Info
} from 'lucide-react';
import { colors } from '../../styles/colors';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuthContext } from '../../context/AuthContext';
import ScreenHeader from '../../components/common/ScreenHeader';

const severityConfig = {
    High: { color: '#EF4444', bg: '#FEF2F2', border: '#FEE2E2', icon: AlertTriangle },
    Medium: { color: '#F59E0B', bg: '#FFFBEB', border: '#FEF3C7', icon: Info },
    Low: { color: '#3B82F6', bg: '#EFF6FF', border: '#DBEAFE', icon: Bell }
};

export default function AlertsScreen() {
    const navigate = useNavigate();
    const { patientId } = useAuthContext();
    const [filter, setFilter] = useState('All');
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!patientId) return;
        
        // Real-time listener for alerts
        const q = query(
            collection(db, 'alerts'), 
            where('patientId', '==', patientId)
        );
        
        const unsubscribe = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setAlerts(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [patientId]);

    const handleResolve = async (id) => {
        try {
            await updateDoc(doc(db, 'alerts', id), {
                status: 'Resolved',
                resolvedAt: new Date(),
                resolvedBy: 'Caretaker'
            });
        } catch (e) {
            console.error(e);
        }
    };

    const filteredAlerts = alerts.filter(alert => {
        if (filter === 'All') return true;
        if (filter === 'Active') return alert.status !== 'Resolved';
        return alert.status === 'Resolved';
    });

    const formatTimestamp = (ts) => {
        if (!ts) return 'Just now';
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString();
    };

    return (
        <div style={{ backgroundColor: colors.background, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <ScreenHeader title="Clinical Alerts" subtitle="Real-time patient monitoring" showBack onBack={() => navigate(-1)} />

            <main 
                className="main-content" 
                style={{ 
                    padding: '24px 20px 100px 20px', 
                    flex: 1, 
                    maxWidth: '800px', 
                    margin: '0 auto', 
                    width: '100%' 
                }}
            >
                {/* Tabs */}
                <div style={{ display: 'flex', backgroundColor: '#E2E8F0', padding: '4px', borderRadius: '12px', marginBottom: '24px' }}>
                    {['All', 'Active', 'Resolved'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            style={{
                                flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
                                backgroundColor: filter === tab ? colors.white : 'transparent',
                                color: filter === tab ? colors.textPrimary : colors.textSecondary,
                                fontSize: '13px', fontWeight: '800', cursor: 'pointer', transition: '0.2s'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {filteredAlerts.length > 0 ? (
                        filteredAlerts.map((alert) => {
                            const config = severityConfig[alert.severity || 'Low'];
                            const Icon = config.icon;
                            const isResolved = alert.status === 'Resolved';

                            return (
                                <div key={alert.id} style={{ 
                                    backgroundColor: colors.white, borderRadius: '20px', 
                                    border: `1.5px solid ${isResolved ? '#F1F5F9' : config.border}`,
                                    padding: '20px', opacity: isResolved ? 0.7 : 1,
                                    boxShadow: isResolved ? 'none' : '0 4px 6px rgba(0,0,0,0.02)'
                                }}>
                                    <div style={{ display: 'flex', gap: '16px' }}>
                                        <div style={{ 
                                            width: '44px', height: '44px', borderRadius: '12px', 
                                            backgroundColor: config.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                                        }}>
                                            <Icon size={22} color={config.color} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="alert-card-header">
                                                <h3 style={{ fontSize: '16px', fontWeight: '800', color: colors.textPrimary, marginRight: '8px' }}>{alert.title || 'Biological Alert'}</h3>
                                                <span style={{ 
                                                    fontSize: '10px', fontWeight: '900', padding: '3px 8px', borderRadius: '6px', 
                                                    backgroundColor: config.bg, color: config.color, textTransform: 'uppercase', flexShrink: 0
                                                }}>
                                                    {alert.severity || 'Medium'}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '13px', color: colors.textSecondary, lineHeight: '1.6', marginBottom: '12px' }}>
                                                {alert.description || alert.message || 'Clinical observation requires review.'}
                                            </p>
                                            <div className="alert-card-footer">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: colors.textSecondary }}>
                                                    <Clock size={12} />
                                                    <span style={{ fontSize: '12px', fontWeight: '600' }}>{formatTimestamp(alert.timestamp)}</span>
                                                </div>
                                                {!isResolved ? (
                                                    <button 
                                                        onClick={() => handleResolve(alert.id)}
                                                        style={{ 
                                                            backgroundColor: colors.primaryBlue, color: colors.white, border: 'none', borderRadius: '10px',
                                                            padding: '10px 18px', fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', gap: '8px'
                                                        }}
                                                    >
                                                        <CheckCircle2 size={16} /> Acknowledge
                                                    </button>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontWeight: '800', fontSize: '13px' }}>
                                                        <CheckCircle2 size={16} /> Resolved
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ textAlign: 'center', padding: '80px 20px', color: colors.textSecondary }}>
                            {loading ? "Loading clinical data..." : "No active alerts found."}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
