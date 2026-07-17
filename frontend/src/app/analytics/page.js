'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import { BarChart2, TrendingUp, Users, Calendar, MessageSquare, Mic } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const STATUS_COLORS = {
  new: '#6366f1',
  contacted: '#eab308',
  follow_up: '#f97316',
  closed: '#22c55e',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontSize:13 }}>
        <p style={{ margin:0, color:'var(--text-muted)' }}>{label}</p>
        <p style={{ margin:'2px 0 0', fontWeight:600 }}>{payload[0].value} leads</p>
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="app-shell" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh' }}>
      <div className="spinner" />
    </div>
  );

  const { totalLeads = 0, byStatus = {}, conversionRate = 0, totalTemplates = 0, totalRecordings = 0, todayFollowUps = 0, recentLeads = [] } = data || {};

  const statusChartData = [
    { name: 'New', value: byStatus.new || 0, color: '#6366f1' },
    { name: 'Contacted', value: byStatus.contacted || 0, color: '#eab308' },
    { name: 'Follow-up', value: byStatus.follow_up || 0, color: '#f97316' },
    { name: 'Closed', value: byStatus.closed || 0, color: '#22c55e' },
  ];

  const recentChartData = recentLeads.map(d => ({ day: d._id?.slice(5) || d._id, leads: d.count }));

  return (
    <div className="app-shell">
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
      </div>

      <div className="page-content">
        {/* Top stats */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
          <div className="stat-card">
            <div className="stat-value">{totalLeads}</div>
            <div className="stat-label">Total Leads</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color:'var(--green)' }}>{conversionRate}%</div>
            <div className="stat-label">Conversion Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color:'#f97316' }}>{todayFollowUps}</div>
            <div className="stat-label">Today's Follow-ups</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color:'#eab308' }}>{totalTemplates}</div>
            <div className="stat-label">Templates</div>
          </div>
        </div>

        {/* Conversion progress */}
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <p style={{ margin:0, fontWeight:600, fontSize:14 }}>Conversion Progress</p>
            <span style={{ fontSize:20, fontWeight:700, color:'var(--green)' }}>{conversionRate}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width:`${conversionRate}%` }} />
          </div>
          <p style={{ margin:'8px 0 0', fontSize:12, color:'var(--text-muted)' }}>
            {byStatus.closed || 0} closed out of {totalLeads} total leads
          </p>
        </div>

        {/* Status breakdown */}
        <div className="card" style={{ marginBottom:16 }}>
          <p style={{ margin:'0 0 16px', fontWeight:600, fontSize:14 }}>Leads by Status</p>
          <div style={{ height:160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(99,102,241,0.05)' }} />
                <Bar dataKey="value" radius={[6,6,0,0]}>
                  {statusChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:8 }}>
            {statusChartData.map(s => (
              <div key={s.name} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:s.color }} />
                <span style={{ color:'var(--text-muted)' }}>{s.name}: <strong style={{ color:'var(--text)' }}>{s.value}</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Last 7 days */}
        {recentChartData.length > 0 && (
          <div className="card" style={{ marginBottom:16 }}>
            <p style={{ margin:'0 0 16px', fontWeight:600, fontSize:14 }}>Leads Added (Last 7 Days)</p>
            <div style={{ height:130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recentChartData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                  <XAxis dataKey="day" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(99,102,241,0.05)' }} />
                  <Bar dataKey="leads" fill="var(--accent)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Quick stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div className="card" style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'rgba(34,197,94,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <MessageSquare size={18} color="var(--green)" />
            </div>
            <div>
              <p style={{ margin:0, fontSize:20, fontWeight:700 }}>{totalTemplates}</p>
              <p style={{ margin:0, fontSize:11, color:'var(--text-muted)' }}>Templates</p>
            </div>
          </div>
          <div className="card" style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'rgba(239,68,68,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Mic size={18} color="var(--red)" />
            </div>
            <div>
              <p style={{ margin:0, fontSize:20, fontWeight:700 }}>{totalRecordings}</p>
              <p style={{ margin:0, fontSize:11, color:'var(--text-muted)' }}>Recordings</p>
            </div>
          </div>
        </div>
      </div>

      <BottomNav active="analytics" />
    </div>
  );
}
