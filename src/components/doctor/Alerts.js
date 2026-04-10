import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { DS, card, sectionLabel, gradientBtn, statusMeta } from './ds';
import DoctorShell from './DoctorShell';
import { Bell, AlertTriangle, CheckCircle, ExternalLink, Filter, Clock, User } from 'lucide-react';

const SEVERITY_TABS = ['All', 'Critical', 'Warning', 'Resolved'];

// Skeleton Loader
function Skeleton({ height = '60px', borderRadius = '14px' }) {
    return (
        <div style={{ height, borderRadius, backgroundColor: DS.surfaceHigh, animation: 'pulse 1.5s ease-in-out infinite' }} />
    );
}

export default function DoctorAlerts() {
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All');
    const [alertCount, setAlertCount] = useState(0);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!user?.uid) return;
        try {
            const q = query(collection(db, 'alerts'), where('doctorId', '==', user.uid));
            const unsub = onSnapshot(q, (snap) => {
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
                    const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
                    const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
                    return dateB.getTime() - dateA.getTime();
                });
                setAlerts(data);
                setAlertCount(data.filter(a => !a.isRead && a.status !== 'resolved').length);
                setLoading(false);
            }, (err) => { setError('Failed to load diagnostics.'); setLoading(false); });
            return () => unsub();
        } catch (e) {
            setError('Diagnostic stream error.');
            setLoading(false);
        }
    }, []);

    const handleResolve = async (alertId) => {
        try {
            await updateDoc(doc(db, 'alerts', alertId), { isRead: true, status: 'resolved' });
        } catch (e) { console.error(e); }
    };

    const filtered = alerts.filter(a => {
        if (activeTab === 'All') return a.status !== 'resolved';
        if (activeTab === 'Resolved') return a.status === 'resolved';
        return a.severity === activeTab.toLowerCase() && a.status !== 'resolved';
    });

    const criticalCount = alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length;
    const warningCount = alerts.filter(a => a.severity === 'warning' && a.status !== 'resolved').length;

    return (
        <DoctorShell alertCount={alertCount}>
            <div className="clinical-page-container">
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>

                    {/* Header */}
                    <div className="responsive-title-group">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ width: '30px', height: '1px', backgroundColor: '#D92D20' }}></div>
                            <span style={{ fontSize: '11px', fontWeight: '900', color: '#D92D20', textTransform: 'uppercase', letterSpacing: '1px' }}>Clinical Oversight</span>
                        </div>
                        <h1 style={{ fontWeight: '900', color: '#101828', letterSpacing: '-1.5px' }}>Diagnostic Alerts</h1>
                        <p style={{ fontSize: '16px', color: '#475467', fontWeight: '600', margin: 0 }}>
                            {criticalCount > 0 ? <span style={{ color: '#D92D20' }}>{criticalCount} high-risk events detected </span> : 'System status optimal'}
                        </p>
                    </div>

                    {/* Elite Tab System */}
                    <div className="tab-system-responsive">
                        {SEVERITY_TABS.map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} style={{
                                flex: 1, padding: '12px 16px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                fontSize: '13px', fontWeight: '800', transition: 'all 0.2s', whiteSpace: 'nowrap',
                                backgroundColor: activeTab === tab ? '#ffffff' : 'transparent',
                                color: activeTab === tab ? '#101828' : '#475467',
                                boxShadow: activeTab === tab ? '0 4px 12px rgba(16, 24, 40, 0.08)' : 'none'
                            }}>
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Stats Pods */}
                    <div className="stats-grid-3">
                        {[
                            { label: 'Active Alerts', value: alerts.filter(a => a.status !== 'resolved').length, color: '#0052FF', bg: '#EFF4FF' },
                            { label: 'Critical Events', value: criticalCount, color: '#D92D20', bg: '#FFF1F0' },
                            { label: 'Resolved Cases', value: alerts.filter(a => a.status === 'resolved').length, color: '#079455', bg: '#ECFDF5' },
                        ].map((s, i) => (
                            <div key={i} style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px 28px', border: '1px solid #EAECF0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                                <div style={{ fontSize: '36px', fontWeight: '900', color: s.color, letterSpacing: '-1px', lineHeight: 1 }}>{s.value}</div>
                                <div style={{ fontSize: '13px', fontWeight: '800', color: '#475467', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '12px' }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{ backgroundColor: '#FEF3F2', borderRadius: '16px', padding: '16px 24px', color: '#B42318', fontWeight: '700', marginBottom: '24px', border: '1px solid #FEE4E2' }}>
                            ⚠ Diagnostic Error: {error}
                        </div>
                    )}

                    {/* Diagnostic Slot List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {loading && [1, 2, 3, 4].map(i => <Skeleton key={i} height="100px" borderRadius="16px" />)}

                        {!loading && filtered.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '80px 40px', backgroundColor: '#ffffff', borderRadius: '32px', border: '1px dashed #EAECF0' }}>
                                <CheckCircle size={56} color="#079455" strokeWidth={1.5} style={{ display: 'block', margin: '0 auto 24px', opacity: 0.8 }} />
                                <div style={{ fontSize: '20px', fontWeight: '900', color: '#101828', marginBottom: '8px' }}>Operational Integrity Verified</div>
                                <div style={{ fontSize: '15px', fontWeight: '600', color: '#475467' }}>No {activeTab !== 'All' ? activeTab.toLowerCase() : ''} diagnostic alerts requiring clinical intervention.</div>
                            </div>
                        )}

                        {!loading && filtered.map(alert => (
                            <AlertCard key={alert.id} alert={alert} onResolve={handleResolve} onViewPatient={(pid) => navigate(`/doctor/dashboard?patient=${pid}`)} />
                        ))}
                    </div>
                </div>
            </div>
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        </DoctorShell>
    );
}

function AlertCard({ alert, onResolve, onViewPatient }) {
    const isResolved = alert.status === 'resolved';
    const isCritical = alert.severity === 'critical';
    const isWarning = alert.severity === 'warning';

    const severityColor = isCritical ? '#D92D20' : isWarning ? '#DC6803' : '#079455';
    const severityBg = isCritical ? '#FEF3F2' : isWarning ? '#FFFAEB' : '#ECFDF5';
    const severityLabel = isCritical ? 'CRITICAL RISK' : isWarning ? 'WARNING' : 'STABLE';

    const timeAgo = (ts) => {
        if (!ts) return 'Unknown';
        // Handle Firestore Timestamp
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        const diff = Date.now() - date.getTime();
        const m = Math.floor(diff / 60000);
        if (m < 0) return 'Just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    };

    return (
        <div className="alert-card-responsive" style={{
            backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px 32px',
            boxShadow: isCritical && !isResolved ? '0 12px 32px -8px rgba(217, 45, 32, 0.15)' : '0 4px 12px rgba(16, 24, 40, 0.02)',
            border: isCritical && !isResolved ? '1px solid #FEE4E2' : '1px solid #EAECF0',
            opacity: isResolved ? 0.6 : 1,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
            <div style={{ display: 'flex', gap: '24px', flex: 1, alignItems: 'center' }}>
                {/* Status Indicator */}
                <div style={{ width: '56px', height: '56px', borderRadius: '18px', backgroundColor: severityBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${severityColor}20` }}>
                    {isCritical ? <AlertTriangle size={28} color={severityColor} /> : isWarning ? <Bell size={28} color={severityColor} /> : <CheckCircle size={28} color={severityColor} />}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="responsive-flex-between" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                        <span className="patient-name" style={{ fontSize: '18px', fontWeight: '900', color: '#101828', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.patientName || 'Clinical Case'}</span>
                        <span className="badge-mobile" style={{ flexShrink: 0, fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: severityColor, backgroundColor: severityBg, padding: '4px 10px', borderRadius: '8px', border: `1px solid ${severityColor}20` }}>
                            {isResolved ? 'RESOLVED ARCHIVE' : severityLabel}
                        </span>
                    </div>
                    <p className="alert-description" style={{ fontSize: '15px', color: '#475467', fontWeight: '600', margin: '0 0 10px 0', lineHeight: 1.6 }}>{alert.message}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 20px' }}>
                        <span className="meta-text" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#667085', fontWeight: '700' }}>
                            <Clock size={14} color="#98A2B3" /> {timeAgo(alert.timestamp)}
                        </span>
                        {alert.source && (
                            <span className="meta-text" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#667085', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                <User size={14} color="#98A2B3" /> SOURCE: {alert.source}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            {!isResolved && (
                <div style={{ display: 'flex', gap: '12px', paddingLeft: '32px' }}>
                    {alert.patientId && (
                        <button onClick={() => onViewPatient(alert.patientId)} style={{ height: '44px', padding: '0 20px', borderRadius: '14px', border: '1px solid #EAECF0', backgroundColor: '#ffffff', color: '#0052FF', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)' }}>
                            <ExternalLink size={16} /> Patient Profile
                        </button>
                    )}
                    <button onClick={() => onResolve(alert.id)} style={{ height: '44px', padding: '0 20px', borderRadius: '14px', border: 'none', backgroundColor: '#079455', color: '#ffffff', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(7, 148, 85, 0.2)' }}>
                        <CheckCircle size={16} /> Resolve
                    </button>
                </div>
            )}
        </div>
    );
}
