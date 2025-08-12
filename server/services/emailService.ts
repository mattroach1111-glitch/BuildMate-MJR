import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// SMTP configuration for Onlydomains.com Titan email service
const createTransporter = (): Transporter | null => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP credentials not set - email functionality will be disabled");
    return null;
  }

  // Use provided SMTP settings
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const secure = process.env.SMTP_SECURE === 'true';

  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: secure, // true for 465 (SSL), false for 587 (TLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false // Allow self-signed certificates
    }
  });
};

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.error('SMTP not configured - cannot send email');
    return false;
  }

  try {
    // Test the connection first
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('SMTP connection verified successfully');

    const mailOptions = {
      from: params.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', params.to, 'Message ID:', result.messageId);
    return true;
  } catch (error) {
    console.error('SMTP email error:', error);
    console.error('SMTP Config being used:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE,
      user: process.env.SMTP_USER ? process.env.SMTP_USER.substring(0, 3) + '***' : 'not set'
    });
    return false;
  }
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}