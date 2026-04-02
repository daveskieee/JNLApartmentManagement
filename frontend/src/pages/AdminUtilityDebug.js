import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AdminUtilityDebug = () => {
  const [form, setForm] = useState({ tenantId: '', utilityType: 'water', readingValue: '', readingDate: '', unit: '', estimatedCost: '', currency: 'PHP' });
  const [history, setHistory] = useState([]);

  const submitReading = async () => {
    if (!form.tenantId || !form.readingValue || !form.readingDate) {
      toast.error('tenantId, readingValue and readingDate are required');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/utility/assign', form, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) {
        toast.success('Reading assigned');
        setForm(prev => ({ ...prev, readingValue: '', readingDate: '' }));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to assign reading');
    }
  };

  const loadHistory = async () => {
    if (!form.tenantId) return toast.error('Enter tenantId to load history');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/utility/history/${form.tenantId}`, { headers: { Authorization: `Bearer ${token}` } });
      const sorted = (res.data.data || []).slice().sort((a,b) => {
        const aDate = new Date(a.reading_date || a.created_at || 0).getTime();
        const bDate = new Date(b.reading_date || b.created_at || 0).getTime();
        return bDate - aDate;
      });
      setHistory(sorted);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load history');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Utility Debug / Test Page</h1>
      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input value={form.tenantId} onChange={(e) => setForm({...form, tenantId: e.target.value})} placeholder="Tenant ID" className="px-3 py-2 border rounded" />
          <select value={form.utilityType} onChange={(e) => setForm({...form, utilityType: e.target.value})} className="px-3 py-2 border rounded">
            <option value="water">Water</option>
            <option value="electricity">Electricity</option>
            <option value="gas">Gas</option>
          </select>
          <input value={form.readingValue} onChange={(e) => setForm({...form, readingValue: e.target.value})} placeholder="Reading Value" className="px-3 py-2 border rounded" />
          <input value={form.readingDate} onChange={(e) => setForm({...form, readingDate: e.target.value})} type="date" placeholder="Reading Date" className="px-3 py-2 border rounded" />
          <input value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})} placeholder="Unit (e.g. kWh)" className="px-3 py-2 border rounded" />
          <input value={form.estimatedCost} onChange={(e) => setForm({...form, estimatedCost: e.target.value})} placeholder="Estimated Cost" className="px-3 py-2 border rounded" />
          <select value={form.currency} onChange={(e) => setForm({...form, currency: e.target.value})} className="px-3 py-2 border rounded">
            <option value="PHP">PHP (₱)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={submitReading} className="px-4 py-2 bg-blue-600 text-white rounded">Assign Reading</button>
          <button onClick={loadHistory} className="px-4 py-2 bg-gray-200 rounded">Load History</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-3">Recent Readings</h2>
        {history.length === 0 ? (
          <p className="text-gray-500">No readings loaded</p>
        ) : (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="p-3 border rounded">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm font-semibold">{h.utility_type || h.meter_type} — {h.reading_value || h.reading || ''} {h.unit || ''}</p>
                    <p className="text-xs text-gray-500">Date: {h.reading_date}</p>
                  </div>
                  <div className="text-sm text-gray-700">Cost: {h.estimated_cost || h.cost || '0'} {h.currency || 'PHP'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUtilityDebug;
