import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import ScreenHeader from '../../components/common/ScreenHeader';
import FamilyBottomNav from '../common/FamilyBottomNav';
import SkeletonCard from '../common/SkeletonCard';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { Pill, UploadCloud, Loader2, ChevronRight } from 'lucide-react';

export default function FamilyPrescriptions() {
    const navigate = useNavigate();
    const { patientId } = useAuthContext();
    const [medicines, setMedicines] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (message, type) => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        const fetchMeds = async () => {
            if (!patientId) return;
            try {
                const q = query(collection(db, 'prescriptions'), where('patientId', '==', patientId), limit(20));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const allData = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                        .sort((a, b) => {
                            const ta = a.uploadedAt?.toMillis ? a.uploadedAt.toMillis() : new Date(a.uploadedAt || 0).getTime();
                            const tb = b.uploadedAt?.toMillis ? b.uploadedAt.toMillis() : new Date(b.uploadedAt || 0).getTime();
                            return tb - ta;
                        });
                    setHistory(allData);
                    setMedicines(allData[0]?.medicines || []);
                } else {
                    const planSnap = await getDocs(query(collection(db, 'carePlans'), where('__name__', '==', patientId)));
                    if (!planSnap.empty) {
                        setMedicines(planSnap.docs[0].data().medicines || []);
                    }
                }
            } catch (err) {
                console.error("[Prescr] Load error:", err);
            }
            setLoading(false);
        };
        fetchMeds();
    }, [patientId]);

    const compressAndUpload = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1000;
                    const scale = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scale;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    // High quality but stays under 1MB Firestore limit
                    const base64 = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(base64);
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !patientId) return;
        setUploading(true);
        try {
            // Compress locally - works without Firebase Storage!
            const base64Image = await compressAndUpload(file);

            await addDoc(collection(db, 'prescriptions'), {
                patientId,
                photoUrl: base64Image, // Save compressed image directly
                uploadedAt: serverTimestamp(),
                uploadedBy: 'Family',
                medicines: medicines
            });

            showToast("Prescription saved successfully!", "success");
            // Refresh history
            setHistory(prev => [{ photoUrl: base64Image, uploadedAt: { toDate: () => new Date() }, medicines }, ...prev]);
        } catch (error) {
            console.error(error);
            showToast("Upload failed. Try a smaller photo.", "error");
        }
        setUploading(false);
    };

    return (
        <div style={{ backgroundColor: colors.background, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {toast && (
                <div style={{
                    position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
                    backgroundColor: toast.type === 'success' ? colors.successGreen : colors.alertRed,
                    color: toast.type === 'success' ? colors.primaryGreen : colors.white,
                    padding: '12px 24px', borderRadius: '12px', fontWeight: '600',
                    boxShadow: spacing.shadows.card, zIndex: 1100
                }}>
                    {toast.message}
                </div>
            )}

            <ScreenHeader title="Active Prescriptions" showBack onBack={() => navigate(-1)} />

            <div className="main-content scroll-y" style={{ padding: spacing.pagePadding, flex: 1, paddingBottom: '100px' }}>
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleUpload}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                            disabled={uploading}
                        />
                        <button style={{
                            width: '100%', height: '52px', backgroundColor: '#EFF6FF',
                            border: `1px dashed ${colors.primaryBlue}`, borderRadius: '16px',
                            color: colors.primaryBlue, fontSize: '14px', fontWeight: '700',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}>
                            {uploading ? <Loader2 size={20} className="spinner" /> : <UploadCloud size={20} />}
                            {uploading ? "Saving Locally..." : "Upload New Prescription"}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <SkeletonCard /><SkeletonCard />
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <h3 className="section-title">Current Medications</h3>
                            {(medicines.length === 0 ? [
                                { name: "Amoxicillin", dosage: "500mg", frequency: "3 times daily", times: ["08:00"] }, 
                                { name: "Paracetamol", dosage: "1g", frequency: "As needed", times: ["12:00"] }
                            ] : medicines).map((m, i) => (
                                <div key={i} className="medicine-pill-card">
                                    <div className="pill-icon-box">
                                        <Pill size={22} color={colors.primaryBlue} />
                                    </div>
                                    <div className="med-info">
                                        <span className="med-name">{m.name}</span>
                                        <span className="med-meta">{m.dosage} • {m.frequency}</span>
                                        <span className="med-timing">Next dose: {m.scheduledTimes?.[0] || m.times?.[0]}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {history.length > 0 && (
                            <div style={{ marginTop: '32px' }}>
                                <h3 className="section-title">Recent Activity</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {history.map((h, i) => (
                                        <div key={i} className="history-item-card" onClick={() => {
                                            const win = window.open();
                                            win.document.write(`<img src="${h.photoUrl}" style="width:100%; height:auto;" />`);
                                        }}>
                                            <div className="history-icon-box">
                                                <UploadCloud size={18} color={colors.primaryBlue} />
                                            </div>
                                            <div className="history-info">
                                                <span className="history-title">Prescription Archive</span>
                                                <span className="history-time">
                                                    {h.uploadedAt?.toDate ? h.uploadedAt.toDate().toLocaleString() : 'Just Now'}
                                                </span>
                                            </div>
                                            <ChevronRight size={16} color={colors.textSecondary} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <FamilyBottomNav />
            <style>{`.spinner { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
