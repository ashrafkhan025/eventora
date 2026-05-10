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

const getEmailConfig = () => {
    const user = requiredEnv('EMAIL_USER');
    const pass = requiredEnv('EMAIL_PASS').replace(/\s/g, '');

    if (process.env.SMTP_HOST) {
        return {
            host: process.env.SMTP_HOST.trim(),
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user, pass }
        };
    }

    // Gmail requires a 16-character app password when 2FA is enabled.
    return {
        service: 'gmail',
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

const sendBookingEmail = async (userEmail, userName, eventTitle) => {
    try {
        const emailUser = requiredEnv('EMAIL_USER');
        const mailOptions = {
            from: `"Eventora" <${emailUser}>`,
            to: userEmail,
            subject: `Booking Confirmed: ${eventTitle}`,
            html: `
        <h2>Hi ${userName}!</h2>
        <p>Your booking for the event <strong>${eventTitle}</strong> is successfully confirmed.</p>
        <p>Thank you for choosing Eventora.</p>
      `
        };
        await getTransporter().sendMail(mailOptions);
        console.log('Email sent successfully to', userEmail);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

const sendOTPEmail = async (userEmail, otp, type) => {
    try {
        const emailUser = requiredEnv('EMAIL_USER');

        const title = type === 'account_verification' ? 'Verify your Eventora Account' : 'Eventora Booking Verification';
        const msg = type === 'account_verification'
            ? 'Please use the following OTP to verify your new Eventora account.'
            : 'Please use the following OTP to verify and confirm your event booking.';

        const mailOptions = {
            from: `"Eventora" <${emailUser}>`,
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
        await getTransporter().sendMail(mailOptions);
        console.log(`OTP sent to ${userEmail} for ${type}`);
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw error;
    }
};

module.exports = { sendBookingEmail, sendOTPEmail };
