// Public contact form endpoint with rate limiting
// No authentication required - for unauthenticated users

// Simple in-memory rate limiting
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 1; // 1 request per minute per IP
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  
  const requests = rateLimitMap.get(ip);
  
  // Remove old requests outside the window
  const validRequests = requests.filter(time => now - time < windowMs);
  rateLimitMap.set(ip, validRequests);
  
  if (validRequests.length >= maxRequests) {
    return false; // Rate limit exceeded
  }
  
  // Add current request
  validRequests.push(now);
  rateLimitMap.set(ip, validRequests);
  
  return true; // Rate limit OK
}

export default async (req, res) => {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', 'https://ialla.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only POST requests are allowed',
      timestamp: new Date().toISOString()
    });
    return;
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection?.remoteAddress || 
                    'unknown';
    
    // Check rate limit
    if (!checkRateLimit(clientIP)) {
      res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Please wait 1 minute before submitting again.',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validate request body
    const { firstName, lastName, country, mobile, email, message, subscribe } = req.body;
    
    if (!firstName || !lastName || !email || !message) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Missing required fields: firstName, lastName, email, message',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid email format',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Create email content
    const emailContent = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${firstName} ${lastName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Country:</strong> ${country || 'Not provided'}</p>
      <p><strong>Mobile:</strong> ${mobile || 'Not provided'}</p>
      <p><strong>Subscribe to newsletter:</strong> ${subscribe ? 'Yes' : 'No'}</p>
      <h3>Message:</h3>
      <p>${message}</p>
      <hr>
      <p><em>Submitted via iAlla.app contact form</em></p>
      <p><em>IP: ${clientIP}</em></p>
      <p><em>Timestamp: ${new Date().toISOString()}</em></p>
    `;

    // Send email using Resend (you'll need to configure this)
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.error('❌ Resend API key not configured');
      res.status(500).json({
        error: 'Service Unavailable',
        message: 'Email service not configured',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'contact@ialla.app', // Replace with your verified sender
        to: ['info@ialla.app'], // Replace with your contact email
        subject: `Contact Form: ${firstName} ${lastName} (${email})`,
        html: emailContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('❌ Resend API error:', errorData);
      res.status(500).json({
        error: 'Email Service Error',
        message: 'Failed to send email',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const emailResult = await emailResponse.json();
    console.log('✅ Contact form email sent:', emailResult.id);

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Contact form submitted successfully',
      submissionId: emailResult.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Contact form error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
};
