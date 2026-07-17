'use client';
import { useState, useEffect } from 'react';
import { MessageCircle, Zap, Shield, Star, Check, AlertCircle, FileText, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

const WA_NUMBER = process.env.NEXT_PUBLIC_WA_NUMBER || '918796475107';
const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID || '918796475107@upi';
const CRM_NAME = 'SalesCRM';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '₹199',
    period: '/month',
    icon: Zap,
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.2)',
    features: [
      'Up to 200 leads',
      '5 groups',
      'Bulk campaigns',
      'Message templates',
      'Reminder system ON',
      'Voice recordings',
    ],
    popular: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '₹499',
    period: '/month',
    icon: Star,
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.2)',
    features: [
      'Up to 1,000 leads',
      '15 groups',
      'Faster bulk campaigns',
      'Priority notifications',
      'Basic analytics',
      'Voice recordings',
    ],
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹999',
    period: '/month',
    icon: Shield,
    color: '#22c55e',
    glow: 'rgba(34,197,94,0.2)',
    features: [
      'Unlimited leads',
      'Unlimited groups',
      'Full bulk messaging',
      'Full analytics dashboard',
      'Voice recordings',
      'Priority support',
    ],
    popular: false,
  },
];

export default function PlansPage() {
  const [user, setUser] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validatedCoupon, setValidatedCoupon] = useState(null);
  const [validationError, setValidationError] = useState('');

  // Payment system state
  const [pendingPayment, setPendingPayment] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentStep, setPaymentStep] = useState(0); // 0: none, 1: UPI instructions, 2: Proof form
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchStatus = () => {
    api.get('/auth/me')
      .then(res => {
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
      })
      .catch(() => {
        try {
          const u = localStorage.getItem('user');
          if (u) setUser(JSON.parse(u));
        } catch {}
      });

    api.get('/payments/my-request')
      .then(res => {
        if (res.data && res.data.status === 'pending') {
          setPendingPayment(res.data);
        } else {
          setPendingPayment(null);
        }
      })
      .catch(err => {
        console.error('Failed to fetch payment request:', err);
      });
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getPriceDetails = (plan) => {
    const isCouponApplied = validatedCoupon && validatedCoupon.plan === plan.id;
    const discount = isCouponApplied ? validatedCoupon.discountPercent : 0;
    const originalPrice = parseFloat(plan.price.replace(/[^\d]/g, '')) || 0;
    const finalPrice = Math.round(originalPrice * (1 - (discount / 100)));
    return { originalPrice, finalPrice, discount };
  };

  const handleChoosePlan = (plan) => {
    if (!user) {
      toast.error('Please sign in to choose a plan.');
      return;
    }
    setSelectedPlan(plan);
    setPaymentStep(1);

    // Deep link invocation on mobile devices
    const { finalPrice } = getPriceDetails(plan);
    const upiLink = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(CRM_NAME)}&am=${finalPrice}&cu=INR`;
    
    // Automatically trigger app switch for deep links
    try {
      window.location.href = upiLink;
    } catch (e) {
      console.warn('Deep link redirection failed: ', e);
    }
  };

  const handlePaidClick = () => {
    setPaymentStep(2);
  };

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (!utrNumber.trim()) {
      return toast.error('UTR number is required');
    }
    if (utrNumber.trim().length < 10) {
      return toast.error('UTR number must be at least 10 characters long');
    }
    if (!screenshotFile) {
      return toast.error('Screenshot image file is required');
    }

    setSubmittingPayment(true);
    const { originalPrice, finalPrice } = getPriceDetails(selectedPlan);

    const formData = new FormData();
    formData.append('planSelected', selectedPlan.id);
    formData.append('originalPrice', originalPrice);
    formData.append('finalPrice', finalPrice);
    formData.append('utrNumber', utrNumber.trim());
    formData.append('screenshot', screenshotFile);
    if (validatedCoupon && validatedCoupon.plan === selectedPlan.id) {
      formData.append('couponCodeUsed', validatedCoupon.code);
    }

    try {
      const { data } = await api.post('/payments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Payment details submitted successfully!');
      
      // Reset payment steps
      setPaymentStep(0);
      setSelectedPlan(null);
      setUtrNumber('');
      setScreenshotFile(null);

      // Refresh status
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit payment details');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return toast.error('Please enter a coupon code');
    setValidating(true);
    setValidationError('');
    setValidatedCoupon(null);
    try {
      const { data } = await api.post('/auth/validate-coupon', { code: couponCode });
      setValidatedCoupon(data);
      toast.success(data.message || 'Coupon is valid!');
    } catch (err) {
      setValidationError(err.response?.data?.message || 'Invalid coupon code');
      toast.error(err.response?.data?.message || 'Invalid coupon code');
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="app-shell" style={{ minHeight: '100dvh', padding: '24px 20px', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 16 }}>
          <Star size={28} color="var(--yellow)" fill="var(--yellow)" />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 8px', color: 'var(--text)' }}>
          Choose Your Plan
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
          Manual Hybrid UPI payment mode — secure direct activation
        </p>
      </div>

      {/* Current plan display */}
      {user && (
        <div className="card" style={{ marginBottom: 20, textAlign: 'center', background: 'rgba(99,102,241,0.06)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Current active plan</p>
          <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, textTransform: 'capitalize', color: 'var(--accent)' }}>
            ✨ {user.plan} Plan {user.planStatus?.isExpired && <span style={{ color: 'var(--red)', fontSize: 12 }}>(Expired)</span>}
          </p>
          {user.planStatus?.daysRemaining !== null && user.planStatus?.daysRemaining !== undefined && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              {user.planStatus.daysRemaining} days remaining
            </p>
          )}
        </div>
      )}

      {/* Pending Payment Card */}
      {pendingPayment ? (
        <div className="card" style={{ padding: '24px 20px', textAlign: 'center', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 16, marginBottom: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', marginBottom: 12 }}>
            <AlertCircle size={24} color="var(--yellow)" />
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--yellow)' }}>Verification In Progress</h3>
          <p style={{ margin: '8px 0 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: '1.4' }}>
            We have received your payment details for the <strong style={{ textTransform: 'capitalize', color: 'var(--text)' }}>{pendingPayment.planSelected}</strong> plan.<br />
            Our admin team is verifying the UTR <strong style={{ color: 'var(--text)' }}>{pendingPayment.utrNumber}</strong>. Your plan will activate within 5–15 mins.
          </p>
          <div style={{ display: 'inline-flex', padding: '6px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, fontSize: 12, fontWeight: 600, color: 'var(--yellow)' }}>
            Status: PENDING ADMIN APPROVAL
          </div>
        </div>
      ) : user && user.plan !== 'free' && !user.planStatus?.isExpired ? (
        /* Plan is active and not expired: Hide plans and show activation card */
        <div className="card" style={{ padding: '24px 20px', textAlign: 'center', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 16 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', marginBottom: 12 }}>
            <Check size={24} color="var(--green)" />
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>Your plan is active</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
            Your account is currently subscribed to the <strong style={{ textTransform: 'capitalize', color: 'var(--text)' }}>{user.plan}</strong> plan.
          </p>
          {user.planStatus?.daysRemaining !== null && user.planStatus?.daysRemaining !== undefined && (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
              ⏳ {user.planStatus.daysRemaining} days remaining in billing cycle.
            </p>
          )}
        </div>
      ) : (
        /* Show Plans selection */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {PLANS.map(plan => {
            const Icon = plan.icon;
            const { originalPrice, finalPrice, discount } = getPriceDetails(plan);
            const currency = plan.price.startsWith('₹') ? '₹' : '$';

            return (
              <div
                key={plan.id}
                className="plan-card"
                style={{
                  background: 'var(--surface)',
                  border: plan.popular ? `2px solid var(--accent)` : '1px solid var(--border)',
                  borderRadius: 20,
                  padding: 24,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: -12,
                    right: 20,
                    background: 'var(--accent)',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700
                  }}>
                    POPULAR
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: plan.popular ? 'var(--accent-glow)' : 'var(--bg)',
                    border: '1px solid var(--border)'
                  }}>
                    <Icon size={20} color={plan.popular ? 'var(--accent)' : 'var(--text)'} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{plan.name}</h3>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Best value package</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  {discount > 0 ? (
                    <>
                      <span style={{ fontSize: 24, fontWeight: 800 }}>{currency}{finalPrice}</span>
                      <span style={{ fontSize: 14, color: 'var(--text-muted)', textDecoration: 'line-through' }}>{plan.price}</span>
                      <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>({discount}% Off)</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 24, fontWeight: 800 }}>{plan.price}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{plan.period}</span>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.features.map((feat, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <Check size={14} color="var(--green)" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                {user && user.plan === plan.id ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '12px',
                    borderRadius: 12,
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px dashed var(--green)',
                    color: 'var(--green)',
                    fontWeight: 700,
                    fontSize: 14
                  }}>
                    <Check size={18} /> Active Plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleChoosePlan(plan)}
                    className="btn btn-full"
                    style={{
                      background: plan.popular ? 'var(--accent)' : 'transparent',
                      border: `2px solid var(--accent)`,
                      color: plan.popular ? 'white' : 'var(--accent)',
                      justifyContent: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer'
                    }}
                  >
                    Choose {plan.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Coupon Application Card (Only shown if user plan is free) */}
      {(!user || user.plan === 'free' || user.planStatus?.isExpired) && !pendingPayment && (
        <div className="card" style={{ marginTop: 24, padding: 16 }}>
          <p className="section-title" style={{ margin: '0 0 8px' }}>🎫 Got a Coupon Code?</p>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
            Enter a promo code to instantly check discount percentages or apply it to activate your plan.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="input"
              placeholder="COUPON_CODE"
              value={couponCode}
              onChange={e => setCouponCode(e.target.value.toUpperCase())}
              style={{ textTransform: 'uppercase' }}
            />
            <button 
              className="btn btn-ghost" 
              onClick={handleValidateCoupon}
              disabled={validating}
              style={{ flexShrink: 0 }}
            >
              {validating ? <div className="spinner" style={{ width: 14, height: 14 }} /> : 'Verify'}
            </button>
          </div>
          {validatedCoupon && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
              ✓ Coupon "{validatedCoupon.code}" offers {validatedCoupon.discountPercent}% off on the {validatedCoupon.plan} plan!
            </p>
          )}
          {validationError && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>
              ✗ {validationError}
            </p>
          )}
        </div>
      )}

      {/* Dynamic Payment Process Modals */}
      {paymentStep === 1 && selectedPlan && (
        <div className="modal-overlay">
          <div className="modal-sheet">
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800 }}>Complete UPI Payment</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: '1.4' }}>
              We have generated a dynamic UPI deep-link request for you.
            </p>
            
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Selected Plan:</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{selectedPlan.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pay To UPI:</span>
                <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>{UPI_ID}</span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Amount Due:</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>₹{getPriceDetails(selectedPlan).finalPrice}</span>
              </div>
            </div>

            <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: 12, marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: '1.4' }}>
                👉 <strong>How to Pay:</strong> Click the pay button to invoke your UPI applications (Google Pay, PhonePe, Paytm, etc.). Complete the transaction, <strong>copy the UTR / Ref Number</strong>, take a screenshot of success, and return here.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  const { finalPrice } = getPriceDetails(selectedPlan);
                  const upiLink = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(CRM_NAME)}&am=${finalPrice}&cu=INR`;
                  window.open(upiLink, '_self');
                }}
              >
                📲 Pay via UPI App
              </button>
              <button className="btn btn-secondary" onClick={handlePaidClick}>
                I Have Paid
              </button>
              <button className="btn btn-ghost" onClick={() => { setPaymentStep(0); setSelectedPlan(null); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentStep === 2 && selectedPlan && (
        <div className="modal-overlay">
          <div className="modal-sheet">
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800 }}>Confirm UPI Payment</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: '1.4' }}>
              Please enter your payment reference code and upload the screenshot.
            </p>

            <form onSubmit={handleSubmitProof} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
                  UTR / Transaction ID (required, min 10 chars)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter 12-digit UTR or Reference Number"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
                  Proof Screenshot (required, image format)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setScreenshotFile(e.target.files[0])}
                  required
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    background: 'var(--bg)',
                    border: '1px dashed var(--border)',
                    borderRadius: 10,
                    padding: 8,
                    width: '100%'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setPaymentStep(1)}
                  disabled={submittingPayment}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                  disabled={submittingPayment}
                >
                  {submittingPayment ? (
                    <div className="spinner" style={{ width: 18, height: 18 }} />
                  ) : (
                    'Submit Details'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
