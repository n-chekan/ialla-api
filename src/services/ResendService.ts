import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { cacheService } from '../utils/cache.js';
import { loggingService } from '../utils/logging.js';
import { 
  EmailData,
  StudentInvitationData,
  TeacherInvitationData,
  ContactData,
  WelcomeData
} from '../types/index.js';
import { ExternalAPIError, ValidationError } from '../utils/errors.js';

/**
 * Resend Email Service for sending transactional emails
 * Ported from supabase/functions/send-email-unified/index.ts
 */
export class ResendService {
  private resend: Resend;
  private supabase: any;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('Resend API key not configured');
    }

    this.resend = new Resend(apiKey);

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Send email using Resend
   */
  async sendEmail(emailData: EmailData): Promise<{ id: string; status: string }> {
    const startTime = Date.now();
    
    try {
      console.log('📧 Resend Service: Sending email', { 
        type: emailData.emailType, 
        to: emailData.to 
      });

      // Validate email data
      this.validateEmailData(emailData.emailType, emailData.data);

      // Render email template
      const renderedEmail = this.renderEmailTemplate(emailData.emailType, emailData.data);

      // Send email via Resend
      const response = await this.resend.emails.send({
        from: 'iAlla <hello@ialla.app>',
        to: [emailData.to],
        subject: renderedEmail.subject,
        text: renderedEmail.text,
        html: renderedEmail.html,
        tags: renderedEmail.tags
      });

      const duration = Date.now() - startTime;

      if (response.error) {
        throw new Error(`Resend API error: ${response.error.message}`);
      }

      // Log the email send
      await this.logEmailSend(emailData, response.data?.id || 'unknown');

      // Log the API call
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'resend',
        endpoint: 'https://api.resend.com/emails',
        method: 'POST',
        requestBody: {
          to: emailData.to,
          subject: renderedEmail.subject,
          emailType: emailData.emailType
        },
        responseStatus: 200,
        responseBody: response.data,
        duration
      });

      console.log('✅ Resend Service: Email sent successfully', response.data?.id);
      return {
        id: response.data?.id || 'unknown',
        status: 'sent'
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'resend',
        endpoint: 'https://api.resend.com/emails',
        method: 'POST',
        responseStatus: 500,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      console.error('❌ Resend Service: Failed to send email:', error);
      throw new ExternalAPIError(
        'Failed to send email via Resend',
        'resend',
        error
      );
    }
  }

  /**
   * Validate email data for template
   */
  private validateEmailData(emailType: string, data: any): void {
    const requiredFields = this.getRequiredFields(emailType);
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      throw new ValidationError(
        `Missing required fields for ${emailType}: ${missingFields.join(', ')}`
      );
    }
  }

  /**
   * Get required fields for email type
   */
  private getRequiredFields(emailType: string): string[] {
    switch (emailType) {
      case 'student_invitation':
        return ['studentName', 'teacherName', 'invitationLink', 'language'];
      case 'teacher_invitation':
        return ['teacherName', 'studentName', 'invitationLink', 'language'];
      case 'contact':
        return ['name', 'email', 'message'];
      case 'welcome':
        return ['userName', 'language', 'dashboardLink'];
      default:
        throw new ValidationError(`Unknown email type: ${emailType}`);
    }
  }

  /**
   * Render email template
   */
  private renderEmailTemplate(emailType: string, data: any): {
    subject: string;
    text: string;
    html: string;
    tags: Array<{ name: string; value: string }>;
  } {
    switch (emailType) {
      case 'student_invitation':
        return this.renderStudentInvitation(data as StudentInvitationData);
      case 'teacher_invitation':
        return this.renderTeacherInvitation(data as TeacherInvitationData);
      case 'contact':
        return this.renderContact(data as ContactData);
      case 'welcome':
        return this.renderWelcome(data as WelcomeData);
      default:
        throw new ValidationError(`Unknown email type: ${emailType}`);
    }
  }

  /**
   * Render student invitation email
   */
  private renderStudentInvitation(data: StudentInvitationData): {
    subject: string;
    text: string;
    html: string;
    tags: Array<{ name: string; value: string }>;
  } {
    const subject = `You've been invited to learn ${data.language} with ${data.teacherName}`;
    
    const text = `
Hello ${data.studentName},

${data.teacherName} has invited you to join their ${data.language} learning session on iAlla.

Click here to accept the invitation: ${data.invitationLink}

Best regards,
The iAlla Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2563eb;">You've been invited to learn ${data.language}!</h2>
    
    <p>Hello ${data.studentName},</p>
    
    <p><strong>${data.teacherName}</strong> has invited you to join their ${data.language} learning session on iAlla.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.invitationLink}" 
         style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Accept Invitation
      </a>
    </div>
    
    <p>Best regards,<br>The iAlla Team</p>
  </div>
</body>
</html>
    `.trim();

    return {
      subject,
      text,
      html,
      tags: [
        { name: 'email_type', value: 'student_invitation' },
        { name: 'language', value: data.language }
      ]
    };
  }

  /**
   * Render teacher invitation email
   */
  private renderTeacherInvitation(data: TeacherInvitationData): {
    subject: string;
    text: string;
    html: string;
    tags: Array<{ name: string; value: string }>;
  } {
    const subject = `You've been invited to teach ${data.language} to ${data.studentName}`;
    
    const text = `
Hello ${data.teacherName},

${data.studentName} has invited you to be their ${data.language} teacher on iAlla.

Click here to accept the invitation: ${data.invitationLink}

Best regards,
The iAlla Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2563eb;">You've been invited to teach ${data.language}!</h2>
    
    <p>Hello ${data.teacherName},</p>
    
    <p><strong>${data.studentName}</strong> has invited you to be their ${data.language} teacher on iAlla.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.invitationLink}" 
         style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Accept Invitation
      </a>
    </div>
    
    <p>Best regards,<br>The iAlla Team</p>
  </div>
</body>
</html>
    `.trim();

    return {
      subject,
      text,
      html,
      tags: [
        { name: 'email_type', value: 'teacher_invitation' },
        { name: 'language', value: data.language }
      ]
    };
  }

  /**
   * Render contact email
   */
  private renderContact(data: ContactData): {
    subject: string;
    text: string;
    html: string;
    tags: Array<{ name: string; value: string }>;
  } {
    const subject = data.subject || `Contact from ${data.name}`;
    
    const text = `
Name: ${data.name}
Email: ${data.email}

Message:
${data.message}
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2563eb;">New Contact Form Submission</h2>
    
    <p><strong>Name:</strong> ${data.name}</p>
    <p><strong>Email:</strong> ${data.email}</p>
    
    <h3>Message:</h3>
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb;">
      ${data.message.replace(/\n/g, '<br>')}
    </div>
  </div>
</body>
</html>
    `.trim();

    return {
      subject,
      text,
      html,
      tags: [
        { name: 'email_type', value: 'contact' }
      ]
    };
  }

  /**
   * Render welcome email
   */
  private renderWelcome(data: WelcomeData): {
    subject: string;
    text: string;
    html: string;
    tags: Array<{ name: string; value: string }>;
  } {
    const subject = `Welcome to iAlla, ${data.userName}!`;
    
    const text = `
Welcome to iAlla, ${data.userName}!

We're excited to help you learn ${data.language}. Get started by visiting your dashboard:

${data.dashboardLink}

Best regards,
The iAlla Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2563eb;">Welcome to iAlla, ${data.userName}!</h2>
    
    <p>We're excited to help you learn <strong>${data.language}</strong>.</p>
    
    <p>Get started by visiting your dashboard:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.dashboardLink}" 
         style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Go to Dashboard
      </a>
    </div>
    
    <p>Best regards,<br>The iAlla Team</p>
  </div>
</body>
</html>
    `.trim();

    return {
      subject,
      text,
      html,
      tags: [
        { name: 'email_type', value: 'welcome' },
        { name: 'language', value: data.language }
      ]
    };
  }

  /**
   * Log email send to Supabase
   */
  private async logEmailSend(emailData: EmailData, resendId: string): Promise<void> {
    try {
      await this.supabase.from('unified_logs').insert({
        event_category: 'system',
        event_type: 'email_sent',
        user_id: null, // Will be set by client if available
        event_data: {
          template: emailData.emailType,
          resend_id: resendId,
          recipient: emailData.to,
          ...emailData.data
        },
        metadata: {
          sent_at: new Date().toISOString(),
          api_middlelayer: true
        }
      });
    } catch (error) {
      console.error('❌ Failed to log email send:', error);
    }
  }
}

// Export singleton instance
export const resendService = new ResendService();
export default resendService;
