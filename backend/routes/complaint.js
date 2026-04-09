const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const db = require('../config/database');
const { analyzeSentiment } = require('../services/sentiment');
const upload = require('../middleware/fileUpload');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const multer = require('multer');

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

const PART_QUERIES = [
  'pipe',
  'valve',
  'faucet',
  'sink',
  'toilet',
  'shower',
  'electrical outlet',
  'switch',
  'light bulb',
  'circuit breaker',
  'air conditioner',
  'fan',
  'door lock',
  'door hinge',
  'screw',
  'bolt',
  'nut',
  'window',
  'wall crack',
  'leak',
];

const guessLabelFromFile = (file) => {
  const source = `${file?.originalname || ''} ${file?.mimetype || ''}`.toLowerCase();
  if (source.includes('pipe') || source.includes('leak') || source.includes('water')) return 'pipe';
  if (source.includes('toilet')) return 'toilet';
  if (source.includes('faucet') || source.includes('tap')) return 'faucet';
  if (source.includes('switch') || source.includes('outlet') || source.includes('socket')) return 'electrical outlet';
  if (source.includes('door') || source.includes('hinge') || source.includes('lock')) return 'door lock';
  if (source.includes('window')) return 'window';
  return 'maintenance item';
};

const buildLocalDetections = (file) => {
  const primary = guessLabelFromFile(file);
  const secondaryByPrimary = {
    pipe: ['valve', 'leak'],
    toilet: ['valve', 'faucet'],
    faucet: ['valve', 'sink'],
    'electrical outlet': ['switch', 'circuit breaker'],
    'door lock': ['door hinge', 'screw'],
    window: ['wall crack', 'screw'],
    'maintenance item': ['screw', 'bolt'],
  };

  const secondary = secondaryByPrimary[primary] || ['screw', 'bolt'];
  return [
    {
      label: primary,
      confidence: 62,
      score: 0.62,
      model: 'local-fallback',
    },
    {
      label: secondary[0],
      confidence: 49,
      score: 0.49,
      model: 'local-fallback',
    },
    {
      label: secondary[1],
      confidence: 38,
      score: 0.38,
      model: 'local-fallback',
    },
    {
      label: 'manual verification needed',
      confidence: 30,
      score: 0.3,
      model: 'local-fallback',
    },
  ];
};

const callVisionModel = async ({ model, imageBuffer, imageType, payload }) => {
  const hfKey = process.env.HUGGINGFACE_API_KEY || process.env.CHATBOT_API_KEY;
  if (!hfKey) {
    throw new Error('AI API key is not configured');
  }

  return axios.post(
    `https://api-inference.huggingface.co/models/${model}`,
    payload || imageBuffer,
    {
      headers: {
        Authorization: `Bearer ${hfKey}`,
        'Content-Type': payload ? 'application/json' : (imageType || 'image/png'),
      },
      timeout: 35000,
    }
  );
};

const dbRun = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID });
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const createNotification = async (userId, message) => {
  try {
    await dbRun(
      'INSERT INTO notifications (user_id, message, is_read, created_at) VALUES (?, ?, 0, datetime(\'now\'))',
      [userId, message]
    );
  } catch (error) {
    console.warn('Failed to create notification:', error.message);
  }
};

