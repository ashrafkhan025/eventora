const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

let transporter;

const requiredEnv = (name) => {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required email environment variable: ${name}`);
    }
    return value;
};

const cleanOptionalEnv = (name) => process.env[name]?.trim();

const getEmailConfig = () => {
    const user = requiredEnv('EMAIL_USER');
    const pass = requiredEnv('EMAIL_PASS').replace(/\s/g, '');

    return {
        host: cleanOptionalEnv('SMTP_HOST') || 'smtp.gmail.com',
        port: Number(cleanOptionalEnv('SMTP_PORT') || 465),
        secure: cleanOptionalEnv('SMTP_SECURE') !== 'false',
        auth: { user, pass }
    };
};

// Create the transporter lazily so deployed env vars are read at send time.
const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport(getEmailConfig());
    }
    return transporter;
};

const getFromAddress = () => {
    return cleanOptionalEnv('EMAIL_FROM') || `"Eventora" <${requiredEnv('EMAIL_USER')}>`;
};

const sendWithResend = async (mailOptions) => {
    const apiKey = cleanOptionalEnv('RESEND_API_KEY');
    if (!apiKey) return false;

    if (typeof fetch !== 'function') {
        throw new Error('RESEND_API_KEY is set, but this Node.js version does not support fetch. Use Node 18+.');
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: cleanOptionalEnv('RESEND_FROM_EMAIL') || mailOptions.from,
            to: [mailOptions.to],
            subject: mailOptions.subject,
            html: mailOptions.html
        })
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend email failed with status ${response.status}: ${body}`);
    }

    return true;
};

const sendMail = async (mailOptions) => {
    const sentWithResend = await sendWithResend(mailOptions);
    if (sentWithResend) return;
    await getTransporter().sendMail(mailOptions);
};

const getEmailDiagnostics = () => ({
    provider: cleanOptionalEnv('RESEND_API_KEY') ? 'resend' : 'smtp',
    hasEmailUser: Boolean(cleanOptionalEnv('EMAIL_USER')),
    hasEmailPass: Boolean(cleanOptionalEnv('EMAIL_PASS')),
    hasEmailFrom: Boolean(cleanOptionalEnv('EMAIL_FROM') || cleanOptionalEnv('RESEND_FROM_EMAIL')),
    smtpHost: cleanOptionalEnv('SMTP_HOST') || 'smtp.gmail.com',
    smtpPort: Number(cleanOptionalEnv('SMTP_PORT') || 465),
    smtpSecure: cleanOptionalEnv('SMTP_SECURE') !== 'false',
    nodeEnv: process.env.NODE_ENV || 'development'
});

const verifyEmailTransport = async () => {
    if (cleanOptionalEnv('RESEND_API_KEY')) {
        return { ok: true, provider: 'resend', message: 'Resend API key is configured' };
    }

    await getTransporter().verify();
    return { ok: true, provider: 'smtp', message: 'SMTP connection verified' };
};

const sendBookingEmail = async (userEmail, userName, eventTitle) => {
    try {
        const mailOptions = {
            from: getFromAddress(),
            to: userEmail,
            subject: `Booking Confirmed: ${eventTitle}`,
            html: `
        <h2>Hi ${userName}!</h2>
        <p>Your booking for the event <strong>${eventTitle}</strong> is successfully confirmed.</p>
        <p>Thank you for choosing Eventora.</p>
      `
        };
        await sendMail(mailOptions);
        console.log('Email sent successfully to', userEmail);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

const sendOTPEmail = async (userEmail, otp, type) => {
    try {
        const title = type === 'account_verification' ? 'Verify your Eventora Account' : 'Eventora Booking Verification';
        const msg = type === 'account_verification'
            ? 'Please use the following OTP to verify your new Eventora account.'
            : 'Please use the following OTP to verify and confirm your event booking.';

        const mailOptions = {
            from: getFromAddress(),
            to: userEmail,
            subject: title,
            html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2 style="color: #111;">${title}</h2>
                    <p style="color: #555; font-size: 16px;">${msg}</p>
                    <div style="margin: 20px auto; padding: 15px; font-size: 24px; font-weight: bold; background: #f4f4f4; width: max-content; letter-spacing: 5px;">
                        ${otp}
                    </div>
                    <p style="color: #999; font-size: 12px;">This code expires in 5 minutes. If you didn't request this, please ignore this email.</p>
                </div>
            `
        };
        await sendMail(mailOptions);
        console.log(`OTP sent to ${userEmail} for ${type}`);
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw error;
    }
};

module.exports = { sendBookingEmail, sendOTPEmail, getEmailDiagnostics, verifyEmailTransport };
