const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');



dotenv.config({ path: path.join(__dirname, '.env') });



const authRoutes = require('./routes/auth.js');
const eventRoutes = require('./routes/events.js');
const bookingRoutes = require('./routes/booking.js');
const { getEmailDiagnostics, sendDiagnosticEmail, verifyEmailTransport } = require('./utils/email.js');

const app = express();
const clientDistPath = path.join(__dirname, '../client/dist');

const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);
if (missingEnvVars.length) {
    console.warn(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}


// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);

app.get('/api/health/email', async (req, res) => {
    const diagnostics = getEmailDiagnostics();

    try {
        const verification = await verifyEmailTransport();
        res.json({ ...diagnostics, ...verification });
    } catch (error) {
        res.status(500).json({
            ...diagnostics,
            ok: false,
            error: error.code || error.name || 'EMAIL_CONFIG_ERROR',
            message: error.message
        });
    }
});

app.post('/api/health/email/test', async (req, res) => {
    if (!process.env.HEALTH_CHECK_SECRET) {
        return res.status(403).json({
            message: 'Email test endpoint is disabled. Set HEALTH_CHECK_SECRET in deployment env vars to enable it.'
        });
    }

    if (req.headers['x-health-secret'] !== process.env.HEALTH_CHECK_SECRET) {
        return res.status(401).json({ message: 'Invalid health check secret' });
    }

    const email = req.body.email?.trim().toLowerCase();
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        await sendDiagnosticEmail(email);
        res.json({ message: 'Diagnostic email sent', email });
    } catch (error) {
        res.status(500).json({
            ...getEmailDiagnostics(),
            message: error.message,
            error: error.code || error.name || 'EMAIL_SEND_FAILED'
        });
    }
});

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(clientDistPath));

    app.get(/^\/(?!api).*/, (req, res) => {
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
} else {
    // Root route (health check)
    app.get('/', (req, res) => {
        res.json("API IS WORKING, This is created by Ashraf khan" );
    });
}


const PORT = process.env.PORT || 5000;
// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB Connected');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  });

