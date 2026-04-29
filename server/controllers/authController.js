const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTPEmail } = require('../utils/email');



//function to generate otp
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const logDevOTP = (email, otp) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`DEV OTP for ${email}: ${otp}`);
    }
};

//generate Token
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};



exports.registerUser = async (req, res) => {
    try {
        const { name, password } = req.body;
        const email = req.body.email?.trim().toLowerCase();
        let user = await User.findOne({ email });

        if (user) {
            if (user.isVerified) {
                return res.status(400).json({ message: 'User already exists' });
            }

            const otp = generateOTP();
            await OTP.findOneAndDelete({ email, action: 'account_verification' });
            await OTP.create({ email, otp, action: 'account_verification' });
            logDevOTP(email, otp);
            await sendOTPEmail(email, otp, 'account_verification');

            return res.status(200).json({
                message: 'A new OTP has been sent to your email. Please verify.',
                email: user.email
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'user', // Hardcoded to prevent frontend passing role
            isVerified: false
        });

        const otp = generateOTP();
        await OTP.create({ email, otp, action: 'account_verification' });
        logDevOTP(email, otp);
        await sendOTPEmail(email, otp, 'account_verification');

        res.status(201).json({
            message: 'OTP sent to email. Please verify.',
            email: user.email
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase();
        const { password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        if (!user.isVerified && user.role !== 'admin') {
            const otp = generateOTP();
            await OTP.findOneAndDelete({ email: user.email, action: 'account_verification' });
            await OTP.create({ email: user.email, otp, action: 'account_verification' });
            logDevOTP(user.email, otp);
            await sendOTPEmail(user.email, otp, 'account_verification');
            return res.status(403).json({ message: 'Account not verified', needsVerification: true, email: user.email });
        }

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id, user.role)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase();
        const { otp } = req.body;
        const validOTP = await OTP.findOne({ email, otp, action: 'account_verification' });

        if (!validOTP) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const user = await User.findOneAndUpdate({ email }, { isVerified: true }, { new: true });
        await OTP.deleteOne({ _id: validOTP._id }); // Delete OTP after usage

        res.json({
            message:'Account verified successfully. You can now log in.',
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id, user.role)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};
