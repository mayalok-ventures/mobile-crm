require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('./models/User');
const Lead = require('./models/Lead');
const Coupon = require('./models/Coupon');
const { trackMessage, createLead, updateLead } = require('./controllers/leadsController');
const { sendText, sendMedia } = require('./controllers/whatsappController');
const { register, login, applyCoupon, updateProfile } = require('./controllers/authController');
const { assignPlan } = require('./controllers/adminController');

async function runTests() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mobile-crm');
  console.log('Cleaning up existing test data...');
  await User.deleteMany({ phone: '911234567890' });
  await Coupon.deleteMany({ code: /^SAVE30_/ });

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

  const username = `testuser_${Date.now()}`;
  const email = `${username}@test.com`;

  // ----------------------------------------------------
  // TEST 1 & 2: User phone normalization on register & login
  // ----------------------------------------------------
  console.log('--- Test 1 & 2: User registration & login phone normalization ---');
  
  const reqReg = {
    body: {
      username,
      email,
      phone: '+91 (123) 456-7890',
      password: 'Password@123',
      name: 'Test User'
    }
  };
  
  const resReg = mockRes();
  await register(reqReg, resReg);
  
  if (resReg.statusCode === 201) {
    console.log('✅ Registration successful!');
  } else {
    console.error('❌ Registration failed:', resReg.body);
    process.exit(1);
  }

  const createdUser = await User.findOne({ email });
  console.log(`Saved phone: "${createdUser.phone}" (Expected: "911234567890")`);
  if (createdUser.phone === '911234567890') {
    console.log('✅ User phone number normalized correctly on registration!');
  } else {
    console.error('❌ User phone number normalization failed.');
    process.exit(1);
  }

  // Login using unnormalized phone
  const reqLogin = {
    body: {
      identifier: ' +91 (123) 456-7890 ',
      password: 'Password@123'
    }
  };
  const resLogin = mockRes();
  await login(reqLogin, resLogin);
  if (resLogin.statusCode === 200) {
    console.log('✅ Login successful using unnormalized phone!');
  } else {
    console.error('❌ Login failed with unnormalized phone:', resLogin.body);
    process.exit(1);
  }

  // ----------------------------------------------------
  // TEST 3 & 4: Lead phone normalization & duplicates
  // ----------------------------------------------------
  console.log('\n--- Test 3 & 4: Lead phone normalization & duplicate prevention ---');
  
  const reqLead1 = {
    user: createdUser,
    body: {
      name: 'Lead One',
      phone: '+91 (987) 654-3210',
      followUpDate: new Date(),
    }
  };
  const resLead1 = mockRes();
  await createLead(reqLead1, resLead1);
  if (resLead1.statusCode === 201) {
    console.log('✅ Lead 1 created successfully!');
  } else {
    console.error('❌ Lead 1 creation failed:', resLead1.body);
    process.exit(1);
  }

  const savedLead1 = await Lead.findOne({ userId: createdUser._id, phone: '919876543210' });
  if (savedLead1) {
    console.log('✅ Lead phone number normalized to digits-only: 919876543210');
  } else {
    console.error('❌ Lead phone number not normalized in DB');
    process.exit(1);
  }

  // Try duplicate lead creation
  const reqLead2 = {
    user: createdUser,
    body: {
      name: 'Lead Two (Duplicate Phone)',
      phone: '91-987-654-3210', // slightly different format but same normalized digits
      followUpDate: new Date()
    }
  };
  const resLead2 = mockRes();
  await createLead(reqLead2, resLead2);
  if (resLead2.statusCode === 400 && resLead2.body.message.includes('already exists')) {
    console.log('✅ Duplicate lead creation prevented successfully!');
  } else {
    console.error('❌ Duplicate lead creation not prevented:', resLead2.statusCode, resLead2.body);
    process.exit(1);
  }

  // ----------------------------------------------------
  // TEST 5: Free plan lead limits
  // ----------------------------------------------------
  console.log('\n--- Test 5: Free plan lead limits (max 10) ---');
  console.log(`Current user plan: ${createdUser.plan}`);
  
  // Create 9 more leads to hit the limit of 10
  let limitReached = false;
  for (let i = 2; i <= 12; i++) {
    const reqLoop = {
      user: createdUser,
      body: {
        name: `Lead ${i}`,
        phone: `9100000000${i}`,
        followUpDate: new Date()
      }
    };
    const resLoop = mockRes();
    await createLead(reqLoop, resLoop);
    if (resLoop.statusCode === 403 && resLoop.body.code === 'LIMIT_REACHED') {
      console.log(`✅ Lead creation blocked at lead count: ${i - 1} (Limit: 10). Code: ${resLoop.body.code}`);
      limitReached = true;
      break;
    }
  }

  if (limitReached) {
    console.log('✅ Free plan lead limits verified successfully!');
  } else {
    console.error('❌ Lead limits not enforced. User was able to exceed 10 leads.');
    process.exit(1);
  }

  // ----------------------------------------------------
  // TEST 6: Coupon application, discounts & billing
  // ----------------------------------------------------
  console.log('\n--- Test 6: Coupon discount calculation & billing metadata save ---');
  
  // Create coupon code
  const couponCode = `SAVE30_${Date.now()}`;
  await Coupon.create({
    code: couponCode,
    plan: 'starter',
    discountPercent: 30,
    maxUses: 5,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isActive: true
  });

  const reqCoupon = {
    user: createdUser,
    body: { code: couponCode }
  };
  const resCoupon = mockRes();
  await applyCoupon(reqCoupon, resCoupon);
  if (resCoupon.statusCode === 200) {
    console.log('✅ Coupon applied successfully!');
  } else {
    console.error('❌ Coupon application failed:', resCoupon.body);
    process.exit(1);
  }

  const updatedUserCoupon = await User.findById(createdUser._id);
  console.log(`New Plan: "${updatedUserCoupon.plan}" (Expected: "starter")`);
  console.log(`Billing:`, updatedUserCoupon.billing);
  if (
    updatedUserCoupon.plan === 'starter' &&
    updatedUserCoupon.billing.originalPrice === 199 &&
    updatedUserCoupon.billing.discountedPrice === 139 &&
    updatedUserCoupon.billing.couponCodeUsed === couponCode
  ) {
    console.log('✅ Coupon pricing discounts and billing tracking working perfectly!');
  } else {
    console.error('❌ Coupon billing logic failed.');
    process.exit(1);
  }

  // ----------------------------------------------------
  // TEST 7 & 8: Free plan lead messaging limits (1 message)
  // ----------------------------------------------------
  console.log('\n--- Test 7 & 8: Free plan message limits (1 message max per lead) ---');
  
  // Reset user plan back to "free" for this test
  updatedUserCoupon.plan = 'free';
  await updatedUserCoupon.save({ validateBeforeSave: false });

  // Get lead
  const testLead = await Lead.findOne({ userId: createdUser._id, phone: '919876543210' });
  console.log(`Lead "${testLead.name}" message count: ${testLead.messageSentCount}`);

  // Try first message track
  const reqMsg1 = {
    user: updatedUserCoupon,
    params: { id: testLead._id }
  };
  const resMsg1 = mockRes();
  await trackMessage(reqMsg1, resMsg1);
  
  if (resMsg1.statusCode === 200) {
    console.log('✅ First message tracked successfully! Current count:', resMsg1.body.messageSentCount);
  } else {
    console.error('❌ First message tracking failed:', resMsg1.body);
    process.exit(1);
  }

  // Try second message track (should be blocked)
  const resMsg2 = mockRes();
  await trackMessage(reqMsg1, resMsg2);
  if (resMsg2.statusCode === 403 && resMsg2.body.code === 'PLAN_LIMIT') {
    console.log('✅ Second message blocked successfully! Message:', resMsg2.body.message);
  } else {
    console.error('❌ Second message tracking was NOT blocked:', resMsg2.statusCode, resMsg2.body);
    process.exit(1);
  }

  // ----------------------------------------------------
  // TEST 9: Suspension request block check
  // ----------------------------------------------------
  console.log('\n--- Test 9: Suspension request block check ---');
  
  // Suspend the user manually
  updatedUserCoupon.suspension = {
    isSuspended: true,
    reason: 'Violated terms of service',
    level: 4
  };
  await updatedUserCoupon.save({ validateBeforeSave: false });

  // Test the protect middleware logic (or simulate it since it is simple)
  const { protect } = require('./middleware/auth');
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: updatedUserCoupon._id }, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_change_this');

  const reqProtect = {
    headers: {
      authorization: `Bearer ${token}`
    }
  };
  const resProtect = mockRes();
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  await protect(reqProtect, resProtect, next);

  if (resProtect.statusCode === 403 && resProtect.body.code === 'SUSPENDED') {
    console.log('✅ Suspended user request blocked instantly in protect middleware!');
  } else {
    console.error('❌ Suspended user request not blocked. Next called:', nextCalled, resProtect.statusCode, resProtect.body);
    process.exit(1);
  }

  // Clean up test data
  console.log('\nCleaning up test records from database...');
  await User.deleteMany({ email });
  await Lead.deleteMany({ userId: createdUser._id });
  await Coupon.deleteOne({ code: couponCode });
  
  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! ✅');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