// Submit complaint (Tenant) - with optional file upload (max 100MB)
router.post('/submit', authenticateToken, upload.single('attachment'), async (req, res) => {
  try {
    const { title, description, category, priority } = req.body;
    const tenantId = req.user.id;
    const file = req.file;

    console.log('Submitting complaint for tenant:', tenantId);
    console.log('Data:', { title, description, category, priority });
    if (file) {
      console.log('File uploaded:', { filename: file.filename, size: file.size, mimetype: file.mimetype });
    }

    if (!title || !description) {
      // Clean up uploaded file if validation fails
      if (file) {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    // Analyze sentiment of the complaint description
    let sentiment = null;
    try {
      sentiment = await analyzeSentiment(description);
      console.log('Sentiment analysis result:', sentiment);
    } catch (sentimentError) {
      console.warn('Sentiment analysis failed, continuing without it:', sentimentError.message);
    }

    // Determine priority based on sentiment if not provided
    let finalPriority = priority || 'normal';
    if (!priority && sentiment) {
      // If sentiment is very negative and no priority set, escalate to high
      if (sentiment.label === 'NEGATIVE' && sentiment.score > 0.8) {
        finalPriority = 'high';
        console.log('Escalating complaint priority to high due to negative sentiment');
      }
    }

    // Prepare file attachment data
    let attachmentFilename = null;
    let attachmentPath = null;
    let attachmentSize = null;
    let attachmentType = null;

    if (file) {
      attachmentFilename = file.filename;
      attachmentPath = `/uploads/complaints/${file.filename}`;
      attachmentSize = file.size;
      attachmentType = file.mimetype;
    }

    const result = await dbRun(
      'INSERT INTO complaints (tenant_id, title, description, category, priority, status, sentiment, attachment_filename, attachment_path, attachment_size, attachment_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))',
      [tenantId, title, description, category || 'maintenance', finalPriority, 'submitted', sentiment ? JSON.stringify(sentiment) : null, attachmentFilename, attachmentPath, attachmentSize, attachmentType]
    );

    console.log('Complaint created with ID:', result.id);

    // Notify all admins
    const admins = await dbAll('SELECT id FROM users WHERE role = ?', ['admin']);
    for (const admin of admins) {
      await createNotification(admin.id, `New complaint submitted: ${title}`);
    }

    // Notify tenant as confirmation
    await createNotification(tenantId, `Your complaint "${title}" was submitted successfully.`);

    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        tenant_id: tenantId,
        title,
        description,
        category,
        priority: finalPriority,
        status: 'submitted',
        sentiment,
        attachment_filename: attachmentFilename,
        attachment_path: attachmentPath,
        attachment_size: attachmentSize,
        attachment_type: attachmentType
      }
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    console.error('Error submitting complaint:', error);
    res.status(500).json({ success: false, message: 'Failed to submit complaint', error: error.message });
  }
});

// Get complaints for tenant
router.get('/my-complaints', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user.id;
    const complaints = await dbAll(
      'SELECT * FROM complaints WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId]
    );
    res.json({ success: true, data: complaints });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints', error: error.message });
  }
});

// Get assigned tasks for maintenance staff
router.get('/assigned-tasks/me', authenticateToken, async (req, res) => {
  try {
    const maintenanceStaffId = req.user.id;
    const tasks = await dbAll(
      `SELECT c.*, u.full_name, u.email
       FROM complaints c
       LEFT JOIN users u ON c.tenant_id = u.id
       LEFT JOIN maintenance_task_archive mta
         ON mta.complaint_id = c.id AND mta.maintenance_staff_id = ?
       WHERE c.assigned_to = ?
         AND mta.id IS NULL
       ORDER BY c.priority DESC, c.created_at DESC`,
      [maintenanceStaffId, maintenanceStaffId]
    );
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Error fetching assigned tasks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assigned tasks', error: error.message });
  }
});

// Get archived task history for maintenance staff
router.get('/assigned-tasks/history/me', authenticateToken, async (req, res) => {
  try {
    const maintenanceStaffId = req.user.id;
    const tasks = await dbAll(
      `SELECT c.*, u.full_name, u.email, mta.archived_at
       FROM maintenance_task_archive mta
       JOIN complaints c ON c.id = mta.complaint_id
       LEFT JOIN users u ON c.tenant_id = u.id
       WHERE mta.maintenance_staff_id = ?
       ORDER BY datetime(mta.archived_at) DESC`,
      [maintenanceStaffId]
    );
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Error fetching archived tasks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch archived tasks', error: error.message });
  }
});

// Archive completed tasks for maintenance staff
router.post('/assigned-tasks/archive', authenticateToken, async (req, res) => {
  try {
    const maintenanceStaffId = req.user.id;
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ success: false, message: 'taskIds is required' });
    }

    let archivedCount = 0;
    for (const rawTaskId of taskIds) {
      const taskId = parseInt(rawTaskId, 10);
      if (!Number.isInteger(taskId)) {
        continue;
      }

      const complaint = await dbGet(
        'SELECT id, assigned_to, status FROM complaints WHERE id = ?',
        [taskId]
      );

      if (!complaint) {
        continue;
      }

      const isAssignedToStaff = complaint.assigned_to === maintenanceStaffId;
      const isCompleted = ['resolved', 'completed', 'closed'].includes(complaint.status);
      if (!isAssignedToStaff || !isCompleted) {
        continue;
      }

      await dbRun(
        `INSERT INTO maintenance_task_archive (maintenance_staff_id, complaint_id, archived_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(maintenance_staff_id, complaint_id)
         DO UPDATE SET archived_at = datetime('now')`,
        [maintenanceStaffId, taskId]
      );
      archivedCount += 1;
    }

    res.json({ success: true, message: 'Tasks archived successfully', data: { archivedCount } });
  } catch (error) {
    console.error('Error archiving tasks:', error);
    res.status(500).json({ success: false, message: 'Failed to archive tasks', error: error.message });
  }
});

