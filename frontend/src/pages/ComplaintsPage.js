import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiAlertCircle, FiArrowLeft, FiUploadCloud, FiCheck, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatAppDate } from '../utils/dateTime';

const ComplaintsPage = () => {
  const [complaints, setComplaints] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState(null);
  const [viewPreviewUrl, setViewPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedImageIdx, setSelectedImageIdx] = useState(null);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'maintenance',
    priority: 'normal',
    attachment: null
  });

  useEffect(() => {
    fetchComplaints();
  }, []);

  useEffect(() => {
    return () => {
      if (viewPreviewUrl) {
        URL.revokeObjectURL(viewPreviewUrl);
      }
    };
  }, [viewPreviewUrl]);

  const fetchComplaints = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(`${apiUrl}/api/complaint/my-complaints`, config);
      setComplaints(response.data.data || []);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      toast.error('Failed to load complaints');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = (file) => {
    const maxSize = 100 * 1024 * 1024; // 100MB

    if (file.size > maxSize) {
      toast.error('File size exceeds 100MB limit');
      return;
    }

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'video/mp4', 'video/quicktime', 'video/x-msvideo'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('File type not allowed. Allowed: images, PDF, documents, spreadsheets, videos');
      return;
    }

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreviewUrl(null);
    }

    setFormData(prev => ({ ...prev, attachment: file }));
    toast.success(`File selected: ${file.name}`);
  };

  const handlePreviewAttachment = async (complaint) => {
    if (selectedImageIdx === complaint.id) {
      setSelectedImageIdx(null);
      setPreviewLoading(false);
      if (viewPreviewUrl) {
        URL.revokeObjectURL(viewPreviewUrl);
        setViewPreviewUrl(null);
      }
      return;
    }

    setPreviewLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${apiUrl}/api/complaint/${complaint.id}/attachment/view`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to load preview');
      }

      const blob = await response.blob();
      if (viewPreviewUrl) {
        URL.revokeObjectURL(viewPreviewUrl);
      }
      const url = URL.createObjectURL(blob);
      setViewPreviewUrl(url);
      setSelectedImageIdx(complaint.id);
    } catch (error) {
      console.error('Error loading attachment preview:', error);
      toast.error('Unable to load image preview. Please try again.');
      setSelectedImageIdx(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadAttachment = async (complaint) => {
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${apiUrl}/api/complaint/${complaint.id}/attachment/download`, {
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
      link.download = complaint.attachment_filename || 'attachment';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      toast.error('Unable to download attachment. Please try again.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('You must be logged in to submit a complaint');
        return;
      }

      const apiUrl = process.env.REACT_APP_API_URL || '';
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      // Use FormData to handle file uploads
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('category', formData.category);
      submitData.append('priority', formData.priority);
      
      if (formData.attachment) {
        submitData.append('attachment', formData.attachment);
      }

      const response = await axios.post(
        `${apiUrl}/api/complaint/submit`,
        submitData,
        {
          ...config,
          headers: {
            ...config.headers,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success('Complaint submitted successfully!');
      setFormData({ title: '', description: '', category: 'maintenance', priority: 'normal', attachment: null });
      setShowForm(false);
      
      // Refresh complaints list
      await fetchComplaints();
    } catch (error) {
      console.error('Error submitting complaint:', error);
      toast.error(error.response?.data?.message || 'Failed to submit complaint');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'submitted':
        return 'bg-yellow-100 text-yellow-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-orange-100 text-orange-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) return <LoadingSpinner message="Loading Complaints" />;

  return (
    <div className="min-h-screen page-wrapper p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/tenant')}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--accent-dark)] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
            >
              <FiArrowLeft size={18} />
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-slate-900">My Complaints</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 brand-button text-white px-4 py-2 rounded-lg hover:opacity-95"
          >
            <FiPlus /> File New Complaint
          </button>
        </div>

        {/* Complaint Form */}
        {showForm && (
          <div className="card-base p-6 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">File a New Complaint</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Complaint Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g., Broken door lock, Water leak"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe the issue in detail"
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Category</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="maintenance">Maintenance</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="noise">Noise Issue</option>
                    <option value="safety">Safety</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Priority</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              {/* File Upload Dropbox */}
              <div>
                <label className="block text-gray-700 font-medium mb-2">Attachment (Optional)</label>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                  }`}
                >
                  <input
                    id="file-input"
                    type="file"
                    hidden
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                  <label htmlFor="file-input" className="flex flex-col items-center justify-center cursor-pointer">
                    <FiUploadCloud className="text-4xl text-gray-400 mb-2" />
                    <p className="text-gray-700 font-medium">
                      {formData.attachment
                        ? `📎 ${formData.attachment.name}`
                        : 'Drag and drop your file here, or click to select'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Max 100MB • Images, PDF, Documents, Videos
                    </p>
                  </label>
                </div>
                {formData.attachment && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, attachment: null }));
                      setAttachmentPreviewUrl(null);
                    }}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                  >
                    <FiX size={16} /> Remove File
                  </button>
                )}

                {/* Image Preview */}
                {attachmentPreviewUrl && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 font-medium mb-2">Preview:</p>
                    <img 
                      src={attachmentPreviewUrl} 
                      alt="File preview" 
                      className="max-w-xs max-h-64 rounded-lg border border-gray-300 object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 brand-button text-white py-2 rounded-lg hover:opacity-95 font-medium"
                >
                  Submit Complaint
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Complaints List */}
        <div className="card-base p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">All Complaints</h2>

          {complaints.length === 0 ? (
            <div className="text-center py-12">
              <FiAlertCircle className="mx-auto text-4xl text-gray-300 mb-4" />
              <p className="text-gray-500">No complaints filed yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {complaints.map(complaint => (
                <div key={complaint.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{complaint.title}</h3>
                      <p className="text-sm text-gray-600">Filed on {formatAppDate(complaint.created_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}>
                        {complaint.status?.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(complaint.priority)}`}>
                        {complaint.priority?.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-700 mb-3">{complaint.description}</p>

                  <div className="flex flex-col gap-3 text-sm">
                    <div className="flex gap-4">
                      <span className="text-gray-600">
                        <strong>Category:</strong> {complaint.category?.toUpperCase()}
                      </span>
                    </div>

                    {complaint.attachment_filename && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg border border-blue-200">
                          <FiUploadCloud className="text-blue-600" size={16} />
                          <div className="flex-1">
                            <p className="text-blue-900 font-medium text-sm">{complaint.attachment_filename}</p>
                            <p className="text-blue-700 text-xs">
                              {(complaint.attachment_size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {complaint.attachment_type?.startsWith('image/') && (
                              <button
                                onClick={() => handlePreviewAttachment(complaint)}
                                className="text-green-600 hover:text-green-800 font-medium text-xs px-3 py-1 rounded hover:bg-green-100"
                              >
                                {selectedImageIdx === complaint.id ? 'Hide Preview' : previewLoading && selectedImageIdx === complaint.id ? 'Loading...' : 'Preview'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDownloadAttachment(complaint)}
                              className="text-blue-600 hover:text-blue-800 font-medium text-xs px-3 py-1 rounded hover:bg-blue-100"
                            >
                              Download
                            </button>
                          </div>
                        </div>

                        {/* Inline Image Preview */}
                        {complaint.attachment_type?.startsWith('image/') && selectedImageIdx === complaint.id && (
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-sm font-medium text-gray-700">Image Preview</p>
                              <button
                                onClick={() => handlePreviewAttachment(complaint)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <FiX size={18} />
                              </button>
                            </div>
                            {previewLoading && !viewPreviewUrl ? (
                              <p className="text-sm text-gray-500">Loading preview...</p>
                            ) : viewPreviewUrl ? (
                              <img
                                src={viewPreviewUrl}
                                alt="Complaint attachment preview"
                                className="max-w-lg max-h-96 rounded border border-gray-300 object-contain"
                              />
                            ) : (
                              <p className="text-sm text-red-500">Preview not available.</p>
                            )}
                          </div>
                        )}
                      </div>
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

export default ComplaintsPage;
