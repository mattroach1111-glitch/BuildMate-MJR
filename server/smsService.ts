import nodemailer from 'nodemailer';

// SMS-to-Email gateway mappings for Australian carriers
const SMS_GATEWAYS = {
  'telstra': '@sms.telstra.com',
  'optus': '@optusmobile.com.au', 
  'vodafone': '@vtext.com',
  'tpg': '@sms.tpgmobile.com.au',
  'boost': '@sms.boostmobile.com.au',
  'auto': '' // Auto-detect or use default
};

// Backup gateways for better delivery rates
const BACKUP_GATEWAYS = [
  '@txt.att.net',
  '@messaging.sprintpcs.com',
  '@tmomail.net',
  '@vtext.com'
];

interface SMSConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export class SMSService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const config: SMSConfig = {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    };

    this.transporter = nodemailer.createTransport(config);
  }

  /**
   * Send SMS notification via email-to-SMS gateway
   */
  async sendSMS(phoneNumber: string, message: string, carrier: string = 'auto'): Promise<boolean> {
    try {
      // Clean phone number (remove spaces, dashes, etc.)
      const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
      
      // Format Australian mobile number
      let formattedPhone = cleanPhone;
      if (cleanPhone.startsWith('0')) {
        formattedPhone = '61' + cleanPhone.substring(1); // Convert 04xxxxxxxx to 614xxxxxxxx
      } else if (cleanPhone.startsWith('+61')) {
        formattedPhone = cleanPhone.substring(1); // Remove +
      } else if (!cleanPhone.startsWith('61')) {
        formattedPhone = '61' + cleanPhone; // Add country code
      }

      // Try multiple SMS gateways for reliability
      let gatewaysToTry: string[] = [];
      
      if (carrier !== 'auto' && SMS_GATEWAYS[carrier as keyof typeof SMS_GATEWAYS]) {
        // Use specific carrier gateway first, then backups
        gatewaysToTry = [
          SMS_GATEWAYS[carrier as keyof typeof SMS_GATEWAYS],
          ...BACKUP_GATEWAYS
        ];
      } else {
        // Use all Australian gateways plus backups
        gatewaysToTry = [
          ...Object.values(SMS_GATEWAYS).filter(g => g !== ''),
          ...BACKUP_GATEWAYS
        ];
      }

      // Limit message length for SMS (160 characters max)
      const truncatedMessage = message.length > 160 
        ? message.substring(0, 157) + '...'
        : message;

      console.log(`📱 Attempting SMS to ${formattedPhone}: ${truncatedMessage}`);
      console.log(`📱 Will try ${gatewaysToTry.length} gateways for delivery`);

      for (const gateway of gatewaysToTry) {
        try {
          const smsEmail = `${formattedPhone}${gateway}`;
          
          await this.transporter.sendMail({
            from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
            to: smsEmail,
            subject: '', // SMS doesn't use subject
            text: truncatedMessage
          });

          console.log(`✅ SMS sent successfully via ${gateway}`);
          return true;
        } catch (gatewayError) {
          console.log(`❌ Failed to send SMS via ${gateway}:`, gatewayError);
          continue; // Try next gateway
        }
      }

      throw new Error('All SMS gateways failed');
    } catch (error) {
      console.error('SMS Service Error:', error);
      return false;
    }
  }

  /**
   * Send notification with SMS fallback if push notifications fail
   */
  async sendNotificationWithSMSFallback(
    phoneNumber: string | null, 
    title: string, 
    message: string,
    pushNotificationSuccess: boolean = false
  ): Promise<boolean> {
    // If push notification succeeded or no phone number, skip SMS
    if (pushNotificationSuccess || !phoneNumber) {
      return pushNotificationSuccess;
    }

    // Format SMS message
    const smsMessage = `${title}: ${message}`;
    
    return await this.sendSMS(phoneNumber, smsMessage);
  }

  /**
   * Test SMS functionality
   */
  async testSMS(phoneNumber: string): Promise<boolean> {
    const testMessage = 'BuildFlow Pro SMS test - notifications working!';
    return await this.sendSMS(phoneNumber, testMessage);
  }
}

// Export singleton instance
export const smsService = new SMSService();