// Restore archived tasks for maintenance staff
router.post('/assigned-tasks/restore', authenticateToken, async (req, res) => {
  try {
    const maintenanceStaffId = req.user.id;
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ success: false, message: 'taskIds is required' });
    }

    let restoredCount = 0;
    for (const rawTaskId of taskIds) {
      const taskId = parseInt(rawTaskId, 10);
      if (!Number.isInteger(taskId)) {
        continue;
      }

      const result = await dbRun(
        'DELETE FROM maintenance_task_archive WHERE maintenance_staff_id = ? AND complaint_id = ?',
        [maintenanceStaffId, taskId]
      );

      if (result.changes > 0) {
        restoredCount += 1;
      }
    }

    res.json({ success: true, message: 'Tasks restored successfully', data: { restoredCount } });
  } catch (error) {
    console.error('Error restoring tasks:', error);
    res.status(500).json({ success: false, message: 'Failed to restore tasks', error: error.message });
  }
});

// Get all complaints (Admin)
router.get('/all', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const complaints = await dbAll(
      'SELECT c.*, u.full_name, u.email FROM complaints c LEFT JOIN users u ON c.tenant_id = u.id ORDER BY c.priority DESC, c.created_at DESC'
    );
    res.json({ success: true, data: complaints });
  } catch (error) {
    console.error('Error fetching all complaints:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints', error: error.message });
  }
});

// Update complaint status (Admin or assigned Maintenance Staff)
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!['submitted', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Get the complaint to check who it's assigned to
    const complaint = await dbGet('SELECT * FROM complaints WHERE id = ?', [id]);
    console.log(`[UPDATE] User ${userId} (${userRole}) updating complaint ${id}. Complaint assigned_to: ${complaint?.assigned_to}`);
    
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Authorization: Admin can update any, maintenance staff can only update their own assigned tasks
    if (userRole === 'admin') {
      // Admin can update any complaint
      console.log(`[UPDATE] Admin ${userId} authorized to update complaint ${id}`);
    } else if (userRole === 'maintenance_staff') {
      // Maintenance staff can only update tasks assigned to them
      if (complaint.assigned_to !== userId) {
        console.log(`[UPDATE] Maintenance staff ${userId} NOT authorized - task assigned to ${complaint.assigned_to}`);
        return res.status(403).json({ success: false, message: 'Not authorized to update this complaint' });
      }
      console.log(`[UPDATE] Maintenance staff ${userId} authorized to update complaint ${id}`);
    } else {
      // Other roles cannot update
      return res.status(403).json({ success: false, message: 'Not authorized to update complaints' });
    }

    await dbRun(
      'UPDATE complaints SET status = ? WHERE id = ?',
      [status, id]
    );

    // Notify tenant on status change
    await createNotification(
      complaint.tenant_id,
      `Complaint "${complaint.title}" status updated to ${status.replace('_', ' ')}.`
    );

    console.log(`[UPDATE] Successfully updated complaint ${id} to status ${status}`);
    res.json({ success: true, message: 'Complaint status updated' });
  } catch (error) {
    console.error('Error updating complaint:', error);
    res.status(500).json({ success: false, message: 'Failed to update complaint', error: error.message });
  }
});

// Assign complaint to maintenance staff (Admin)
router.patch('/:id/assign', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({ success: false, message: 'Please select maintenance staff' });
    }

    console.log(`[ASSIGN] Admin assigning complaint ${id} to staff ${assignedTo}`);
    
    await dbRun(
      'UPDATE complaints SET assigned_to = ? WHERE id = ?',
      [assignedTo, id]
    );

    const complaint = await dbGet('SELECT title, tenant_id FROM complaints WHERE id = ?', [id]);

    // Notify assigned maintenance staff
    await createNotification(
      assignedTo,
      `You were assigned a complaint: ${complaint?.title || `#${id}`}`
    );

    // Notify tenant of assignment
    if (complaint?.tenant_id) {
      await createNotification(
        complaint.tenant_id,
        `Your complaint "${complaint.title}" has been assigned to maintenance staff.`
      );
    }

    console.log(`[ASSIGN] Successfully assigned complaint ${id} to staff ${assignedTo}`);
    res.json({ success: true, message: 'Complaint assigned to maintenance staff' });
  } catch (error) {
    console.error('Error assigning complaint:', error);
    res.status(500).json({ success: false, message: 'Failed to assign complaint', error: error.message });
  }
});

