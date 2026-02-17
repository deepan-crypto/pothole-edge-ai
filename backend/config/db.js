const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let mongoURI = process.env.MONGODB_URI;

    // Fix for Render deployment issue where appName is present but empty (e.g., ".../?appName")
    if (mongoURI && mongoURI.endsWith('?appName')) {
      console.log('Fixing MongoDB URI: Removing empty appName parameter');
      mongoURI = mongoURI.slice(0, -8);
    }

    // Also handle case where it might be empty with an equals sign
    if (mongoURI && mongoURI.endsWith('?appName=')) {
      console.log('Fixing MongoDB URI: Removing empty appName parameter');
      mongoURI = mongoURI.slice(0, -9);
    }

    const conn = await mongoose.connect(mongoURI, {
      // These options are no longer needed in Mongoose 6+, but kept for compatibility
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
