require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('./models/User');
const PaymentRequest = require('./models/PaymentRequest');
const { register } = require('./controllers/authController');
const {
  createPaymentRequest,
  getUserPaymentRequest,
  getAdminPaymentRequests,
  approvePaymentRequest,
  rejectPaymentRequest
} = require('./controllers/paymentController');

async function runTests() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mobile-crm');
  
  console.log('Cleaning up existing test data...');
  const testPhone = '919998887770';
  await User.deleteMany({ phone: testPhone });
  await PaymentRequest.deleteMany({ utrNumber: { $in: ['testutr12345', 'testutr12345dup', 'shortutr', 'testutr_approved'] } });

  // Helper mocks for Express Request/Response
  const mockRes = () => {
    const res = { statusCode: 200 };
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.body = data;
      return res;
    };
    return res;
  };

  const username = `paytest_${Date.now()}`;
  const email = `${username}@test.com`;

  // 1. Create a test user
  console.log('\n--- 1. Creating test user ---');
  const reqReg = {
    body: {
      username,
      email,
      phone: testPhone,
      password: 'Password@123',
      name: 'Payment Test User'
    }
  };
  const resReg = mockRes();
  await register(reqReg, resReg);
  if (resReg.statusCode !== 201) {
    console.error('❌ Failed to register test user:', resReg.body);
    process.exit(1);
  }
  console.log('✅ Test user registered successfully!');

  const user = await User.findOne({ email });

  // 2. Test: UTR number min-length validation
  console.log('\n--- 2. Testing UTR min-length validation (< 10 chars) ---');
  const reqShortUTR = {
    user,
    body: {
      planSelected: 'growth',
      originalPrice: 499,
      finalPrice: 499,
      utrNumber: 'shortutr'
    },
    screenshotUrl: 'https://cloudinary.com/test-screenshot.jpg'
  };
  const resShortUTR = mockRes();
  await createPaymentRequest(reqShortUTR, resShortUTR);
  if (resShortUTR.statusCode === 400 && resShortUTR.body.message.includes('at least 10 characters')) {
    console.log('✅ UTR min-length validation successfully blocked request!');
  } else {
    console.error('❌ UTR min-length validation failed to block request. Status:', resShortUTR.statusCode, resShortUTR.body);
    process.exit(1);
  }

  // 3. Test: Successful Payment Request Submission
  console.log('\n--- 3. Submitting valid payment request ---');
  const reqValid = {
    user,
    body: {
      planSelected: 'growth',
      originalPrice: 499,
      finalPrice: 499,
      utrNumber: 'testutr12345'
    },
    screenshotUrl: 'https://cloudinary.com/test-screenshot.jpg'
  };
  const resValid = mockRes();
  await createPaymentRequest(reqValid, resValid);
  if (resValid.statusCode === 201) {
    console.log('✅ Payment request submitted successfully!');
  } else {
    console.error('❌ Failed to submit valid payment request. Status:', resValid.statusCode, resValid.body);
    process.exit(1);
  }

  // 4. Test: Limit 1 pending payment request per user
  console.log('\n--- 4. Testing limit of 1 pending request per user ---');
  const reqPendingDup = {
    user,
    body: {
      planSelected: 'starter',
      originalPrice: 199,
      finalPrice: 199,
      utrNumber: 'testutr12345dup'
    },
    screenshotUrl: 'https://cloudinary.com/test-screenshot2.jpg'
  };
  const resPendingDup = mockRes();
  await createPaymentRequest(reqPendingDup, resPendingDup);
  if (resPendingDup.statusCode === 400 && resPendingDup.body.message.includes('pending payment request')) {
    console.log('✅ Successfully blocked second pending request for user!');
  } else {
    console.error('❌ Failed to block second pending request. Status:', resPendingDup.statusCode, resPendingDup.body);
    process.exit(1);
  }

  // Fetch the created payment request
  const paymentRequest = await PaymentRequest.findOne({ utrNumber: 'testutr12345' });

  // 5. Test: Prevent duplicate UTR submissions
  console.log('\n--- 5. Testing duplicate UTR submission prevention ---');
  // Register another user to test UTR overlap across users
  const secondUsername = `paytest2_${Date.now()}`;
  const secondEmail = `${secondUsername}@test.com`;
  const reqReg2 = {
    body: {
      username: secondUsername,
      email: secondEmail,
      phone: '919998887771',
      password: 'Password@123',
      name: 'Payment Test User 2'
    }
  };
  const resReg2 = mockRes();
  await register(reqReg2, resReg2);
  const user2 = await User.findOne({ email: secondEmail });

  const reqUtrDup = {
    user: user2,
    body: {
      planSelected: 'growth',
      originalPrice: 499,
      finalPrice: 499,
      utrNumber: 'testutr12345' // same UTR
    },
    screenshotUrl: 'https://cloudinary.com/test-screenshot.jpg'
  };
  const resUtrDup = mockRes();
  await createPaymentRequest(reqUtrDup, resUtrDup);
  if (resUtrDup.statusCode === 400 && resUtrDup.body.message.includes('already been submitted')) {
    console.log('✅ Successfully blocked duplicate UTR request across different users!');
  } else {
    console.error('❌ Failed to block duplicate UTR. Status:', resUtrDup.statusCode, resUtrDup.body);
    process.exit(1);
  }

  // Clean up user2
  await User.deleteOne({ _id: user2._id });

  // 6. Test: Get user latest request status
  console.log('\n--- 6. Testing GET user payment request status ---');
  const reqGetStatus = { user };
  const resGetStatus = mockRes();
  await getUserPaymentRequest(reqGetStatus, resGetStatus);
  if (resGetStatus.statusCode === 200 && resGetStatus.body.status === 'pending') {
    console.log('✅ User retrieved correct pending status!');
  } else {
    console.error('❌ Failed to retrieve correct user payment status:', resGetStatus.body);
    process.exit(1);
  }

  // 7. Test: Admin approve request
  console.log('\n--- 7. Testing Admin approval & plan activation ---');
  const reqApprove = {
    params: { id: paymentRequest._id }
  };
  const resApprove = mockRes();
  await approvePaymentRequest(reqApprove, resApprove);
  if (resApprove.statusCode === 200 && resApprove.body.paymentRequest.status === 'approved') {
    console.log('✅ Admin approval request processed successfully!');
  } else {
    console.error('❌ Admin approval request failed. Status:', resApprove.statusCode, resApprove.body);
    process.exit(1);
  }

  // Verify user subscription end date and active plan type
  const updatedUser = await User.findById(user._id);
  console.log(`Updated plan: "${updatedUser.plan}" (Expected: "growth")`);
  console.log(`Plan start date: ${updatedUser.planStartDate}`);
  console.log(`Plan end date: ${updatedUser.planEndDate}`);
  if (updatedUser.plan === 'growth' && updatedUser.planStartDate && updatedUser.planEndDate) {
    // Check if end date is roughly +30 days from start date
    const diffTime = Math.abs(updatedUser.planEndDate - updatedUser.planStartDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    console.log(`Subscription duration: ${diffDays} days (Expected: 30 days)`);
    if (diffDays === 30) {
      console.log('✅ User plan successfully activated for exactly 30 days!');
    } else {
      console.error('❌ Plan duration mismatch.');
      process.exit(1);
    }
  } else {
    console.error('❌ User plan activation details are missing or incorrect.');
    process.exit(1);
  }

  // Clean up test data
  console.log('\nCleaning up verification records...');
  await User.deleteOne({ _id: user._id });
  await PaymentRequest.deleteMany({ userId: user._id });
  console.log('✅ Verification clean-up completed!');

  console.log('\n🎉 ALL HYBRID MANUAL PAYMENT SYSTEM TEST CASES PASSED SUCCESSFULLY! 🎉\n');
  mongoose.connection.close();
}

runTests().catch(err => {
  console.error('❌ Unexpected error in test run:', err);
  process.exit(1);
});
