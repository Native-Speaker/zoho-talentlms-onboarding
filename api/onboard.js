// api/onboard.js
//
// This is the function Zoho's webhook calls every time a student
// submits the registration form. It:
//   1. Reads the incoming data from Zoho
//   2. Pulls out First Name, Last Name, Email, Password
//   3. Calls the TalentLMS API to create the user
//   4. Enrolls the new user into the ATU2627 course
//
// Confirmed exact Zoho field names via the Webhooks Configuration
// screen: First_Name, Last_Name, Email, Password.
//
// IMPORTANT: TalentLMS's v1 API expects classic form-encoded data
// (application/x-www-form-urlencoded), NOT JSON.

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

  const TALENTLMS_DOMAIN = process.env.TALENTLMS_DOMAIN;
  const TALENTLMS_API_KEY = process.env.TALENTLMS_API_KEY;

  const authHeader = 'Basic ' + Buffer.from(`${TALENTLMS_API_KEY}:`).toString('base64');

  const safeLogin = email
    .split('@')[0]
    .replace(/[^a-zA-Z0-9._]/g, '');

  const formBody = new URLSearchParams({
    login: safeLogin,
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

    // Now enroll the new user into ATU2627 (TalentLMS course id 276).
    const newUserId = result.id;
    const enrollBody = new URLSearchParams({
      user_id: newUserId,
      course_id: '276',
    });

    const enrollResponse = await fetch(`https://${TALENTLMS_DOMAIN}/api/v1/addusertocourse`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: enrollBody.toString(),
    });

    const enrollResult = await enrollResponse.json();

    if (!enrollResponse.ok) {
      console.error('User created, but course enrollment failed:', enrollResult);
      return res.status(200).json({
        success: true,
        user: result,
        enrollmentWarning: 'User created but could not be enrolled in the course automatically',
        enrollmentError: enrollResult,
      });
    }

    console.log('User successfully enrolled in course 276 (ATU2627):', enrollResult);
    return res.status(200).json({ success: true, user: result, enrollment: enrollResult });
  } catch (err) {
    console.error('Error calling TalentLMS API:', err);
    return res.status(500).json({ error: 'Server error creating user' });
  }
}
