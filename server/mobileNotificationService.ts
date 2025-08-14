import nodemailer from 'nodemailer';

interface MobileNotificationConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export class MobileNotificationService {
  private transporter: nodemailer.Transporter;
  private fromEmail: string;

  constructor() {
    const config: MobileNotificationConfig = {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      },
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || ''
    };

    this.fromEmail = config.from;
    this.transporter = nodemailer.createTransporter(config);
  }

  /**
   * Send instant notification email that works like a mobile notification
   */
  async sendInstantMobileNotification(
    email: string, 
    title: string, 
    message: string
  ): Promise<boolean> {
    try {
      console.log(`📧 Sending instant mobile notification to ${email}`);
      
      // Create mobile-friendly email that acts like a notification
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: `🔔 ${title}`, // Bell emoji makes it look like a notification
        html: `
          <div style="
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 400px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          ">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="
                margin: 0;
                font-size: 24px;
                font-weight: 600;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
              ">🔔 BuildFlow Pro</h1>
            </div>
            
            <div style="
              background: rgba(255,255,255,0.1);
              padding: 20px;
              border-radius: 8px;
              backdrop-filter: blur(10px);
              margin-bottom: 20px;
            ">
              <h2 style="
                margin: 0 0 10px 0;
                font-size: 18px;
                font-weight: 600;
              ">${title}</h2>
              
              <p style="
                margin: 0;
                font-size: 16px;
                line-height: 1.5;
                opacity: 0.95;
              ">${message}</p>
            </div>
            
            <div style="
              text-align: center;
              font-size: 12px;
              opacity: 0.8;
            ">
              Sent at ${new Date().toLocaleString('en-AU', { 
                timeZone: 'Australia/Melbourne',
                hour12: true 
              })}
            </div>
          </div>
        `,
        text: `🔔 BuildFlow Pro Alert\n\n${title}\n\n${message}\n\nSent at ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })}`
      });

      console.log(`✅ Mobile notification sent successfully to ${email}`);
      return true;
    } catch (error) {
      console.error('Mobile notification error:', error);
      return false;
    }
  }

  /**
   * Send notification with mobile fallback
   */
  async sendNotificationWithMobileFallback(
    userEmail: string,
    title: string,
    message: string,
    pushSuccess: boolean = false
  ): Promise<boolean> {
    // If push notification succeeded, no need for fallback
    if (pushSuccess) {
      return true;
    }

    // Send instant mobile notification as fallback
    return await this.sendInstantMobileNotification(userEmail, title, message);
  }

  /**
   * Test mobile notification
   */
  async testMobileNotification(email: string): Promise<boolean> {
    const title = "Mobile Notification Test";
    const message = "This instant email notification proves your mobile alerts are working! Check your phone for this message.";
    
    return await this.sendInstantMobileNotification(email, title, message);
  }
}

// Export singleton instance
export const mobileNotificationService = new MobileNotificationService();