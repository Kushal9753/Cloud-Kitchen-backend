const mongoose = require('mongoose');
const dotenv = require('dotenv');
const readline = require('readline');

dotenv.config();

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/food-delivery-app');
        console.log('✅ MongoDB Connected\n');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Define Food model (minimal version)
const foodSchema = new mongoose.Schema({
    name: String,
    image: String,
    description: String,
    price: Number,
    category: String,
    type: String
});

const Food = mongoose.model('Food', foodSchema);

// Main migration function
const migrateLocalUrlsToCloudinary = async () => {
    try {
        console.log('🔍 Searching for food items with local /uploads URLs...\n');

        // Find all food items with local URLs
        const localUrlPatterns = [
            /\/uploads\//,
            /cloud-kitchen-backend.*\/uploads\//,
            /localhost.*\/uploads\//,
            /127\.0\.0\.1.*\/uploads\//
        ];

        const allFoods = await Food.find({});
        const foodsWithLocalUrls = allFoods.filter(food => {
            if (!food.image) return false;
            return localUrlPatterns.some(pattern => pattern.test(food.image));
        });

        console.log(`📊 Total food items: ${allFoods.length}`);
        console.log(`🔗 Items with local /uploads URLs: ${foodsWithLocalUrls.length}\n`);

        if (foodsWithLocalUrls.length === 0) {
            console.log('✅ No migration needed! All items already use Cloudinary or have no local URLs.');
            return;
        }

        console.log('📋 Items with local /uploads URLs:\n');
        console.log('─'.repeat(70));
        foodsWithLocalUrls.forEach((food, index) => {
            console.log(`${index + 1}. ${food.name || 'Unnamed'} (ID: ${food._id})`);
            console.log(`   Category: ${food.category || 'N/A'} | Price: ₹${food.price || 'N/A'}`);
            console.log(`   Current URL: ${food.image}`);
            console.log('─'.repeat(70));
        });

        console.log('\n⚠️  MIGRATION OPTIONS:\n');
        console.log('1. Clear image URLs (set to empty string) - Admins will re-upload');
        console.log('2. Delete these food items entirely');
        console.log('3. Cancel migration (just view the list)\n');

        const choice = await question('Enter your choice (1/2/3): ');

        if (choice === '1') {
            // Clear image URLs
            const confirm = await question('\n⚠️  This will clear image URLs. Type "YES" to confirm: ');

            if (confirm === 'YES') {
                console.log('\n🔄 Clearing local URLs...\n');

                for (const food of foodsWithLocalUrls) {
                    food.image = '';
                    await food.save();
                    console.log(`✅ Cleared URL for: ${food.name || 'Unnamed'}`);
                }

                console.log('\n✅ Migration complete!');
                console.log('📝 Admins should now re-upload images via the admin dashboard.');
                console.log('   New uploads will automatically use Cloudinary.\n');
            } else {
                console.log('\n❌ Migration cancelled.\n');
            }
        } else if (choice === '2') {
            // Delete items
            const confirm = await question('\n⚠️  This will DELETE these items permanently. Type "DELETE" to confirm: ');

            if (confirm === 'DELETE') {
                console.log('\n🗑️  Deleting items...\n');

                for (const food of foodsWithLocalUrls) {
                    await Food.findByIdAndDelete(food._id);
                    console.log(`🗑️  Deleted: ${food.name || 'Unnamed'}`);
                }

                console.log('\n✅ Items deleted successfully!\n');
            } else {
                console.log('\n❌ Deletion cancelled.\n');
            }
        } else {
            console.log('\n❌ Migration cancelled. No changes made.\n');
        }

    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        rl.close();
        await mongoose.connection.close();
        console.log('🔌 Database connection closed\n');
        process.exit(0);
    }
};

// Run migration
console.log('═'.repeat(70));
console.log('  CLOUDINARY MIGRATION TOOL - Clean Local /uploads URLs');
console.log('═'.repeat(70) + '\n');

connectDB().then(() => {
    migrateLocalUrlsToCloudinary();
});

