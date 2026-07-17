'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { Eye, EyeOff, MessageCircle, Zap } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier || !password) return toast.error('Please fill all fields');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { identifier, password });
      setAuth(data, data.token);
      toast.success(`Welcome back, ${data.name}! 👋`);
      router.replace('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:64, height:64, borderRadius:20, background:'var(--accent)', marginBottom:16, boxShadow:'0 8px 32px var(--accent-glow)' }}>
            <Zap size={32} color="white" fill="white" />
          </div>
          <h1 style={{ fontSize:28, fontWeight:800, margin:0, color: 'var(--text)' }}>
            SalesCRM
          </h1>
          <p style={{ color:'var(--text-muted)', marginTop:6, fontSize:14 }}>Your mobile sales command center</p>
        </div>

        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label className="label">Email or Phone</label>
            <input
              className="input"
              type="text"
              placeholder="Enter email or phone number"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              inputMode="email"
            />
          </div>

          <div>
            <label className="label">Password</label>
            <div style={{ position:'relative' }}>
              <input
                className="input"
                type={showPass ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ paddingRight:48 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button className="btn btn-primary btn-full" type="submit" disabled={loading} style={{ marginTop:8 }}>
            {loading ? <div className="spinner" style={{ width:20, height:20, borderWidth:2 }} /> : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:24, color:'var(--text-muted)', fontSize:14 }}>
          Don't have an account?{' '}
          <Link href="/signup" style={{ color:'var(--accent-light)', fontWeight:600, textDecoration:'none' }}>
            Sign up free
          </Link>
        </div>

        {/* WA promo */}
        <div style={{ marginTop:32, padding:16, background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.2)', borderRadius:12, display:'flex', alignItems:'center', gap:12 }}>
          <MessageCircle size={24} color="#25D366" />
          <div style={{ textAlign:'left' }}>
            <p style={{ margin:0, fontSize:13, fontWeight:600, color:'#25D366' }}>WhatsApp-powered</p>
            <p style={{ margin:0, fontSize:12, color:'var(--text-muted)' }}>Send follow-ups directly via WhatsApp</p>
          </div>
        </div>
      </div>
    </div>
  );
}
