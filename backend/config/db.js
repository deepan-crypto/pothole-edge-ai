const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let mongoURI = process.env.MONGODB_URI;

    if (mongoURI) {
      // Step 1: Fix appName issue (Render specific) - removes empty ?appName or ?appName=
      if (mongoURI.endsWith('?appName')) {
        mongoURI = mongoURI.slice(0, -8);
        console.log('Fixing MongoDB URI: Removing empty appName parameter');
      } else if (mongoURI.endsWith('?appName=')) {
        mongoURI = mongoURI.slice(0, -9);
        console.log('Fixing MongoDB URI: Removing empty appName parameter');
      }

      // Step 2: Fix unencoded @ in password
      // If the password contains an unencoded @, it confuses the MongoDB driver parser
      if (mongoURI.includes('@')) {
        const parts = mongoURI.split('@');

        // A standard URI should strictly have 2 parts when split by @: [scheme://user:password] and [host/database?options]
        // If we have > 2 parts, it means there are @ symbols in the user/password section
        if (parts.length > 2 && mongoURI.startsWith('mongodb')) {
          const hostPart = parts.pop(); // The last part is definitely the host section
          const schemeAndUserPart = parts.join('%40'); // Join the rest with encoded @ (%40)

          // Reconstruct the URI
          mongoURI = `${schemeAndUserPart}@${hostPart}`;
          console.log('Fixing MongoDB URI: Encoding special characters in credentials');
        }
      }
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
