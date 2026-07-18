const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Auto-seed Super Admin User if it doesn't exist
    const User = require('../models/User');
    const adminEmail = 'admin@crm.com';
    const adminExists = await User.findOne({ email: adminEmail });
    if (!adminExists) {
      console.log('Seeding Super Admin user...');
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
      await User.create({
        name: 'Super Admin',
        email: adminEmail,
        password: adminPassword,
        username: 'ADMIN77',
        isAdmin: true,
        plan: 'pro',
      });
      console.log('Super Admin user seeded successfully!');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
