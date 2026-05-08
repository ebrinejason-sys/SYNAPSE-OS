export async function sendPilotApplicationNotification(data: any) {
  const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.log('VITE_RESEND_API_KEY is missing. Mocking email sending for:', data);
    return { success: true, message: 'Mock email sent' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Synapse OS <notifications@synapseos.tech>',
        to: 'founder@synapseos.tech',
        subject: `New Pilot Application: ${data.facilityName}`,
        html: `
          <h1>New Pilot Application Received</h1>
          <p><strong>Facility Name:</strong> ${data.facilityName}</p>
          <p><strong>Admin Name:</strong> ${data.adminName}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Facility Type:</strong> ${data.facilityType}</p>
          <p><strong>Bed Count:</strong> ${data.bedCount}</p>
          <p><strong>Pain Point:</strong> ${data.painPoint}</p>
          <p><strong>Plan Selected:</strong> ${data.plan}</p>
        `,
      }),
    });

    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.json();
      throw new Error(error.message);
    }
  } catch (err: any) {
    console.error('Failed to send email via Resend:', err);
    return { success: false, error: err.message };
  }
}
