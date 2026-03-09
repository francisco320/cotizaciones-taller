const app = require('../src/app');
const { connectDB } = require('../src/config/database');

// Ensure database connection is established for the serverless function
// Mongoose handles connection buffering, so we can just call this.
connectDB();

module.exports = app;
