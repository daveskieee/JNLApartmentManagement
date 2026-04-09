import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Clock, RefreshCw, Search, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { 
  detectObjects, 
  openGoogleLens, 
  openShoppingSearch,
  loadCocoModel 
} from '../utils/imageRecognition';
import ImageSelector from '../components/ImageSelector';
import { formatAppDateTime, formatAppTime } from '../utils/dateTime';

const MaintenanceDashboard = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({
    assigned: 0,
    inProgress: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedPreviewTaskId, setSelectedPreviewTaskId] = useState(null);
  const [previewTaskUrls, setPreviewTaskUrls] = useState({}); // Store URLs for all tasks
  const [previewLoading, setPreviewLoading] = useState({});
  const [imageRecognitionLoading, setImageRecognitionLoading] = useState({}); // Per-task loading state
  const [showImageSelector, setShowImageSelector] = useState(null); // { taskId, mode, imageUrl }
  const [detectedObjects, setDetectedObjects] = useState({});
  const [selectedCompletedTaskIds, setSelectedCompletedTaskIds] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    fetchAssignedTasks();
    fetchNotifications();
    // Load the ML model in the background for faster image recognition
    loadCocoModel()
      .then(() => {
        console.log('Image recognition model loaded');
      })
      .catch((err) => {
        console.warn('Could not preload image recognition model:', err);
        // Non-critical, will load on demand
      });

    const interval = setInterval(() => {
      fetchNotificationsQuiet();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      // Clean up all preview URLs
      Object.values(previewTaskUrls).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [previewTaskUrls]);

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

      // Automatically load previews for tasks with image attachments
      const imageTasks = data.filter(task => 
        task.attachment_filename && task.attachment_type?.startsWith('image/')
      );
      if (imageTasks.length > 0) {
        loadAllImagePreviews(imageTasks);
        // Auto-show all image previews by default
        setSelectedPreviewTaskId('all');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };

      const [listRes, countRes] = await Promise.all([
        axios.get('/api/notifications?limit=8', { headers }).catch(() => ({ data: { data: [] } })),
        axios.get('/api/notifications/unread-count', { headers }).catch(() => ({ data: { data: { unread: 0 } } })),
      ]);

      setNotifications(listRes.data?.data || []);
      setUnreadNotifications(countRes.data?.data?.unread || 0);
    } catch (error) {
      console.warn('Failed to load notifications:', error?.message || error);
    }
  };

  const fetchNotificationsQuiet = async () => {
    await fetchNotifications();
  };

  const markNotificationRead = async (id) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await axios.patch(`/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
    } catch (error) {
      console.warn('Failed to mark notification as read:', error?.message || error);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await axios.patch('/api/notifications/mark-all-read', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
      toast.success('All notifications marked as read');
    } catch (error) {
      console.warn('Failed to mark all notifications as read:', error?.message || error);
    }
  };

  const loadAllImagePreviews = async (imageTasks) => {
    const token = localStorage.getItem('token');
    const apiUrl = process.env.REACT_APP_API_URL || '';

    // Load previews for all image tasks in parallel
    const previewPromises = imageTasks.map(async (task) => {
      try {
        setPreviewLoading(prev => ({ ...prev, [task.id]: true }));
        
        const response = await fetch(`${apiUrl}/api/complaint/${task.id}/attachment/view`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          console.warn(`Failed to load preview for task ${task.id}`);
          return;
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        setPreviewTaskUrls(prev => ({ ...prev, [task.id]: url }));
      } catch (error) {
        console.warn(`Error loading preview for task ${task.id}:`, error);
      } finally {
        setPreviewLoading(prev => ({ ...prev, [task.id]: false }));
      }
    });

    await Promise.allSettled(previewPromises);
  };

  const startImageSelection = (task, mode) => {
    const taskPreviewUrl = previewTaskUrls[task.id];
    if (!taskPreviewUrl) {
      toast.error('Please load image preview first');
      return;
    }

    setShowImageSelector({
      taskId: task.id,
      mode,
      imageUrl: taskPreviewUrl,
    });
  };

  const handlePreviewTaskAttachment = async (task) => {
    // If currently showing all previews, hide this specific one
    if (selectedPreviewTaskId === 'all') {
      // For now, just hide all and show none. Could be enhanced to hide individual ones
      setSelectedPreviewTaskId(null);
      return;
    }

    // If currently showing this specific task, hide it
    if (selectedPreviewTaskId === task.id) {
      setSelectedPreviewTaskId(null);
      return;
    }

    // Show this specific task's preview
    setSelectedPreviewTaskId(task.id);

    // If preview URL doesn't exist yet, load it
    if (!previewTaskUrls[task.id]) {
      if (!task.attachment_filename || !task.attachment_type?.startsWith('image/')) {
        toast.error('No image attachment available for preview');
        return;
      }

      setPreviewLoading(prev => ({ ...prev, [task.id]: true }));
      try {
        const token = localStorage.getItem('token');
        const apiUrl = process.env.REACT_APP_API_URL || '';
        const response = await fetch(`${apiUrl}/api/complaint/${task.id}/attachment/view`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to load preview');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPreviewTaskUrls(prev => ({ ...prev, [task.id]: url }));
      } catch (error) {
        console.error('Error loading attachment preview:', error);
        toast.error('Unable to load image preview. Please try again.');
        setPreviewLoading(prev => ({ ...prev, [task.id]: false }));
        return;
      } finally {
        setPreviewLoading(prev => ({ ...prev, [task.id]: false }));
      }
    }
  };

  const handleDownloadTaskAttachment = async (task) => {
    if (!task.attachment_filename) {
      toast.error('No attachment available to download');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${apiUrl}/api/complaint/${task.id}/attachment/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to download attachment');
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = task.attachment_filename || 'attachment';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      toast.error('Unable to download attachment. Please try again.');
    }
  };

  const runImageRecognition = async (taskId, imageUrl) => {
    try {
      setImageRecognitionLoading(prev => ({ ...prev, [taskId]: true }));
      toast.loading('Analyzing image for parts...');

      // Create image element for analysis
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = async () => {
        try {
          const detections = await detectObjects(img);
          setDetectedObjects(prev => ({
            ...prev,
            [taskId]: detections
          }));
          
          toast.dismiss();
          if (detections.length > 0) {
            toast.success(`Found ${detections.length} item(s): ${detections.map(d => d.label).join(', ')}`);
          } else {
            toast.info('Could not identify specific parts in image');
          }
        } catch (error) {
          console.error('Error detecting objects:', error);
          toast.error('Image recognition failed. Try Google Lens instead.');
        } finally {
          setImageRecognitionLoading(prev => ({ ...prev, [taskId]: false }));
          if (imageUrl && imageUrl.startsWith('blob:')) {
            setTimeout(() => URL.revokeObjectURL(imageUrl), 30000);
          }
        }
      };

      img.onerror = () => {
        toast.dismiss();
        toast.error('Failed to load image for analysis');
        setImageRecognitionLoading(prev => ({ ...prev, [taskId]: false }));
        if (imageUrl && imageUrl.startsWith('blob:')) {
          setTimeout(() => URL.revokeObjectURL(imageUrl), 30000);
        }
      };

      img.src = imageUrl;
    } catch (error) {
      console.error('Error in image recognition:', error);
      toast.error('Image recognition error');
      setImageRecognitionLoading(prev => ({ ...prev, [taskId]: false }));
      if (imageUrl && imageUrl.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(imageUrl), 30000);
      }
    }
  };

  const copyImageToClipboard = async (blob) => {
    if (!blob) return false;
    if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') return false;

    try {
      await navigator.clipboard.write([
        new window.ClipboardItem({
          [blob.type || 'image/png']: blob,
        }),
      ]);
      return true;
    } catch (error) {
      console.warn('Clipboard write failed:', error);
      return false;
    }
  };

  const isMobileDevice = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    return /android|iphone|ipad|ipod|mobile/i.test(ua);
  };

  const shareOrSaveCroppedImageMobile = async (blob, croppedImageUrl) => {
    try {
      // Best mobile UX: share sheet can hand off to Lens or save to gallery/files.
      if (navigator.share && navigator.canShare && blob) {
        const file = new File([blob], `lens-crop-${Date.now()}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Selected Part Image',
            text: 'Use this cropped image in Google Lens',
          });
          return true;
        }
      }
    } catch (error) {
      console.warn('Mobile share unavailable:', error);
    }

    // Fallback: open image tab so user can long-press/save, then upload in Lens.
    window.open(croppedImageUrl, '_blank');
    return false;
  };

  const handleSelectedImageRegion = async (croppedImageUrl, _region, croppedBlob) => {
    if (!showImageSelector) return;

    const { taskId, mode } = showImageSelector;
    setShowImageSelector(null);

    if (mode === 'recognize') {
      await runImageRecognition(taskId, croppedImageUrl);
      return;
    }

    if (mode === 'lens') {
      try {
        const mobile = isMobileDevice();
        let copied = false;

        if (!mobile) {
          copied = await copyImageToClipboard(croppedBlob);
        }

        openGoogleLens(croppedImageUrl);

        if (!mobile && copied) {
          toast.success('Selection copied. Press Ctrl+V in Google Lens to paste. Upload remains optional.');
        } else if (mobile) {
          const shared = await shareOrSaveCroppedImageMobile(croppedBlob, croppedImageUrl);
          if (shared) {
            toast.success('Image shared. In Google Lens, choose the shared/saved image if needed.');
          } else {
            toast.success('Image opened. Save it, then in Google Lens tap Upload and choose that image.');
          }
        } else {
          window.open(croppedImageUrl, '_blank');
          toast.success('Google Lens opened. Clipboard blocked, so image tab was opened for optional upload.');
        }
      } catch (error) {
        console.error('Error opening Google Lens:', error);
        toast.error('Failed to open Google Lens');
      } finally {
        if (croppedImageUrl && croppedImageUrl.startsWith('blob:')) {
          setTimeout(() => URL.revokeObjectURL(croppedImageUrl), 120000);
        }
      }
    }
  };

  const cancelImageSelection = () => {
    setShowImageSelector(null);
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

  const clearTaskToHistory = async (taskId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/complaint/assigned-tasks/archive',
        { taskIds: [taskId] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTasks(prev => prev.filter(task => task.id !== taskId));
      setSelectedCompletedTaskIds(prev => {
        const next = { ...prev };
        delete next[String(taskId)];
        return next;
      });
      toast.success('Task moved to history');
    } catch (error) {
      console.error('Archive task error:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to archive task');
    }
  };

  const toggleCompletedTaskSelection = (taskId, checked) => {
    setSelectedCompletedTaskIds(prev => {
      const next = { ...prev };
      if (checked) {
        next[String(taskId)] = true;
      } else {
        delete next[String(taskId)];
      }
      return next;
    });
  };

  const archiveSelectedCompletedTasks = async () => {
    const selectedIds = Object.keys(selectedCompletedTaskIds)
      .filter((id) => selectedCompletedTaskIds[id])
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isInteger(id));

    if (selectedIds.length === 0) {
      toast.error('Select at least one completed task to archive');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/complaint/assigned-tasks/archive',
        { taskIds: selectedIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTasks(prev => prev.filter(task => !selectedIds.includes(task.id)));
      setSelectedCompletedTaskIds({});
      toast.success(`${selectedIds.length} task(s) moved to history`);
    } catch (error) {
      console.error('Archive selected tasks error:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to archive selected tasks');
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

  const getDetectionModelLabel = (taskId) => {
    const modelName = detectedObjects[taskId]?.[0]?.model;
    if (modelName === 'hf-grounding-dino') {
      return { text: 'API AI (Grounding DINO)', className: 'bg-teal-100 text-teal-800 border-teal-200' };
    }
    if (modelName === 'hf-detr') {
      return { text: 'API AI (HF DETR)', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    if (modelName === 'owl-vit') {
      return { text: 'Enhanced AI (OWL-ViT)', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
    }
    if (modelName === 'coco-ssd') {
      return { text: 'Fallback AI (COCO-SSD)', className: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
    return null;
  };

  const activeTasks = tasks;
  const completedActiveTasks = activeTasks.filter(task => ['resolved', 'completed', 'closed'].includes(task.status));
  const allCompletedSelected = completedActiveTasks.length > 0 && completedActiveTasks.every(task => selectedCompletedTaskIds[String(task.id)]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="min-h-screen page-wrapper pb-12"
    >
      {/* Header */}
      <div className="dashboard-header py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold">Maintenance Dashboard</h1>
          <p className="mt-2">Manage your assigned tasks</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card-base p-6 border border-slate-200 border-l-4 border-blue-500">
            <p className="text-slate-500 text-sm font-medium">Assigned Tasks</p>
            <p className="text-3xl font-bold text-blue-600">{stats.assigned}</p>
          </div>
          <div className="card-base p-6 border border-slate-200 border-l-4 border-yellow-500">
            <p className="text-slate-500 text-sm font-medium">In Progress</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.inProgress}</p>
          </div>
          <div className="card-base p-6 border border-slate-200 border-l-4 border-green-500">
            <p className="text-slate-500 text-sm font-medium">Completed</p>
            <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            onClick={fetchAssignedTasks}
            className="flex items-center space-x-2 brand-button px-4 py-2 rounded-lg font-medium transition"
          >
            <RefreshCw size={18} />
            <span>Refresh Tasks</span>
          </button>
          <button
            onClick={() => navigate('/maintenance/history')}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 font-medium transition"
          >
            Open Task History
          </button>
          {completedActiveTasks.length > 0 && (
            <>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={allCompletedSelected}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const next = {};
                    if (checked) {
                      completedActiveTasks.forEach(task => {
                        next[String(task.id)] = true;
                      });
                    }
                    setSelectedCompletedTaskIds(next);
                  }}
                />
                <span>Select All Completed</span>
              </label>
              <button
                onClick={archiveSelectedCompletedTasks}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium transition"
              >
                Archive Selected
              </button>
            </>
          )}
        </div>

        {/* Tasks List */}
<div className="card-base">
          <div className="px-6 py-4 border-b border-slate-200 bg-surface-soft rounded-t-lg">
            <h2 className="text-lg font-bold text-slate-900">Active Tasks</h2>
          </div>

          {loading ? (
            <LoadingSpinner fullPage={false} message="Loading tasks" />
          ) : activeTasks.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p>No active tasks</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border-t border-slate-200 bg-white rounded-b-xl">
              {activeTasks.map(task => (
                <div key={task.id} className="p-6 hover:bg-slate-50 transition border-b border-slate-200 last:border-b-0">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="pt-1">
                        {getStatusIcon(task.status)}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900">{task.title}</h3>
                        <p className="text-slate-600 text-sm mt-1">{task.description}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                      {task.priority.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4 p-4 bg-slate-50 rounded border border-slate-200">
                    <div className="border-r border-slate-200 pr-3">
                      <p className="text-xs text-slate-500 font-medium">Category</p>
                      <p className="text-sm font-semibold text-slate-900">{task.category}</p>
                    </div>
                    <div className="border-r border-slate-200 pr-3">
                      <p className="text-xs text-slate-500 font-medium">Tenant</p>
                      <p className="text-sm font-semibold text-slate-900">{task.full_name || 'N/A'}</p>
                    </div>
                    <div className="border-r border-slate-200 pr-3">
                      <p className="text-xs text-slate-500 font-medium">Status</p>
                      <p className="text-sm font-semibold text-slate-900 capitalize">{task.status.replace('_', ' ')}</p>
                    </div>
                    <div className="pl-3">
                      <p className="text-xs text-slate-500 font-medium">Priority</p>
                      <p className="text-sm font-semibold text-slate-900 capitalize">{task.priority}</p>
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
                    {(task.status === 'resolved' || task.status === 'completed' || task.status === 'closed') && (
                      <>
                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded bg-white border border-slate-300 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={!!selectedCompletedTaskIds[String(task.id)]}
                            onChange={(e) => toggleCompletedTaskSelection(task.id, e.target.checked)}
                          />
                          Select
                        </label>
                        <span className="px-4 py-2 bg-green-100 text-green-800 rounded font-medium text-sm">
                          ✓ Completed
                        </span>
                        <button
                          onClick={() => clearTaskToHistory(task.id)}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded font-medium transition text-sm"
                        >
                          Clear to History
                        </button>
                      </>
                    )}
                  </div>

                  {task.attachment_filename && (
                    <div className="mt-4 p-4 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-slate-900">Attachment</p>
                          <p className="text-sm text-slate-600">{task.attachment_filename}</p>
                          {task.attachment_size && (
                            <p className="text-xs text-slate-500">{(task.attachment_size / (1024 * 1024)).toFixed(2)} MB</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {task.attachment_type?.startsWith('image/') && (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePreviewTaskAttachment(task)}
                                className="px-3 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-medium hover:bg-emerald-200 transition"
                              >
                                {(selectedPreviewTaskId === task.id || selectedPreviewTaskId === 'all') ? 'Hide Preview' : previewLoading[task.id] ? 'Loading...' : 'Show Preview'}
                              </button>
                              {(selectedPreviewTaskId === task.id || selectedPreviewTaskId === 'all') && previewTaskUrls[task.id] && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startImageSelection(task, 'recognize')}
                                    disabled={imageRecognitionLoading[task.id]}
                                    className="px-3 py-1 rounded bg-purple-100 text-purple-800 text-xs font-medium hover:bg-purple-200 disabled:opacity-50 transition flex items-center gap-1"
                                    title="Analyze image for replacement parts using AI"
                                  >
                                    <Zap size={14} />
                                    {imageRecognitionLoading[task.id] ? 'Analyzing...' : 'Recognize Parts'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startImageSelection(task, 'lens')}
                                    className="px-3 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium hover:bg-blue-200 transition flex items-center gap-1"
                                    title="Open in Google Lens"
                                  >
                                    <Search size={14} />
                                    Google Lens
                                  </button>
                                </>
                              )}
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadTaskAttachment(task)}
                            className="px-3 py-1 rounded bg-slate-100 text-slate-800 text-xs font-medium hover:bg-slate-200 transition"
                          >
                            Download
                          </button>
                        </div>
                      </div>

                      {(selectedPreviewTaskId === task.id || selectedPreviewTaskId === 'all') && previewTaskUrls[task.id] && (
                        <div className="mt-3">
                          <img
                            src={previewTaskUrls[task.id]}
                            alt="Task attachment preview"
                            className="w-full max-h-96 rounded-lg border border-slate-200 object-contain"
                          />
                          
                          {/* Display detected objects if available */}
                          {detectedObjects[task.id] && detectedObjects[task.id].length > 0 && (
                            <div className="mt-4 p-3 rounded-lg bg-purple-50 border border-purple-200">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <p className="text-sm font-semibold text-purple-900">Detected Parts:</p>
                                {getDetectionModelLabel(task.id) && (
                                  <span
                                    className={`px-2 py-1 text-xs font-semibold rounded border ${getDetectionModelLabel(task.id).className}`}
                                  >
                                    {getDetectionModelLabel(task.id).text}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {detectedObjects[task.id].map((obj, idx) => (
                                  <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-purple-100">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-slate-900 capitalize">{obj.label}</p>
                                      <p className="text-xs text-slate-500">{obj.confidence}% confidence</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => openShoppingSearch(obj.label)}
                                      className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition"
                                      title={`Search for ${obj.label} parts`}
                                    >
                                      Buy
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showImageSelector && (
        <ImageSelector
          imageUrl={showImageSelector.imageUrl}
          mode={showImageSelector.mode}
          onSelection={handleSelectedImageRegion}
          onCancel={cancelImageSelection}
        />
      )}
    </motion.div>
  );
};

export default MaintenanceDashboard;
