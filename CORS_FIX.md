# 🔗 1-Minute Fix: Enable Prescription Uploads (CORS)

Your console shows `Blocked by CORS policy`. This is a security feature from Google that prevents your `localhost` from writing to your Storage bucket until you approve it.

### Step-by-Step "Unlock All" Fix:
1. Go directly to [shell.cloud.google.com](https://shell.cloud.google.com).
2. Ensure you are in project `carelog-e2196`.
3. In the terminal that opens at the bottom, paste this EXACT command:
   ```bash
   echo '[{"origin": ["*"],"method": ["GET", "POST", "PUT", "DELETE", "HEAD"],"responseHeader": ["*"],"maxAgeSeconds": 3600}]' > cors.json
   gsutil cors set cors.json gs://carelog-e2196.appspot.com
   ```
4. Press Enter. Done! Your uploads will work immediately.

---

### IMPORTANT: Restart Your Local App
If you still see errors, it is because your local app is still using old settings.
1. Go to your local terminal where `npm run dev` is running.
2. Press **CTRL+C** to stop it.
3. Run **npm run dev** again.

### Why was it failing?
- **Index Error**: I fixed this in the code—no more index required!
- **Socket Error**: Your Render server falls asleep. Refresh the page and wait 45 seconds; it will wake up automatically.
- **CORS Error**: You MUST run the command above in the Google Cloud Shell to tell Google that your computer is allowed to upload files.
