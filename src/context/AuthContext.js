import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, limit, query } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import logo from '../assets/logo.png';

export const AuthContext = createContext();

export const useAuthContext = () => useContext(AuthContext);

const googleProvider = new GoogleAuthProvider();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [patientId, setPatientId] = useState(null);
    const [photoURL, setPhotoURL] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isDev, setIsDev] = useState(false);

    useEffect(() => {
        const startTime = Date.now();

        // ── 1. Safety Timeout ──────────────────────────────
        // If Firebase/Firestore fails to respond within 5s,
        // force clear the splash screen so the app remains usable.
        const safetyTimer = setTimeout(() => {
            console.warn("[Auth] Auth check timed out. Forcing loading false.");
            setLoading(false);
        }, 5000);

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                setPhotoURL(firebaseUser.photoURL || null);
                setIsDev(false);
                try {
                    // Fetch profile from Firestore with a short "abandon" timer
                    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setRole(userData.role || null);
                        setPatientId(userData.patientId || userData.assignedPatientId || null);
                        if (userData.photoURL) setPhotoURL(userData.photoURL);
                    } else {
                        setRole(null);
                        setPatientId(null);
                    }
                } catch (error) {
                    console.error("[Auth] Error fetching user profile:", error);
                    setRole(null);
                    setPatientId(null);
                }
            } else {
                setUser(null);
                setRole(null);
                setPatientId(null);
                setPhotoURL(null);
                setIsDev(false);
            }

            const timeElapsed = Date.now() - startTime;
            clearTimeout(safetyTimer);
            
            if (timeElapsed < 1200) {
                setTimeout(() => setLoading(false), 1200 - timeElapsed);
            } else {
                setLoading(false);
            }
        });

        return () => {
            unsubscribe();
            clearTimeout(safetyTimer);
        };
    }, []);

    /**
     * Google Sign In.
     * @param {string} selectedRole - The role the user selected on splash (family/caretaker/doctor)
     * @returns {{ isNewUser: boolean, userRole: string, userPatientId: string|null }}
     */
    const signInWithGoogle = async (selectedRole) => {
        setIsDev(false);
        const result = await signInWithPopup(auth, googleProvider);
        const firebaseUser = result.user;

        // Check if Firestore document already exists
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            // Returning user — read their existing data
            const userData = userDocSnap.data();
            setRole(userData.role);
            setPatientId(userData.patientId || userData.assignedPatientId || null);
            setPhotoURL(firebaseUser.photoURL || userData.photoURL || null);
            setUser(firebaseUser);
            return {
                isNewUser: false,
                userRole: userData.role,
                userPatientId: userData.patientId || userData.assignedPatientId || null
            };
        } else {
            // New user — create Firestore document with selected role
            const newUserData = {
                name: firebaseUser.displayName || 'CareLog User',
                email: firebaseUser.email || '',
                photoURL: firebaseUser.photoURL || '',
                role: selectedRole,
                patientId: null,
                createdAt: serverTimestamp()
            };
            await setDoc(userDocRef, newUserData);
            setRole(selectedRole);
            setPatientId(null);
            setPhotoURL(firebaseUser.photoURL || null);
            setUser(firebaseUser);
            return {
                isNewUser: true,
                userRole: selectedRole,
                userPatientId: null
            };
        }
    };

    /**
     * Development Mode Login.
     * Bypasses Google/Firebase auth for rapid testing.
     * @param {string} devRole - family/caretaker/doctor
     */
    const devLogin = async (devRole) => {
        setIsDev(true);
        const mockUid = `dev-${devRole}`;
        const mockUser = {
            uid: mockUid,
            displayName: `Dev ${devRole.charAt(0).toUpperCase() + devRole.slice(1)}`,
            email: `${devRole}@dev.carelog`,
            photoURL: `https://ui-avatars.com/api/?name=Dev+${devRole}&background=random`
        };

        setUser(mockUser);
        setRole(devRole);
        const mockPatientId = 'DEV-PATIENT-001';
        console.log("[AuthContext] DevLogin using local patient ID:", mockPatientId);

        setPatientId(mockPatientId);
        setPhotoURL(mockUser.photoURL);

        return {
            isNewUser: false,
            userRole: devRole,
            userPatientId: mockPatientId
        };
    };

    const logout = async () => {
        await signOut(auth);
        setUser(null);
        setRole(null);
        setPatientId(null);
        setPhotoURL(null);
        setIsDev(false);
        // Clear any cached data
        try { sessionStorage.clear(); } catch (e) { }
    };

    const setRoleAndPatient = (newRole, newPatientId) => {
        setRole(newRole);
        setPatientId(newPatientId);
    };

    if (loading) {
        return (
            <div style={{
                backgroundColor: '#F8FAFC',
                background: 'linear-gradient(to bottom right, #f8fafc, #eef2ff)',
                height: '100vh',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'column',
                position: 'fixed',
                top: 0,
                left: 0,
                zIndex: 9999
            }}>
                <div style={{
                    position: 'relative',
                    marginBottom: '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    <img 
                        src={logo} 
                        alt="CareLog Logo" 
                        style={{ 
                            width: '120px', 
                            height: 'auto', 
                            objectFit: 'contain', 
                            animation: 'pulse-scale 2s infinite ease-in-out',
                            mixBlendMode: 'multiply'
                        }} 
                    />
                    <div style={{
                        marginTop: '24px',
                        fontSize: '28px',
                        fontWeight: '700',
                        color: '#0F172A',
                        letterSpacing: '-1px'
                    }}>
                        CareLog
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div className="loader-container">
                        <div className="loader-bar"></div>
                    </div>
                    <p style={{ 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        color: '#64748B',
                        animation: 'fade-in-out 2s infinite'
                    }}>
                        Setting up your workspace...
                    </p>
                </div>

                <style>{`
                    @keyframes pulse-scale {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                    }
                    @keyframes fade-in-out {
                        0%, 100% { opacity: 0.6; }
                        50% { opacity: 1; }
                    }
                    .loader-container {
                        width: 140px;
                        height: 4px;
                        background: rgba(37, 99, 235, 0.1);
                        border-radius: 99px;
                        overflow: hidden;
                        position: relative;
                    }
                    .loader-bar {
                        width: 40%;
                        height: 100%;
                        background: #2563EB;
                        border-radius: 99px;
                        position: absolute;
                        left: -40%;
                        animation: loading-shimmer 1.5s infinite ease-in-out;
                    }
                    @keyframes loading-shimmer {
                        0% { left: -40%; }
                        100% { left: 100%; }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{
            user, role, patientId, photoURL, isDev,
            setPatientId, signInWithGoogle, logout, setRoleAndPatient, devLogin
        }}>
            {children}
        </AuthContext.Provider>
    );

};
