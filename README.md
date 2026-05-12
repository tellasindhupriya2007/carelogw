# CARELOG
CARELOG is a smart home-based elderly patient monitoring and healthcare coordination platform designed to improve communication, patient tracking, and healthcare management between caregivers, doctors, and family members.
The platform provides real-time patient monitoring, healthcare record management, caregiver coordination, and instant communication through a centralized cloud-based system.
---
## Features
- Real-time patient vitals monitoring
- Caregiver, Doctor, and Family dashboards
- Real-time messaging using WebSockets
- Shift handover management
- Alerts and notifications
- Prescription upload and record management
- Patient observations tracking
- Responsive Progressive Web Application (PWA)
- Secure cloud-based storage using Firebase
---
## Tech Stack
### Frontend
- React.js
- Tailwind CSS
- Recharts
### Backend
- Node.js
- Express.js
### Database & Cloud Services
- Firebase Firestore
- Firebase Authentication
- Firebase Storage
### Real-Time Communication
- Socket.IO
- WebSockets
### Deployment
- Vercel (Frontend)
- Render (Backend & WebSocket Server)
---
## System Architecture
CARELOG follows a modular client-server architecture.
- React.js handles the frontend UI and dashboards
- Node.js + Express.js manage APIs and backend logic
- Firebase Firestore stores patient data and healthcare records
- Socket.IO enables real-time communication
- Firebase Authentication secures user access
- Firebase Storage manages uploaded files and prescriptions
---
## User Roles
### Caregiver
- Record patient vitals
- Upload prescriptions
- Add observations
- Manage daily healthcare tasks
- Perform shift handovers
- Communicate with family members
### Doctor
- Monitor patient records
- Review vitals and observations
- Track patient health updates
- Coordinate with caregivers
### Family Member
- View patient updates
- Monitor healthcare activities
- Receive alerts and notifications
- Communicate with caregivers
---
## Installation
### Clone the Repository
```bash
git clone https://github.com/your-username/carelog.git
cd carelog

⸻

Frontend Setup

cd client
npm install
npm start

⸻

Backend Setup

cd server
npm install
npm run dev

⸻

Environment Variables

Create a .env file inside the server directory.

Example:

PORT=4001
FIREBASE_API_KEY=your_key
FIREBASE_AUTH_DOMAIN=your_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

⸻

Deployment

Frontend

Deployed using:

* Vercel

Backend & WebSocket Server

Deployed using:

* Render

⸻

Challenges Faced

During development, the project involved solving several real-world engineering challenges such as:

* Real-time synchronization issues
* WebSocket connection management
* Race conditions in messaging systems
* Mobile responsiveness optimization
* Cloud deployment configuration
* Firebase database synchronization

⸻

Future Enhancements

* Wearable device integration
* Telemedicine support
* Emergency response system
* IoT healthcare sensors
* Advanced healthcare analytics
* Offline synchronization support
* Multilingual accessibility

⸻

Project Goal

The goal of CARELOG is to simplify elderly patient care by creating a centralized healthcare monitoring platform that improves communication, coordination, and healthcare accessibility in home-based caregiving environments.

⸻

Authors

* Soudu Arun Kumar
* Sunkara Ramya Sree
* Tella Sindhu Priya
* Thallapelli Akash

⸻

License

This project is developed for academic and educational purposes.
