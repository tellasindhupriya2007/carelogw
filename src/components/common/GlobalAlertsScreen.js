import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { listenToAlerts, markAlertAsRead, preloadMockAlertsIfNeeded } from '../../services/alertService';
import ScreenHeader from './ScreenHeader';
import { colors } from '../../styles/colors';
import { AlertTriangle, Info, CheckCircle2, ChevronRight, Clock, BellRing } from 'lucide-react';
import { spacing } from '../../styles/spacing';

const typeConfig = {
    critical: { color: '#EF4444', bg: '#FEF2F2', border: '#FCA5A5', icon: AlertTriangle, label: 'Critical' },
    warning: { color: '#F59E0B', bg: '#FFFBEB', border: '#FCD34D', icon: AlertTriangle, label: 'Warning' },
    normal: { color: '#10B981', bg: '#ECFDF5', border: '#6EE7B7', icon: Info, label: 'Normal' }
};

export default function GlobalAlertsScreen() {
    const navigate = useNavigate();
    const { patientId } = useAuthContext();
    const [alerts, setAlerts] = useState([]);
    const [filter, setFilter] = useState('All'); // All, Critical, Normal

    useEffect(() => {
        if (!patientId) return;
        
        const unsub = listenToAlerts({ patientId }, (fetchedAlerts) => {
            setAlerts(fetchedAlerts);
        });

        return () => unsub();
    }, [patientId]);

    const filteredAlerts = alerts.filter(a => {
        if (filter === 'All') return true;
        if (filter === 'Critical') return a.type === 'critical';
        if (filter === 'Normal') return a.type === 'normal';
        return true;
    });

    const unreadCount = alerts.filter(a => !a.isRead).length;

    return (
        <div style={{ backgroundColor: colors.background, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <ScreenHeader 
                title="Alerts Overview" 
                subtitle={`${unreadCount} Unread Notifications`} 
                showBack 
                onBack={() => navigate(-1)} 
            />

            <main className="main-content scroll-y" style={{ flex: 1, width: '100%', padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '100%', maxWidth: '840px' }}>
                    {/* Modern Segmented Control Tabs */}
                    <div style={{ display: 'flex', backgroundColor: colors.white, padding: '4px', borderRadius: '16px', marginBottom: '24px', boxShadow: spacing.shadows.card, border: `1px solid ${colors.border}` }}>
                        {['All', 'Critical', 'Warning', 'Normal'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setFilter(tab)}
                                style={{
                                    flex: 1, padding: '12px', border: 'none', borderRadius: '12px',
                                    backgroundColor: filter === tab ? colors.primaryBlue : 'transparent',
                                    color: filter === tab ? colors.white : colors.textSecondary,
                                    fontSize: '14px', fontWeight: '800', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: filter === tab ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                                }}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Header Summary */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 4px' }}>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: colors.textPrimary }}>
                            {filter === 'All' ? 'Recent Alerts' : `${filter} Alerts`}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: colors.textSecondary }}> {filteredAlerts.length} total</span>
                    </div>

                    {/* List Container */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '40px' }}>
                        {filteredAlerts.length > 0 ? (
                            filteredAlerts.map(alert => {
                                const config = typeConfig[alert.type] || typeConfig.normal;
                                const IconComponent = config.icon;
                                const isRead = alert.isRead;

                                let timeStr = 'Just now';
                                let dateStr = '';
                                if (alert.createdAt) {
                                    const date = alert.createdAt?.toMillis ? alert.createdAt.toDate() : new Date(alert.createdAt);
                                    if (!isNaN(date.getTime())) {
                                        timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        dateStr = date.toLocaleDateString();
                                    }
                                }

                                return (
                                    <div key={alert.id} style={{ 
                                        backgroundColor: colors.white, 
                                        borderRadius: '20px', 
                                        border: isRead ? `1.5px solid ${colors.border}` : `2px solid ${config.border}`,
                                        padding: '24px',
                                        position: 'relative',
                                        transition: 'all 0.3s ease',
                                        opacity: isRead ? 0.75 : 1,
                                        boxShadow: isRead ? 'none' : spacing.shadows.card,
                                        overflow: 'hidden'
                                    }}>
                                        {/* Unread dot indicator */}
                                        {!isRead && (
                                            <div style={{ position: 'absolute', top: '24px', right: '24px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: config.color, boxShadow: `0 0 10px ${config.color}` }} />
                                        )}

                                        <div style={{ display: 'flex', gap: '20px' }}>
                                            <div style={{ 
                                                width: '56px', height: '56px', borderRadius: '16px', 
                                                backgroundColor: config.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                                            }}>
                                                <IconComponent size={28} color={config.color} />
                                            </div>
                                            
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                <div style={{ paddingRight: '20px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                        <span style={{ 
                                                            fontSize: '11px', fontWeight: '900', padding: '4px 10px', borderRadius: '8px', 
                                                            backgroundColor: isRead ? colors.grey100 : config.bg, 
                                                            color: isRead ? colors.textSecondary : config.color,
                                                            textTransform: 'uppercase', letterSpacing: '0.5px'
                                                        }}>
                                                            {config.label}
                                                        </span>
                                                        {alert.source && (
                                                            <span style={{ fontSize: '11px', fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                • {alert.source}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: colors.textPrimary, lineHeight: '1.4', margin: 0 }}>
                                                        {alert.message}
                                                    </h3>
                                                </div>
                                                
                                                <div style={{ width: '100%', height: '1px', backgroundColor: colors.border, margin: '4px 0' }} />
                                                
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: colors.textSecondary }}>
                                                        <Clock size={14} />
                                                        <span style={{ fontSize: '13px', fontWeight: '600' }}>
                                                            {timeStr} <span style={{ opacity: 0.6, marginLeft: '4px' }}>{dateStr}</span>
                                                        </span>
                                                    </div>
                                                    
                                                    {!isRead ? (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); markAlertAsRead(alert.id); }}
                                                            style={{ 
                                                                backgroundColor: colors.primaryBlue, color: colors.white, border: 'none', borderRadius: '10px',
                                                                padding: '10px 16px', fontSize: '14px', fontWeight: '800', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                                transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                                        >
                                                            <CheckCircle2 size={18} /> Acknowledge
                                                        </button>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: colors.primaryGreen }}>
                                                            <CheckCircle2 size={18} />
                                                            <span style={{ fontSize: '14px', fontWeight: '800' }}>Resolved</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ 
                                textAlign: 'center', padding: '80px 20px', 
                                backgroundColor: colors.white, borderRadius: '24px', 
                                border: `2px dashed ${colors.border}`,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <div style={{ width: '80px', height: '80px', backgroundColor: '#ECFDF5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                                    <BellRing size={40} color={colors.primaryGreen} style={{ opacity: 0.8 }} />
                                </div>
                                <h3 style={{ fontSize: '22px', fontWeight: '900', color: colors.textPrimary, marginBottom: '8px' }}>All Clear!</h3>
                                <p style={{ fontSize: '15px', color: colors.textSecondary, maxWidth: '300px', lineHeight: '1.5' }}>
                                    There are no {filter.toLowerCase()} alerts requiring your attention at this time.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
