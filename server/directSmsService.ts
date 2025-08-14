/**
 * Direct SMS Service using reliable SMS APIs
 * This provides better delivery rates than email-to-SMS gateways
 */

interface SMSProvider {
  name: string;
  sendSMS: (phone: string, message: string) => Promise<boolean>;
}

class TwilioSMSProvider implements SMSProvider {
  name = 'Twilio';
  
  async sendSMS(phone: string, message: string): Promise<boolean> {
    try {
      // Twilio SMS implementation (requires API key)
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromPhone = process.env.TWILIO_PHONE_NUMBER;
      
      if (!accountSid || !authToken || !fromPhone) {
        console.log('❌ Twilio credentials not configured');
        return false;
      }
      
      // Format phone number for international SMS
      const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
      
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: fromPhone,
          To: formattedPhone,
          Body: message
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Twilio SMS sent:', result.sid);
        return true;
      } else {
        console.log('❌ Twilio SMS failed:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('❌ Twilio SMS error:', error);
      return false;
    }
  }
}

class MessageBirdSMSProvider implements SMSProvider {
  name = 'MessageBird';
  
  async sendSMS(phone: string, message: string): Promise<boolean> {
    try {
      const apiKey = process.env.MESSAGEBIRD_API_KEY;
      
      if (!apiKey) {
        console.log('❌ MessageBird API key not configured - add MESSAGEBIRD_API_KEY to environment');
        return false;
      }
      
      // Format phone number for MessageBird
      let formattedPhone = phone.replace(/[\s\-\(\)]/g, '');
      if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.substring(1);
      }
      
      console.log(`📱 MessageBird: Sending SMS to ${formattedPhone}`);
      
      const response = await fetch('https://rest.messagebird.com/messages', {
        method: 'POST',
        headers: {
          'Authorization': `AccessKey ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: [formattedPhone],
          originator: 'BuildFlow',
          body: message
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ MessageBird SMS sent successfully:', result.id);
        return true;
      } else {
        const errorText = await response.text();
        console.log('❌ MessageBird SMS failed:', response.status, errorText);
        return false;
      }
    } catch (error) {
      console.error('❌ MessageBird SMS error:', error);
      return false;
    }
  }
}

class ClickSendSMSProvider implements SMSProvider {
  name = 'ClickSend';
  
  async sendSMS(phone: string, message: string): Promise<boolean> {
    try {
      const username = process.env.CLICKSEND_USERNAME;
      const apiKey = process.env.CLICKSEND_API_KEY;
      
      if (!username || !apiKey) {
        console.log('❌ ClickSend credentials not configured');
        return false;
      }
      
      // Format phone number
      const formattedPhone = phone.startsWith('+') ? phone.substring(1) : phone;
      
      const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${username}:${apiKey}`).toString('base64'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{
            to: formattedPhone,
            body: message,
            from: 'BuildFlow'
          }]
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ ClickSend SMS sent:', result.data.messages[0]?.message_id);
        return true;
      } else {
        console.log('❌ ClickSend SMS failed:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('❌ ClickSend SMS error:', error);
      return false;
    }
  }
}

export class DirectSMSService {
  private providers: SMSProvider[] = [
    new TwilioSMSProvider(),
    new MessageBirdSMSProvider(),
    new ClickSendSMSProvider()
  ];

  /**
   * Send SMS using the first available provider
   */
  async sendSMS(phoneNumber: string, message: string): Promise<{success: boolean, provider?: string, error?: string}> {
    // Clean and format phone number for Australian mobile
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
    let formattedPhone = cleanPhone;
    
    // Convert Australian format to international
    if (cleanPhone.startsWith('0')) {
      formattedPhone = '+61' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('61')) {
      formattedPhone = '+' + cleanPhone;
    } else if (!cleanPhone.startsWith('+61')) {
      formattedPhone = '+61' + cleanPhone;
    }

    console.log(`📱 Direct SMS attempt to ${formattedPhone}: ${message}`);

    for (const provider of this.providers) {
      try {
        console.log(`📱 Trying ${provider.name}...`);
        const success = await provider.sendSMS(formattedPhone, message);
        
        if (success) {
          console.log(`✅ SMS delivered via ${provider.name}`);
          return { success: true, provider: provider.name };
        }
      } catch (error) {
        console.log(`❌ ${provider.name} failed:`, error);
      }
    }

    return { 
      success: false, 
      error: 'All SMS providers failed or not configured' 
    };
  }

  /**
   * Test SMS with comprehensive provider diagnostics
   */
  async testSMS(phoneNumber: string): Promise<{success: boolean, details: any}> {
    console.log('📱 Starting Direct SMS test...');
    
    // Check which providers are configured
    const providerStatus = await this.checkProviderConfiguration();
    console.log('📱 Provider configuration:', providerStatus);
    
    const testMessage = 'BuildFlow Pro Direct SMS test - working!';
    const result = await this.sendSMS(phoneNumber, testMessage);
    
    return {
      success: result.success,
      details: {
        providerUsed: result.provider,
        error: result.error,
        configuredProviders: providerStatus,
        phoneFormat: phoneNumber
      }
    };
  }

  /**
   * Check which SMS providers are properly configured
   */
  private async checkProviderConfiguration(): Promise<Record<string, boolean>> {
    return {
      twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
      messageBird: !!process.env.MESSAGEBIRD_API_KEY,
      clickSend: !!(process.env.CLICKSEND_USERNAME && process.env.CLICKSEND_API_KEY)
    };
  }
}

export const directSmsService = new DirectSMSService();