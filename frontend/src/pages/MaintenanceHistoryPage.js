import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatAppDateTime } from '../utils/dateTime';

const MaintenanceHistoryPage = () => {
  const navigate = useNavigate();
  const [historyTasks, setHistoryTasks] = useState([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchHistoryTasks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/complaint/assigned-tasks/history/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistoryTasks(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load task history:', error.response?.data || error.message);
      toast.error('Failed to load task history');
      setHistoryTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryTasks();
  }, []);

  const toggleTaskSelection = (taskId, checked) => {
    setSelectedTaskIds((prev) => {
      const next = { ...prev };
      if (checked) {
        next[String(taskId)] = true;
      } else {
        delete next[String(taskId)];
      }
      return next;
    });
  };

  const allSelected = historyTasks.length > 0 && historyTasks.every((task) => selectedTaskIds[String(task.id)]);

  const toggleSelectAll = (checked) => {
    if (!checked) {
      setSelectedTaskIds({});
      return;
    }

    const next = {};
    historyTasks.forEach((task) => {
      next[String(task.id)] = true;
    });
    setSelectedTaskIds(next);
  };

  const restoreSelectedTasks = async () => {
    const selectedIds = Object.keys(selectedTaskIds)
      .filter((id) => selectedTaskIds[id])
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isInteger(id));

    if (selectedIds.length === 0) {
      toast.error('Select at least one task to restore');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        '/api/complaint/assigned-tasks/restore',
        { taskIds: selectedIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${selectedIds.length} task(s) restored`);
      setSelectedTaskIds({});
      fetchHistoryTasks();
    } catch (error) {
      console.error('Failed to restore tasks:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to restore tasks');
    }
  };

  if (loading) return <LoadingSpinner message="Loading maintenance history" />;

  return (
    <div className="min-h-screen page-wrapper pb-12">
      <div className="dashboard-header py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold">Maintenance Task History</h1>
          <p className="mt-2">Archived completed tasks</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/maintenance')}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 font-medium transition"
          >
            Back to Dashboard
          </button>
          {historyTasks.length > 0 && (
            <>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
                <span>Select All</span>
              </label>
              <button
                onClick={restoreSelectedTasks}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium transition"
              >
                Restore Selected
              </button>
            </>
          )}
        </div>

        <div className="card-base">
          <div className="px-6 py-4 border-b border-slate-200 bg-surface-soft rounded-t-lg">
            <h2 className="text-lg font-bold text-slate-900">Archived Tasks</h2>
          </div>

          {historyTasks.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p>No archived tasks yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border-t border-slate-200 bg-white rounded-b-xl">
              {historyTasks.map((task) => (
                <div key={`history-${task.id}`} className="p-5 flex items-center justify-between gap-4 hover:bg-slate-50 transition border-b border-slate-200 last:border-b-0">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!selectedTaskIds[String(task.id)]}
                      onChange={(e) => toggleTaskSelection(task.id, e.target.checked)}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {task.category} | {task.status.replace('_', ' ')} | archived {formatAppDateTime(task.archived_at)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('token');
                        await axios.post(
                          '/api/complaint/assigned-tasks/restore',
                          { taskIds: [task.id] },
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        toast.success('Task restored');
                        fetchHistoryTasks();
                      } catch (error) {
                        toast.error(error.response?.data?.message || 'Failed to restore task');
                      }
                    }}
                    className="px-3 py-1 rounded bg-indigo-100 text-indigo-800 text-xs font-medium hover:bg-indigo-200 transition"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaintenanceHistoryPage;
