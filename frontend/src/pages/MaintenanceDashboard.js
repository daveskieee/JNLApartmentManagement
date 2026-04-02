import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

const MaintenanceDashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({
    assigned: 0,
    inProgress: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignedTasks();
  }, []);

  const fetchAssignedTasks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please login first');
        setTasks([]);
        setLoading(false);
        return;
      }
      const response = await axios.get('/api/complaint/assigned-tasks/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = response.data?.data || response.data || [];
      setTasks(data);
      
      setStats({
        assigned: data.filter(t => t.status === 'submitted').length,
        inProgress: data.filter(t => t.status === 'in_progress').length,
        completed: data.filter(t => t.status === 'resolved' || t.status === 'closed' || t.status === 'completed').length,
      });
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      
      // Update stats
      const updated = tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
      setStats({
        assigned: updated.filter(t => t.status === 'submitted').length,
        inProgress: updated.filter(t => t.status === 'in_progress').length,
        completed: updated.filter(t => t.status === 'completed' || t.status === 'resolved').length,
      });

      // Try to update via API
      try {
        const token = localStorage.getItem('token');
        await axios.patch(`/api/complaint/${taskId}`, { status: newStatus }, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        console.log('API update failed, but local update succeeded');
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
      case 'resolved':
        return <CheckCircle size={20} className="text-green-600" />;
      case 'in_progress':
        return <Clock size={20} className="text-yellow-600" />;
      case 'submitted':
        return <AlertCircle size={20} className="text-blue-600" />;
      default:
        return <AlertCircle size={20} className="text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold">Maintenance Dashboard</h1>
          <p className="text-blue-100 mt-2">Manage your assigned tasks</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm font-medium">Assigned Tasks</p>
            <p className="text-3xl font-bold text-blue-600">{stats.assigned}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <p className="text-gray-600 text-sm font-medium">In Progress</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.inProgress}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm font-medium">Completed</p>
            <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="mb-6">
          <button
            onClick={fetchAssignedTasks}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            <RefreshCw size={18} />
            <span>Refresh Tasks</span>
          </button>
        </div>

        {/* Tasks List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Active Tasks</h2>
          </div>

          {loading ? (
            <LoadingSpinner fullPage={false} message="Loading tasks" />
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No tasks assigned yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {tasks.map(task => (
                <div key={task.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="pt-1">
                        {getStatusIcon(task.status)}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">{task.title}</h3>
                        <p className="text-gray-600 text-sm mt-1">{task.description}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                      {task.priority.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4 p-4 bg-gray-50 rounded">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Category</p>
                      <p className="text-sm font-semibold text-gray-700">{task.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Tenant</p>
                      <p className="text-sm font-semibold text-gray-700">{task.full_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Status</p>
                      <p className="text-sm font-semibold text-gray-700 capitalize">{task.status.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Priority</p>
                      <p className="text-sm font-semibold text-gray-700 capitalize">{task.priority}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    {task.status === 'submitted' && (
                      <button
                        onClick={() => updateTaskStatus(task.id, 'in_progress')}
                        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded font-medium transition text-sm"
                      >
                        Start Work
                      </button>
                    )}
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => updateTaskStatus(task.id, 'resolved')}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition text-sm"
                      >
                        Mark Complete
                      </button>
                    )}
                    {(task.status === 'resolved' || task.status === 'completed') && (
                      <span className="px-4 py-2 bg-green-100 text-green-800 rounded font-medium text-sm">
                        ✓ Completed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaintenanceDashboard;
