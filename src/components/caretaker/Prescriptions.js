import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import CaretakerShell from './CaretakerShell';
import SkeletonCard from '../common/SkeletonCard';
import { Pill, UploadCloud, Loader2, ClipboardCheck } from 'lucide-react';

export default function CaretakerPrescriptions() {
    const navigate = useNavigate();
    const { patientId } = useAuthContext();
    const [medicines, setMedicines] = useState([]);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (message, type) => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        if (!patientId) return;
        setLoading(true);
        // Real-time listener on the patient record for medications
        const unsub = onSnapshot(doc(db, 'patients', patientId), (s) => {
            if (s.exists()) {
                const data = s.data();
                setMedicines(data.medications || []);
                setUpdatedAt(data.medicationsUpdatedAt);
            }
            setLoading(false);
        }, (err) => {
            console.error("Meds sync error:", err);
            setLoading(false);
        });
        return () => unsub();
    }, [patientId]);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !patientId) return;
        setUploading(true);
        try {
            const fileRef = ref(storage, `prescriptions/${patientId}_${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            const photoUrl = await getDownloadURL(fileRef);
            await addDoc(collection(db, 'prescriptions'), {
                patientId, photoUrl, uploadedAt: serverTimestamp(), uploadedBy: 'Caretaker', medicines
            });
            await updateDoc(doc(db, 'carePlans', patientId), {
                lastPrescriptionImg: photoUrl, updatedAt: serverTimestamp()
            });
            showToast("Prescription Synchronized", "success");
        } catch (error) { showToast("Sync failed", "error"); }
        setUploading(false);
    };

    return (
        <CaretakerShell title="Prescription Management">
            <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {toast && (
                    <div style={{ position: 'fixed', top: '90px', left: '50%', transform: 'translateX(-50%)', backgroundColor: toast.type === 'success' ? '#0052FF' : '#D92D20', color: 'white', padding: '12px 24px', borderRadius: '40px', fontWeight: '800', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, fontSize: '13px' }}>{toast.message}</div>
                )}

                <div style={{ background: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #EAECF0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <UploadCloud size={24} color="#0052FF" />
                        <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0 }}>Digital Sync</h2>
                    </div>
                    <p style={{ fontSize: '14px', color: '#667085', marginBottom: '24px', fontWeight: '600' }}>Upload a new prescription to update the patient's care plan instantly.</p>
                    <div style={{ position: 'relative' }}>
                        <input type="file" accept="image/*" onChange={handleUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }} disabled={uploading} />
                        <button style={{ width: '100%', height: '56px', borderRadius: '16px', background: '#0052FF', color: 'white', border: 'none', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer' }}>
                            {uploading ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
                            {uploading ? "SYNCHRONIZING..." : "UPLOAD NEW PRESCRIPTION"}
                        </button>
                    </div>
                </div>

                <div style={{ background: 'white', padding: '32px', borderRadius: '32px', border: '1px solid #EAECF0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <ClipboardCheck size={24} color="#0052FF" />
                            <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0 }}>Active Medications</h2>
                        </div>
                        {updatedAt && (
                            <span style={{ fontSize: '11px', color: '#667085', fontWeight: '800' }}>
                                Authorized: {new Date(updatedAt).toLocaleDateString()}
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}><SkeletonCard /><SkeletonCard /></div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {medicines.map((m, i) => (
                                <div key={i} style={{ padding: '20px', borderRadius: '20px', border: '1px solid #EAECF0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#F0F5FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Pill size={24} color="#0052FF" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '16px', fontWeight: '900', color: '#101828' }}>{m.name}</div>
                                        <div style={{ fontSize: '13px', color: '#667085', fontWeight: '700' }}>{m.dosage} • {m.frequency}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '10px', fontWeight: '900', color: '#0052FF', textTransform: 'uppercase', marginBottom: '4px' }}>Scheduled</div>
                                        <div style={{ fontSize: '14px', fontWeight: '900', color: '#101828' }}>{m.scheduledTimes?.[0] || 'As needed'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </CaretakerShell>
    );
}
