const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');



dotenv.config();



const authRoutes = require('./routes/auth.js');
const eventRoutes = require('./routes/events.js');
const bookingRoutes = require('./routes/booking.js');

const app = express();
const clientDistPath = path.join(__dirname, '../client/dist');


// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);

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


// Database Connection
mongoose.connect(process.env.MONGO_URI )
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));


const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>{ console.log(`Server running on port ${PORT}`)
});

