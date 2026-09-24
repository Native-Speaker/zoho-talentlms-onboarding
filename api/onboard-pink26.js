// api/onboard-pink26.js  (PINK26 cohort - generated passwords)

import crypto from 'crypto';

// >>> SET THIS to the Pink 26 course ID from TalentLMS <<<
const COURSE_ID = '277';
//
// This is the function Zoho's webhook calls every time a student
// submits the registration form. It:
//   1. Reads the incoming data from Zoho
//   2. Pulls out First Name, Last Name, Email, Password
//   3. Calls the TalentLMS API to create the user
//   4. Enrolls the new user into the ATU course (id 276)
//   5. Removes the new user from HUMPIS SCHULE (id 271), as a safety net
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
  // No password on the PINK26 form, so generate one (10 chars, easy to type)
  const password = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) + '7a';

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
    console.log(`PINK26 login for ${email}: username=${safeLogin} password=${password}`);

    // Enroll the new user into the ATU course (TalentLMS course id 276).
    const newUserId = result.id;
    const enrollBody = new URLSearchParams({
      user_id: newUserId,
      course_id: COURSE_ID,
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

    console.log(`User enrolled in PINK26 course ${COURSE_ID}:`, enrollResult);

    // Safety net: automatically remove the new user from HUMPIS SCHULE
    // (course id 271), regardless of TalentLMS's default-group setting.
    let removalResult = null;
    try {
      const removeResponse = await fetch(
        `https://${TALENTLMS_DOMAIN}/api/v1/removeuserfromcourse/user_id:${newUserId},course_id:271`,
        {
          method: 'GET',
          headers: {
            Authorization: authHeader,
          },
        }
      );
      removalResult = await removeResponse.json();
      if (removeResponse.ok) {
        console.log('User removed from HUMPIS SCHULE (course 271):', removalResult);
      } else {
        console.log('Could not remove user from course 271 (may not have been enrolled):', removalResult);
      }
    } catch (removeErr) {
      console.error('Error trying to remove user from course 271:', removeErr);
    }

    return res.status(200).json({
      success: true,
      login: safeLogin,
      password,
      user: result,
      enrollment: enrollResult,
      humpisRemoval: removalResult,
    });
  } catch (err) {
    console.error('Error calling TalentLMS API:', err);
    return res.status(500).json({ error: 'Server error creating user' });
  }
}
