import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDocs, getDoc, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

// Trigger an alert and save it to the 'alerts' collection
export const triggerAlert = async (patientId, type, message, source) => {
    try {
        // Fetch patient to get doctorId and name
        const pSnap = await getDoc(doc(db, 'patients', patientId));
        const pData = pSnap.exists() ? pSnap.data() : { name: 'Unknown' };

        const alertsRef = collection(db, 'alerts');
        await addDoc(alertsRef, {
            patientId,
            patientName: pData.name || 'Unknown',
            doctorId: pData.doctorId || null,
            type, // "critical" | "warning" | "normal"
            message,
            severity: type, // fallback for legacy
            source, // "vitals" | "task" | "observation"
            isRead: false,
            status: 'active',
            createdAt: serverTimestamp()
        });
        console.log(`Alert triggered: ${message}`);
    } catch (e) {
        console.error("Error triggering alert: ", e);
    }
};

// Check if there are any alerts for a patient, if not generate mock data
export const preloadMockAlertsIfNeeded = async (patientId) => {
    // Intentionally left blank. Real alerts only.
}

// Mark an alert as read
export const markAlertAsRead = async (alertId) => {
    try {
        const alertRef = doc(db, 'alerts', alertId);
        await updateDoc(alertRef, {
            isRead: true
        });
    } catch (e) {
        console.error("Error marking alert as read: ", e);
    }
};

// Real-time listener for alerts for a specific patient OR doctor (if provided)
export const listenToAlerts = ({ patientId = null, doctorId = null }, callback) => {
    let q;
    if (patientId) {
        q = query(collection(db, 'alerts'), where('patientId', '==', patientId));
    } else if (doctorId) {
        q = query(collection(db, 'alerts'), where('doctorId', '==', doctorId));
    } else {
        // SECURITY FAILSAFE: Never fetch all alerts. Return empty if no filter.
        q = query(collection(db, 'alerts'), where('patientId', '==', 'NONE_UNAUTHORIZED'));
    }
    
    return onSnapshot(q, (snapshot) => {
        const alerts = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
                const ta = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                const tb = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                return tb - ta; // desc
            });
        callback(alerts);
    });
};
