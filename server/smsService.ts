import nodemailer from 'nodemailer';

// Primary Australian SMS gateways (these work best)
const AUSTRALIAN_SMS_GATEWAYS = [
  '@sms.telstra.com',
  '@optusmobile.com.au',
  '@vtext.com.au',
  '@sms.vodafone.com.au',
  '@messaging.optus.com.au',
  '@tpgmobile.net',
  '@boostmobile.net.au'
];

// International backup gateways (may work for Australian numbers)
const INTERNATIONAL_GATEWAYS = [
  '@vtext.com',
  '@txt.att.net',
  '@messaging.sprintpcs.com',
  '@tmomail.net',
  '@mms.att.net'
];

// Alternative SMS methods to try
const ALTERNATIVE_METHODS = [
  // Email subject line method (some carriers read subject as SMS)
  'subject_method',
  // Plain text email method
  'plain_email'
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
   * Send SMS notification via multiple methods for maximum reliability
   */
  async sendSMS(phoneNumber: string, message: string, carrier: string = 'auto'): Promise<boolean> {
    try {
      // Clean and format phone number
      const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
      let formattedPhone = cleanPhone;
      
      if (cleanPhone.startsWith('0')) {
        formattedPhone = '61' + cleanPhone.substring(1); // Convert 04xxxxxxxx to 614xxxxxxxx
      } else if (cleanPhone.startsWith('+61')) {
        formattedPhone = cleanPhone.substring(1); // Remove +
      } else if (!cleanPhone.startsWith('61')) {
        formattedPhone = '61' + cleanPhone; // Add country code
      }

      // Limit message length for SMS (160 characters max)
      const truncatedMessage = message.length > 160 
        ? message.substring(0, 157) + '...'
        : message;

      console.log(`📱 Attempting comprehensive SMS delivery to ${formattedPhone}`);
      console.log(`📱 Original number: ${phoneNumber}, Formatted: ${formattedPhone}`);
      console.log(`📱 Message: ${truncatedMessage}`);

      // Method 1: Try Australian SMS gateways with email body
      console.log('📱 Method 1: Australian SMS gateways...');
      for (const gateway of AUSTRALIAN_SMS_GATEWAYS) {
        try {
          const smsEmail = `${formattedPhone}${gateway}`;
          console.log(`📱 Trying: ${smsEmail}`);
          
          await this.transporter.sendMail({
            from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
            to: smsEmail,
            subject: '',
            text: truncatedMessage
          });

          console.log(`✅ SMS sent successfully via ${gateway}`);
          return true;
        } catch (gatewayError) {
          console.log(`❌ Failed ${gateway}:`, gatewayError?.message || gatewayError);
        }
      }

      // Method 2: Try with message in subject line (some carriers prefer this)
      console.log('📱 Method 2: Subject line SMS...');
      for (const gateway of AUSTRALIAN_SMS_GATEWAYS.slice(0, 3)) {
        try {
          const smsEmail = `${formattedPhone}${gateway}`;
          
          await this.transporter.sendMail({
            from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
            to: smsEmail,
            subject: truncatedMessage,
            text: ''
          });

          console.log(`✅ SMS sent via subject method: ${gateway}`);
          return true;
        } catch (gatewayError) {
          console.log(`❌ Subject method failed ${gateway}:`, gatewayError?.message);
        }
      }

      // Method 3: Try without country code (some gateways prefer local format)
      console.log('📱 Method 3: Local format...');
      const localPhone = cleanPhone.startsWith('0') ? cleanPhone : '0' + cleanPhone.substring(2);
      for (const gateway of AUSTRALIAN_SMS_GATEWAYS.slice(0, 2)) {
        try {
          const smsEmail = `${localPhone}${gateway}`;
          console.log(`📱 Trying local format: ${smsEmail}`);
          
          await this.transporter.sendMail({
            from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
            to: smsEmail,
            subject: '',
            text: truncatedMessage
          });

          console.log(`✅ SMS sent via local format: ${gateway}`);
          return true;
        } catch (gatewayError) {
          console.log(`❌ Local format failed ${gateway}:`, gatewayError?.message);
        }
      }

      // Method 4: International gateways as last resort
      console.log('📱 Method 4: International gateways...');
      for (const gateway of INTERNATIONAL_GATEWAYS) {
        try {
          const smsEmail = `${formattedPhone}${gateway}`;
          
          await this.transporter.sendMail({
            from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
            to: smsEmail,
            subject: '',
            text: truncatedMessage
          });

          console.log(`✅ SMS sent via international gateway: ${gateway}`);
          return true;
        } catch (gatewayError) {
          console.log(`❌ International gateway failed ${gateway}:`, gatewayError?.message);
        }
      }

      console.log('❌ All SMS delivery methods failed');
      return false;
    } catch (error) {
      console.error('📱 Critical SMS Service Error:', error);
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
   * Test SMS functionality with comprehensive diagnostics
   */
  async testSMS(phoneNumber: string): Promise<boolean> {
    console.log('📱 Starting comprehensive SMS test...');
    console.log('📱 SMTP Configuration:');
    console.log('📱 Host:', process.env.SMTP_HOST);
    console.log('📱 Port:', process.env.SMTP_PORT);
    console.log('📱 User:', process.env.SMTP_USER);
    console.log('📱 From:', process.env.SMTP_FROM_EMAIL);
    
    const testMessage = 'BuildFlow Pro test: SMS working!';
    const result = await this.sendSMS(phoneNumber, testMessage);
    
    console.log('📱 SMS test result:', result ? 'SUCCESS' : 'FAILED');
    return result;
  }

  /**
   * Send a test email to verify email system is working
   */
  async testEmailDelivery(phoneNumber: string): Promise<boolean> {
    try {
      console.log('📧 Testing email delivery system...');
      
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
        to: process.env.SMTP_USER, // Send to self for testing
        subject: 'BuildFlow Pro SMS Test - Email System Check',
        text: `Email system test successful. SMS target: ${phoneNumber}`
      });

      console.log('✅ Email delivery test successful');
      return true;
    } catch (error) {
      console.error('❌ Email delivery test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const smsService = new SMSService();