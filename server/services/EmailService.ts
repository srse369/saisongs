// Email service using Brevo (formerly Sendinblue) API
// Brevo has a generous free tier: 300 emails/day

interface BrevoEmailRequest {
  sender: {
    name: string;
    email: string;
  };
  to: Array<{
    email: string;
    name?: string;
  }>;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private apiKey: string;
  private senderEmail: string;
  private senderName: string;
  private apiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor() {
    this.apiKey = process.env.BREVO_API_KEY || '';
    this.senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@saisongs.local';
    this.senderName = process.env.BREVO_SENDER_NAME || 'Sai Songs';

    if (!this.apiKey) {
      console.warn('⚠️  EmailService: BREVO_API_KEY not configured. Emails will be logged to console only.');
    }
  }

  /**
   * Send an email using Brevo API
   */
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const { to, subject, html, text } = options;

    // If API key not configured, log to console instead
    if (!this.apiKey) {
      console.log('\n📧 ===== EMAIL (Development Mode - Not Sent) =====');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('HTML Content:', html);
      if (text) console.log('Text Content:', text);
      console.log('====================================================\n');
      return true; // Pretend success in development
    }

    try {
      const emailData: BrevoEmailRequest = {
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { raw: errorText };
        }
        console.error('❌ Brevo API Error:', response.status, response.statusText);
        console.error('Error details:', JSON.stringify(errorData, null, 2));
        return false;
      }

      const result = await response.json();
      console.log('✅ Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return false;
    }
  }

  /**
   * Check Brevo API health status
   */
  async checkHealth(): Promise<{ status: 'ok' | 'error'; message?: string; configured: boolean }> {
    if (!this.apiKey) {
      return { 
        status: 'error', 
        message: 'API key not configured', 
        configured: false 
      };
    }

    try {
      // Check Brevo account endpoint to verify API key and connectivity
      const response = await fetch('https://api.brevo.com/v3/account', {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { raw: errorText };
        }
        return {
          status: 'error',
          message: `API Error: ${response.status} ${response.statusText}`,
          configured: true
        };
      }

      return { status: 'ok', configured: true };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        configured: true
      };
    }
  }

  /**
   * Send OTP code email
   */
  async sendOTPEmail(email: string, code: string): Promise<boolean> {
    const subject = 'Your Sai Songs Login Code';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              padding: 20px 0;
              border-bottom: 2px solid #4F46E5;
            }
            .content {
              padding: 30px 20px;
            }
            .otp-code {
              text-align: center;
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #4F46E5;
              background: #F3F4F6;
              padding: 20px;
              border-radius: 8px;
              margin: 30px 0;
              font-family: 'Courier New', monospace;
            }
            .warning {
              background: #FEF2F2;
              border-left: 4px solid #EF4444;
              padding: 12px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              text-align: center;
              padding: 20px 0;
              color: #666;
              font-size: 12px;
              border-top: 1px solid #E5E7EB;
              margin-top: 30px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="color: #4F46E5; margin: 0;">🎵 Sai Songs</h1>
          </div>
          
          <div class="content">
            <h2 style="color: #333;">Your Login Code</h2>
            <p>Use this code to log in to Sai Songs. This code will expire in <strong>10 minutes</strong>.</p>
            
            <p style="text-align: center; margin: 20px 0; font-size: 18px; color: #333;">
              Your verification code is: <strong style="font-size: 24px; letter-spacing: 4px; color: #4F46E5;">${code}</strong>
            </p>
            
            <div class="otp-code">${code}</div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> Never share this code with anyone. Sai Songs staff will never ask for your login code.
            </div>
            
            <p style="color: #666; font-size: 14px;">
              If you didn't request this code, you can safely ignore this email.
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated message from Sai Songs.</p>
            <p>© ${new Date().getFullYear()} Sai Songs. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
Sai Songs - Your Login Code

Your verification code is: ${code}

This code will expire in 10 minutes.

⚠️ Security Notice: Never share this code with anyone. Sai Songs staff will never ask for your login code.

If you didn't request this code, you can safely ignore this email.

---
© ${new Date().getFullYear()} Sai Songs. All rights reserved.
    `.trim();

    return this.sendEmail({ to: email, subject, html, text });
  }

  /**
   * Test email configuration
   */
  async testConfiguration(): Promise<boolean> {
    if (!this.apiKey) {
      console.log('ℹ️  Email service in development mode (no API key)');
      return true;
    }

    console.log('🧪 Testing Brevo email configuration...');
    const testResult = await this.sendOTPEmail('test@example.com', '123456');
    
    if (testResult) {
      console.log('✅ Email configuration test passed');
    } else {
      console.log('❌ Email configuration test failed');
    }
    
    return testResult;
  }
}

// Export singleton instance
export const emailService = new EmailService();