// Download complaint attachment
router.get('/:id/attachment/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get the complaint
    const complaint = await dbGet('SELECT * FROM complaints WHERE id = ?', [id]);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Authorization check: admin, any maintenance staff, or the tenant who filed it
    if (userRole !== 'admin' && userRole !== 'maintenance_staff' && complaint.tenant_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to download this attachment' });
    }

    if (!complaint.attachment_filename || !complaint.attachment_path) {
      return res.status(404).json({ success: false, message: 'No attachment found for this complaint' });
    }

    const filePath = path.join(__dirname, `../uploads/complaints/${complaint.attachment_filename}`);

    // Security check: ensure file exists and is within the uploads directory
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Attachment file not found' });
    }

    // Verify the file is within the uploads directory
    const realPath = fs.realpathSync(filePath);
    const uploadsDir = fs.realpathSync(path.join(__dirname, '../uploads/complaints'));
    if (!realPath.startsWith(uploadsDir)) {
      return res.status(403).json({ success: false, message: 'Invalid file path' });
    }

    console.log(`[DOWNLOAD] User ${userId} downloading attachment from complaint ${id}`);

    // Set response headers
    res.setHeader('Content-Disposition', `attachment; filename="${complaint.attachment_filename}"`);
    res.setHeader('Content-Type', complaint.attachment_type || 'application/octet-stream');
    res.setHeader('Content-Length', complaint.attachment_size);

    // Stream the file
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ success: false, message: 'Failed to download attachment', error: error.message });
  }
});

// View complaint attachment (for images/PDFs in browser)
router.get('/:id/attachment/view', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get the complaint
    const complaint = await dbGet('SELECT * FROM complaints WHERE id = ?', [id]);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Authorization check: admin, any maintenance staff, or the tenant who filed it
    if (userRole !== 'admin' && userRole !== 'maintenance_staff' && complaint.tenant_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this attachment' });
    }

    if (!complaint.attachment_filename || !complaint.attachment_path) {
      return res.status(404).json({ success: false, message: 'No attachment found for this complaint' });
    }

    const filePath = path.join(__dirname, `../uploads/complaints/${complaint.attachment_filename}`);

    // Security check: ensure file exists and is within the uploads directory
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Attachment file not found' });
    }

    // Verify the file is within the uploads directory
    const realPath = fs.realpathSync(filePath);
    const uploadsDir = fs.realpathSync(path.join(__dirname, '../uploads/complaints'));
    if (!realPath.startsWith(uploadsDir)) {
      return res.status(403).json({ success: false, message: 'Invalid file path' });
    }

    console.log(`[VIEW] User ${userId} viewing attachment from complaint ${id}`);

    res.setHeader('Content-Type', complaint.attachment_type || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Error viewing attachment:', error);
    res.status(500).json({ success: false, message: 'Failed to view attachment', error: error.message });
  }
});

// AI part recognition from uploaded cropped image (Maintenance/Admin)
router.post('/ai/recognize', authenticateToken, memoryUpload.single('image'), async (req, res) => {
  try {
    const userRole = req.user.role;
    if (userRole !== 'admin' && userRole !== 'maintenance_staff') {
      return res.status(403).json({ success: false, message: 'Not authorized for AI recognition' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Image file is required' });
    }

    let detections = [];

    // Try Grounding DINO first for better part-focused detection.
    try {
      const gdResponse = await callVisionModel({
        model: 'IDEA-Research/grounding-dino-base',
        imageBuffer: req.file.buffer,
        imageType: req.file.mimetype,
        payload: {
          inputs: {
            image: req.file.buffer.toString('base64'),
            text_queries: PART_QUERIES,
          },
        },
      });

      const gdRaw = Array.isArray(gdResponse.data) ? gdResponse.data : [];
      detections = gdRaw
        .map((item) => ({
          label: item.label || item.text || 'object',
          confidence: Math.round((item.score || item.confidence || 0) * 100),
          score: item.score || item.confidence || 0,
          model: 'hf-grounding-dino',
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    } catch (gdError) {
      console.warn('Grounding DINO failed, falling back to DETR:', gdError.response?.status, gdError.message);
    }

    // Fallback to DETR if Grounding DINO is unavailable or returned nothing.
    if (!detections.length) {
      const detrResponse = await callVisionModel({
        model: 'facebook/detr-resnet-50',
        imageBuffer: req.file.buffer,
        imageType: req.file.mimetype,
      });

      const detrRaw = Array.isArray(detrResponse.data) ? detrResponse.data : [];
      detections = detrRaw
        .map((item) => ({
          label: item.label,
          confidence: Math.round((item.score || 0) * 100),
          score: item.score || 0,
          model: 'hf-detr',
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    }

    return res.json({ success: true, detections });
  } catch (error) {
    console.error('AI recognition error:', error.response?.status, error.response?.data || error.message);
    const fallbackDetections = buildLocalDetections(req.file);
    return res.json({
      success: true,
      detections: fallbackDetections,
      fallback: true,
      message: 'External AI unavailable, local fallback used.',
      hints: [
        'Capture a closer photo of the damaged part for higher confidence.',
        'Take photo in good lighting and avoid blurry images.',
        'Use a cropped image focused on one part only.'
      ],
    });
  }
});

module.exports = router;
