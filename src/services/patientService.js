/**
 * CareLog — Patient Service
 * Central Firestore CRUD for the `patients` collection.
 * PatientId = Firestore auto-generated doc ID, used across all modules.
 */

import {
    collection, addDoc, doc, getDoc, getDocs, updateDoc,
    query, where, onSnapshot, serverTimestamp, orderBy, limit, arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { generatePatientId } from '../utils/idGenerator';

// ─── Collection reference ─────────────────────────────────
const PATIENTS = 'patients';

// ─── CREATE ───────────────────────────────────────────────

/**
 * Create a new patient.
 * Returns the Firestore-generated patientId (auto-ID).
 *
 * @param {Object} data  Patient fields from the form
 * @returns {string} patientId (Firestore auto-ID)
 */
export const createPatient = async ({
    name,
    age,
    gender,
    dob,
    bloodGroup,
    conditions,
    allergies,
    medications,
    emergencyContact,
    emergencyPhone,
    doctorId,
    caregiverId,
    familyId,
    address,
    notes,
}) => {
    if (!name?.trim()) throw new Error('Patient name is required.');

    // ─── UNIQUE ID GENERATION LOOP ────────────────────────────
    let humanId = '';
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 5) {
        humanId = generatePatientId().toUpperCase();
        const q = query(collection(db, PATIENTS), where('patientId', '==', humanId));
        const snap = await getDocs(q);
        if (snap.empty) {
            isUnique = true;
        } else {
            console.warn(`ID Collision detected for ${humanId}, retrying...`);
            attempts++;
        }
    }
    // ──────────────────────────────────────────────────────────

    const ref = await addDoc(collection(db, PATIENTS), {
        // Human ID for display and linking
        patientId: humanId,

        // Identity
        name: name.trim(),
        age: Number(age) || null,
        gender: gender || null,
        dob: dob || null,
        bloodGroup: bloodGroup || null,

        // Clinical
        conditions: conditions || '',
        allergies: allergies || '',
        medications: medications || '',
        notes: notes || '',

        // Emergency
        emergencyContact: emergencyContact || '',
        emergencyPhone: emergencyPhone || '',

        // Location
        address: address || '',

        // Relations
        doctorId: doctorId || null,
        caregiverId: caregiverId || null,
        familyId: familyId || null,
        caretakerIds: caregiverId ? [caregiverId] : [], // Multiple support

        // Meta
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return ref.id; // Returns doc.id (long string)
};

// ─── READ ─────────────────────────────────────────────────

/** Get a single patient doc by ID. */
export const getPatient = async (patientId) => {
    if (!patientId) return null;
    const snap = await getDoc(doc(db, PATIENTS, patientId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/** Live-subscribe to a single patient. */
export const subscribeToPatient = (patientId, callback) => {
    if (!patientId) return () => {};
    return onSnapshot(doc(db, PATIENTS, patientId), (snap) => {
        callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
};

/** Live-subscribe to all patients for a doctor. */
export const subscribeToDoctorPatients = (doctorId, callback) => {
    if (!doctorId) return () => {};
    const q = query(collection(db, PATIENTS), where('doctorId', '==', doctorId));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.warn('[patientService] subscribeToDoctorPatients error:', err.message));
};

/** Live-subscribe to patients for a caregiver. */
export const subscribeToCaregiverPatients = (caregiverId, callback) => {
    if (!caregiverId) return () => {};
    // Check either single caregiverId or multiple caretakerIds array
    const q = query(collection(db, PATIENTS), where('caretakerIds', 'array-contains', caregiverId));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
};

/** Live-subscribe to patients for a family member. */
export const subscribeToFamilyPatients = (familyId, callback) => {
    if (!familyId) return () => {};
    const q = query(collection(db, PATIENTS), where('familyId', '==', familyId));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
};

// ─── UPDATE ───────────────────────────────────────────────

/** Update patient fields. */
export const updatePatient = async (patientId, fields) => {
    if (!patientId) throw new Error('patientId required');
    await updateDoc(doc(db, PATIENTS, patientId), {
        ...fields,
        updatedAt: serverTimestamp(),
    });
};

/** Link a doctor to an existing patient profile by its Firestore ID. */
export const assignDoctor = (patientId, doctorId) =>
    updatePatient(patientId, { doctorId });

/** Assign a caregiver to an existing patient. */
export const assignCaregiver = (patientId, caregiverId) =>
    updatePatient(patientId, { caregiverId, caretakerIds: arrayUnion(caregiverId) });

/** Assign a family member to an existing patient. */
export const assignFamily = (patientId, familyId) =>
    updatePatient(patientId, { familyId });

/** Link to a patient via their human-readable Patient ID (CL-XXXX). */
export const linkById = async (humanId, userId, role) => {
    const q = query(collection(db, PATIENTS), where('patientId', '==', humanId.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Invalid Patient ID. Not found.');
    
    const pDoc = snap.docs[0];
    const update = {};
    if (role === 'doctor') update.doctorId = userId;
    if (role === 'family') update.familyId = userId;
    if (role === 'caretaker') update.caretakerIds = arrayUnion(userId);
    
    await updateDoc(doc(db, PATIENTS, pDoc.id), update);
    return pDoc.id;
};

// ─── DEPRECATED ──────────────────────────────────────────
/**
 * Auto-seed sample patients - DEPRECATED: Transitioned to real-data only.
 */
export const seedSamplePatientsIfEmpty = async () => {
    // Seeding disabled to follow real-patient workflow.
    return;
};
