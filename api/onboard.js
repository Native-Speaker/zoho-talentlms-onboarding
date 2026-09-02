// api/onboard.js
//
// This is the function Zoho's webhook calls every time a student
// submits the registration form. It:
//   1. Reads the incoming data from Zoho
//   2. Pulls out First Name, Last Name, Email, Password
//   3. Calls the TalentLMS API to create the user
//
// Confirmed exact Zoho field names via the Webhooks Configuration
// screen: First_Name, Last_Name, Email, Password.
//
// IMPORTANT: TalentLMS's v1 API expects classic form-encoded data
// (application/x-www-form-urlencoded), NOT JSON. Sending JSON gets
// silently ignored, which is why the first test just returned
// TalentLMS's default user list instead of creating anyone.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are accepted' });
  }

  const payload = req.body;

  console.log('Raw Zoho payload:', JSON.stringify(payload, null, 2));

  const firstName = payload.First_Name || '';
  const lastName = payload.Last_Name || '';
  const email = payload.Email || '';
  const password = payload.Password || '';

  if (!email || !password) {
    console.error('Missing required fields. Parsed values were:', {
      firstName,
      lastName,
      email,
      password: password ? '(present)' : '(missing)',
    });
    return res.status(400).json({
      error: 'Could not find required fields (email/password) in the payload.',
    });
  }

  const TALENTLMS_DOMAIN = process.env.TALENTLMS_DOMAIN; // e.g. nativespeaker.talentlms.com
  const TALENTLMS_API_KEY = process.env.TALENTLMS_API_KEY;

  const authHeader = 'Basic ' + Buffer.from(`${TALENTLMS_API_KEY}:`).toString('base64');

  // TalentLMS requires a "login" (username) as well as an email.
  // Using the email address as the login is the simplest, reliable choice.
  const formBody = new URLSearchParams({
    login: email,
    email: email,
    first_name: firstName,
    last_name: lastName,
    password: password,
  });

  try {
    const response = await fetch(`https://${TALENTLMS_DOMAIN}/api/v1/usersignup`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
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
