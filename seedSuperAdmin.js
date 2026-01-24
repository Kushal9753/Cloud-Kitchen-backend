const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const SUPER_ADMIN = {
    name: 'Kushal Sahu',
    email: 'kushalsahu352@gmail.com',
    password: '909896',
    role: 'superadmin',
    isSuperAdmin: true
};

const seedSuperAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/food-delivery-app');
        console.log('MongoDB Connected for seeding');

        // Check if Super Admin already exists
        const existingSuperAdmin = await User.findOne({
            $or: [
                { email: SUPER_ADMIN.email },
                { isSuperAdmin: true },
                { role: 'superadmin' }
            ]
        });

        if (existingSuperAdmin) {
            console.log('Super Admin already exists:', existingSuperAdmin.email);

            // Update existing user to ensure they have correct super admin flags
            // Update existing user to ensure they have correct super admin flags and password
            existingSuperAdmin.isSuperAdmin = true;
            existingSuperAdmin.role = 'superadmin';
            existingSuperAdmin.password = SUPER_ADMIN.password; // Reset password to ensure access
            await existingSuperAdmin.save();
            console.log('Updated existing user to Super Admin status and reset password');
        } else {
            // Create Super Admin
            const superAdmin = await User.create(SUPER_ADMIN);
            console.log('Super Admin created successfully:');
            console.log('Email:', superAdmin.email);
            console.log('Name:', superAdmin.name);
            console.log('Role:', superAdmin.role);
            console.log('isSuperAdmin:', superAdmin.isSuperAdmin);
        }

        console.log('\n✅ Super Admin seed completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding Super Admin:', error);
        process.exit(1);
    }
};

// Run the seed function
seedSuperAdmin();
