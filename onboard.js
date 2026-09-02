// api/onboard.js
//
// This is the function Zoho's webhook will call every time a student
// submits the registration form. It:
//   1. Reads the incoming data from Zoho
//   2. Pulls out First Name, Last Name, Email, Password
//   3. Calls the TalentLMS API to create the user
//
// IMPORTANT FIRST STEP: we don't yet know the exact field names Zoho
// will send (that depends on how Zoho names them internally, which can
// differ from the labels shown on the form). So this script starts in
// "logging mode" — it will print out the FULL raw payload it receives
// to the Vercel logs. Once we see one real submission, we lock in the
// exact field names and remove the guesswork below.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are accepted' });
  }

  const payload = req.body;

  // TEMP: log the raw payload so we can see exactly what Zoho sends.
  // Check this in Vercel -> your project -> Deployments -> Functions -> Logs
  console.log('Raw Zoho payload:', JSON.stringify(payload, null, 2));

  // --- Best-guess field extraction ---
  // Zoho Forms webhooks typically send field data keyed by the field's
  // internal "label" (which is usually close to, but not always
  // identical to, what's shown on the form). We try a few likely
  // variations here. Once we've seen a real payload, we'll replace
  // this section with the exact keys.
  const firstName =
    payload.First_Name || payload.FirstName || payload['First Name'] || '';
  const lastName =
    payload.Last_Name || payload.LastName || payload['Last Name'] || '';
  const email = payload.Email || payload.email || payload['Your Email'] || '';
  const password =
    payload.Password || payload.password || payload['Password'] || '';

  if (!email || !password) {
    console.error('Missing required fields. Parsed values were:', {
      firstName,
      lastName,
      email,
      password: password ? '(present)' : '(missing)',
    });
    return res.status(400).json({
      error:
        'Could not find required fields (email/password) in the payload. Check the Vercel logs for the raw payload and update the field mapping in api/onboard.js.',
    });
  }

  const TALENTLMS_DOMAIN = process.env.TALENTLMS_DOMAIN; // e.g. nativespeaker.talentlms.com
  const TALENTLMS_API_KEY = process.env.TALENTLMS_API_KEY;

  const authHeader = 'Basic ' + Buffer.from(`${TALENTLMS_API_KEY}:`).toString('base64');

  try {
    const response = await fetch(`https://${TALENTLMS_DOMAIN}/api/v1/users`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: password,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('TalentLMS API error:', result);
      return res.status(502).json({
        error: 'TalentLMS rejected the request',
        details: result,
      });
    }

    console.log('TalentLMS user created successfully:', result);
    return res.status(200).json({ success: true, user: result });
  } catch (err) {
    console.error('Error calling TalentLMS API:', err);
    return res.status(500).json({ error: 'Server error creating user' });
  }
}
