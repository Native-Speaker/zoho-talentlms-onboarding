# Zoho → TalentLMS onboarding

Small Vercel function that receives a webhook from the ATU Zoho
registration form and creates the matching student account in
TalentLMS automatically.

## Setup steps

1. **Deploy this project to Vercel** (new project, not the writing
   tool one).
2. In Vercel, go to Project → Settings → Environment Variables and add:
   - `TALENTLMS_DOMAIN` → `nativespeaker.talentlms.com`
   - `TALENTLMS_API_KEY` → your TalentLMS API key
3. Deploy. Your webhook URL will be:
   `https://<your-project-name>.vercel.app/api/onboard`
4. In Zoho Forms: **Settings → Integrations → Webhooks** → add a new
   webhook, paste the URL above, method POST.
5. Submit a **test entry** on the live form.
6. In Vercel: **Deployments → (latest) → Functions → Logs**, find the
   log line `Raw Zoho payload:` and see the exact field names Zoho
   sent.
7. Tell Claude those exact field names — the mapping in
   `api/onboard.js` (the `firstName` / `lastName` / `email` /
   `password` lines) gets updated to match exactly, and the guesswork
   fallback is removed.
8. Submit another test entry and confirm the student appears in
   TalentLMS.

## Notes

- Only Name, Email, and Password are sent to TalentLMS. Every other
  field on the form (photos, signature, student number, etc.) stays
  in Zoho for manual verification.
- The current version of `api/onboard.js` guesses at a few likely
  field name variations so it has a chance of working on the very
  first test — but step 6 above is the important one to confirm it
  for real.
