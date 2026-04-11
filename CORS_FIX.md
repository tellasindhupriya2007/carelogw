# 🛠️ Fix: Unblock Photos, Voice, and Prescriptions

Your clinical uploads are currently failing because **Firebase Storage** is blocking requests from your local browser (CORS Policy). Follow these steps to fix it:

### Option 1: The Fast Way (GCP Console)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Open the **Cloud Shell** (the `>_` icon in the top right).
3. Create a file named `cors.json` by running:
   ```bash
   nano cors.json
   ```
4. Paste this exact configuration:
   ```json
   [
     {
       "origin": ["*"],
       "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
       "responseHeader": ["Content-Type", "Authorization", "x-goog-resumable"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
5. Press `CTRL+O`, then `ENTER`, then `CTRL+X` to save.
6. Apply the fix to your bucket (Replace `YOUR_BUCKET_ID` with `carelog-e2196.appspot.com`):
   ```bash
   gsutil cors set cors.json gs://carelog-e2196.appspot.com
   ```

### Option 2: Verify WebSockets
If you are seeing "Socket connection failed" in the console, it means the Render backend is idling. 
1. Open [https://carelog-backend.onrender.com](https://carelog-backend.onrender.com) in your browser.
2. If it loads "CareLog Backend is running," the sockets will reconnect automatically.

---
**Once these are applied, your voice recordings and prescriptions will start syncing instantly!**
