import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuthContext } from '../../context/AuthContext';
import { checkVitalsAndCreateAlert } from '../../utils/alertChecker';
import CaretakerShell from './CaretakerShell';
import { Loader2, TrendingUp, CheckCircle2, History, Activity, Heart, Thermometer } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function VitalsEntry() {
    const navigate = useNavigate();
    const { patientId, user } = useAuthContext();
    const [vitalsHistory, setVitalsHistory] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);
    const [bpSys, setBpSys] = useState('');
    const [bpDia, setBpDia] = useState('');
    const [hr, setHr] = useState('');
    const [temp, setTemp] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!patientId) return;
        const q = query(collection(db, 'vitals'), where('patientId', '==', patientId));
        return onSnapshot(q, (snap) => {
            const vitals = snap.docs.map(d => ({ ...d.data(), id: d.id }))
                .sort((a, b) => (b.recordedAt?.toMillis?.() || 0) - (a.recordedAt?.toMillis?.() || 0));
            setVitalsHistory(vitals);
        });
    }, [patientId]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const getStatusColor = (val, thresholds) => {
        if (!val) return '#F9FAFB';
        const v = Number(val);
        if (v >= thresholds.redMin || v <= thresholds.redMaxLow) return '#FEF2F2';
        if (v >= thresholds.orangeMin || v <= thresholds.orangeMaxLow) return '#FFF9F5';
        return '#F0FDF4';
    };

    const getBorderColor = (val, thresholds) => {
        if (!val) return '#EAECF0';
        const v = Number(val);
        if (v >= thresholds.redMin || v <= thresholds.redMaxLow) return '#FDA29B';
        if (v >= thresholds.orangeMin || v <= thresholds.orangeMaxLow) return '#FEDF89';
        return '#6CE9A6';
    };

    const handleSubmit = async () => {
        const hasData = bpSys || hr || temp;
        if (!hasData) return;
        setSubmitting(true);
        
        const nSys = Number(bpSys);
        const nHr = Number(hr);
        const nTemp = Number(temp);
        
        // ONLY FLAG IF VALUE WAS ENTERED (Greater than 0)
        const isAbnormal = (nSys > 0 && (nSys >= 140 || nSys <= 90)) || 
                           (nHr > 0 && (nHr >= 110 || nHr <= 50)) || 
                           (nTemp > 0 && (nTemp >= 100.4 || nTemp <= 95));

        if (isAbnormal) {
            alert("⚠️ EMERGENCY DETECTED. Broadcasting to Medical Team...");
        }

        try {
            const vitalsData = {
                patientId, recordedBy: user.uid, recordedAt: serverTimestamp(),
                heartRate: nHr || null, temperature: nTemp || null,
                alertTriggered: isAbnormal // SYNC WITH DASHBOARD STATUS
            };
            if (bpSys && bpDia) {
                vitalsData.bp = { systolic: nSys, diastolic: Number(bpDia) };
            }
            
            await addDoc(collection(db, 'vitals'), vitalsData);
            await checkVitalsAndCreateAlert(patientId, { 
                ...vitalsData, 
                bpSystolic: nSys, 
                bpDiastolic: Number(bpDia),
                heartRate: nHr,
                temperature: nTemp
            });
            
            showToast(isAbnormal ? 'Critical Emergency Broadcasted' : 'Vitals Synchronized', isAbnormal ? 'error' : 'success');
            setBpSys(''); setBpDia(''); setHr(''); setTemp('');
        } catch (err) { 
            console.error("Vitals Sync Error:", err);
            showToast('Sync failure. Check connection.', 'error'); 
        }
        setSubmitting(false);
    };

    const sysT = { redMin: 140, orangeMin: 120, redMaxLow: 90, orangeMaxLow: 100 };
    const diaT = { redMin: 90, orangeMin: 80, redMaxLow: 50, orangeMaxLow: 60 };
    const hrT = { redMin: 110, orangeMin: 100, redMaxLow: 50, orangeMaxLow: 60 };
    const tempT = { redMin: 100.4, orangeMin: 99.1, redMaxLow: 95.0, orangeMaxLow: 96.5 };

    const trendData = [...vitalsHistory].reverse().slice(-10).map(v => ({
        time: new Date(v.recordedAt?.toMillis?.() || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sys: v.bp?.systolic, hr: v.heartRate
    }));

    return (
        <CaretakerShell title="Vitals & Biometrics">
            <div style={{ padding: isMobile ? '16px' : '32px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }}>
                {toast && (
                    <div style={{ position: 'fixed', top: '90px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: toast.type === 'success' ? '#0052FF' : '#D92D20', color: 'white', padding: '12px 24px', borderRadius: '40px', fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={16} /> {toast.message}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '24px' }}>
                    <div style={{ background: 'white', padding: isMobile ? '20px' : '32px', borderRadius: isMobile ? '24px' : '32px', border: '1px solid #EAECF0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <Activity size={20} color="#0052FF" />
                            <h2 style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '900', margin: 0 }}>Vitals Entry</h2>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ flex: 1 }}><label style={{ fontSize: '10px', fontWeight: '900', color: '#667085', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>BP (SYS/DIA)</label>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <input placeholder="120" type="number" value={bpSys} onChange={(e) => setBpSys(e.target.value)} style={{ width: '100%', height: '48px', background: getStatusColor(bpSys, sysT), border: `1px solid ${getBorderColor(bpSys, sysT)}`, borderRadius: '12px', padding: '0 12px', fontWeight: '800', fontSize: '14px', transition: '0.3s' }} />
                                    <input placeholder="80" type="number" value={bpDia} onChange={(e) => setBpDia(e.target.value)} style={{ width: '100%', height: '48px', background: getStatusColor(bpDia, diaT), border: `1px solid ${getBorderColor(bpDia, diaT)}`, borderRadius: '12px', padding: '0 12px', fontWeight: '800', fontSize: '14px', transition: '0.3s' }} />
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ flex: 1 }}><label style={{ fontSize: '10px', fontWeight: '900', color: '#667085', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>HR (BPM)</label>
                                <div style={{ position: 'relative' }}><Heart size={16} color={hr ? getBorderColor(hr, hrT) : "#D92D20"} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', transition: '0.3s' }} />
                                    <input placeholder="72" type="number" value={hr} onChange={(e) => setHr(e.target.value)} style={{ width: '100%', height: '48px', background: getStatusColor(hr, hrT), border: `1px solid ${getBorderColor(hr, hrT)}`, borderRadius: '12px', padding: '0 12px 0 36px', fontWeight: '800', fontSize: '14px', transition: '0.3s' }} />
                                </div>
                            </div>
                            <div style={{ flex: 1 }}><label style={{ fontSize: '10px', fontWeight: '900', color: '#667085', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>TEMP (°F)</label>
                                <div style={{ position: 'relative' }}><Thermometer size={16} color={temp ? getBorderColor(temp, tempT) : "#0052FF"} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', transition: '0.3s' }} />
                                    <input placeholder="98.6" type="number" value={temp} onChange={(e) => setTemp(e.target.value)} style={{ width: '100%', height: '48px', background: getStatusColor(temp, tempT), border: `1px solid ${getBorderColor(temp, tempT)}`, borderRadius: '12px', padding: '0 12px 0 36px', fontWeight: '800', fontSize: '14px', transition: '0.3s' }} />
                                </div>
                            </div>
                        </div>
                        <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', height: '52px', background: '#0052FF', color: 'white', borderRadius: '14px', border: 'none', fontWeight: '900', cursor: 'pointer', fontSize: '14px' }}>
                            {submitting ? <Loader2 size={20} className="animate-spin" /> : 'Log Reading'}
                        </button>
                    </div>

                    <div style={{ background: 'white', padding: isMobile ? '20px' : '32px', borderRadius: isMobile ? '24px' : '32px', border: '1px solid #EAECF0', height: isMobile ? '300px' : 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <TrendingUp size={20} color="#0052FF" />
                            <h2 style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '900', margin: 0 }}>Recent Trends</h2>
                        </div>
                        <div style={{ height: isMobile ? '180px' : '240px', width: '100%' }}>
                            {trendData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAECF0" />
                                        <XAxis dataKey="time" hide />
                                        <Tooltip />
                                        <Area type="monotone" dataKey="hr" stroke="#D92D20" strokeWidth={3} fillOpacity={0.1} fill="#D92D20" />
                                        <Area type="monotone" dataKey="sys" stroke="#0052FF" strokeWidth={3} fillOpacity={0.1} fill="#0052FF" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#667085', fontWeight: '700', fontSize: '12px' }}>Waiting for data streams...</div>}
                        </div>
                    </div>
                </div>

                <div style={{ background: 'white', padding: isMobile ? '20px' : '32px', borderRadius: isMobile ? '24px' : '32px', border: '1px solid #EAECF0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <History size={20} color="#0052FF" />
                        <h2 style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '900', margin: 0 }}>Clinical History</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {vitalsHistory.slice(0, 5).map((v, i) => (
                            <div key={i} style={{ padding: '12px 16px', borderRadius: '14px', background: '#F9FAFB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: '900', color: '#101828' }}>{v.bp?.systolic}/{v.bp?.diastolic} mmHg</div>
                                    <div style={{ fontSize: '11px', color: '#667085', fontWeight: '700' }}>{new Date(v.recordedAt?.toMillis?.() || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#D92D20', background: '#FEF2F2', padding: '3px 8px', borderRadius: '6px' }}>{v.heartRate} HR</span>
                                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#0052FF', background: '#F0F5FF', padding: '3px 8px', borderRadius: '6px' }}>{v.temperature}°F</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </CaretakerShell>
    );
}
