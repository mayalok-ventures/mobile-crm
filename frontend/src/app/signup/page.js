'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { Eye, EyeOff, Zap, User, Mail, Phone, Lock } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!form.name || !form.password) return toast.error('Name and password required');
    if (!form.email && !form.phone) return toast.error('Provide email or phone number');
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');

    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        password: form.password,
      });
      setAuth(data, data.token);
      toast.success(`Account created! Welcome, ${data.name} 🎉`);
      router.replace('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ paddingBottom: 16 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:56, height:56, borderRadius:18, background:'var(--accent)', marginBottom:12, boxShadow:'0 8px 32px var(--accent-glow)' }}>
            <Zap size={28} color="white" fill="white" />
          </div>
          <h1 style={{ fontSize:24, fontWeight:800, margin:0, color: 'var(--text)' }}>
            Create Account
          </h1>
          <p style={{ color:'var(--text-muted)', marginTop:4, fontSize:13 }}>Start closing deals faster</p>
        </div>

        <form onSubmit={handleSignup} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label className="label"><User size={12} style={{ display:'inline', marginRight:4 }} />Full Name *</label>
            <input className="input" type="text" placeholder="Your full name" value={form.name} onChange={set('name')} autoComplete="name" />
          </div>

          <div style={{ padding:10, background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:10, fontSize:12, color:'var(--text-muted)', textAlign:'left' }}>
            💡 Provide <strong style={{color:'var(--text)'}}>email</strong> or <strong style={{color:'var(--text)'}}>phone</strong> (or both). Cannot be changed after signup.
          </div>

          <div>
            <label className="label"><Mail size={12} style={{ display:'inline', marginRight:4 }} />Email (optional if phone provided)</label>
            <input className="input" type="email" placeholder="your@email.com" value={form.email} onChange={set('email')} autoComplete="email" inputMode="email" />
          </div>

          <div>
            <label className="label"><Phone size={12} style={{ display:'inline', marginRight:4 }} />Phone (optional if email provided)</label>
            <input className="input" type="tel" placeholder="+91 9999999999" value={form.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" />
          </div>

          <div>
            <label className="label"><Lock size={12} style={{ display:'inline', marginRight:4 }} />Password *</label>
            <div style={{ position:'relative' }}>
              <input
                className="input"
                type={showPass ? 'text' : 'password'}
                placeholder="Min 6 characters"
                value={form.password}
                onChange={set('password')}
                style={{ paddingRight:48 }}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Confirm Password *</label>
            <input className="input" type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />
          </div>

          <button className="btn btn-primary btn-full" type="submit" disabled={loading} style={{ marginTop:8 }}>
            {loading ? <div className="spinner" style={{ width:20, height:20, borderWidth:2 }} /> : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:20, color:'var(--text-muted)', fontSize:14 }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color:'var(--accent-light)', fontWeight:600, textDecoration:'none' }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
