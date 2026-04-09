const { sendEmailViaPhpMailer } = require('./phpMailerBridge');

const appName = 'JNL Apartment Management';

const adminAlertEmail = () => process.env.EMAIL_ALERT_TO || process.env.EMAIL_USER || 'jnlapartmentmanagement@gmail.com';

const sendPasswordResetEmail = async ({ toEmail, fullName, resetUrl, expiresMinutes = 30 }) => {
  const safeName = fullName || 'Tenant';
  const subject = `${appName}: Password Reset Request`;
  const text = [
    `Hello ${safeName},`,
    '',
    'We received a request to reset your password.',
    `Reset link (valid for ${expiresMinutes} minutes): ${resetUrl}`,
    '',
    'If you did not request this reset, you can ignore this message.'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">Password Reset Request</h2>
      <p>Hello ${safeName},</p>
      <p>We received a request to reset your password.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">
          Reset Password
        </a>
      </p>
      <p>This link is valid for <strong>${expiresMinutes} minutes</strong>.</p>
      <p>If you did not request this reset, you can ignore this email.</p>
    </div>
  `;

  return sendEmailViaPhpMailer({ to: toEmail, subject, html, text });
};

const sendTenantWelcomeEmail = async ({ toEmail, fullName, unitNumber }) => {
  const subject = `${appName}: Welcome to JNL Apartments`;
  const text = [
    `Hello ${fullName || 'Tenant'},`,
    '',
    'Your tenant account has been created successfully.',
    unitNumber ? `Assigned Unit: ${unitNumber}` : null,
    '',
    'You can now sign in to your tenant portal.'
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">Welcome to JNL Apartments</h2>
      <p>Hello ${fullName || 'Tenant'},</p>
      <p>Your tenant account has been created successfully.</p>
      ${unitNumber ? `<p><strong>Assigned Unit:</strong> ${unitNumber}</p>` : ''}
      <p>You can now sign in to your tenant portal.</p>
    </div>
  `;

  return sendEmailViaPhpMailer({ to: toEmail, subject, html, text });
};

const sendTenantActivationEmail = async ({ toEmail, fullName, unitNumber, activationUrl, expiresMinutes = 2880 }) => {
  const safeName = fullName || 'Tenant';
  const expiryLabel = expiresMinutes >= 1440
    ? `${Math.round(expiresMinutes / 1440)} day(s)`
    : `${expiresMinutes} minute(s)`;
  const subject = `${appName}: Welcome to JNL Apartments`;
  const text = [
    `Hello ${safeName},`,
    '',
    'Welcome to JNL Apartments. Your tenant account is ready for activation.',
    unitNumber ? `Assigned Unit: ${unitNumber}` : null,
    '',
    `Activate your account and set your password here: ${activationUrl}`,
    `This secure link expires in ${expiryLabel}.`,
    '',
    'For security, your password is never generated or shared by admin. Please create your own password using the link above.'
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">Welcome to JNL Apartments</h2>
      <p>Hello ${safeName},</p>
      <p>Your tenant account has been created and is ready for activation.</p>
      ${unitNumber ? `<p><strong>Assigned Unit:</strong> ${unitNumber}</p>` : ''}
      <p>
        <a href="${activationUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">
          Activate Account
        </a>
      </p>
      <p>This secure activation link is valid for <strong>${expiryLabel}</strong>.</p>
      <p>For security, your password is never generated or shared by admin. Please use this link to create your own password.</p>
    </div>
  `;

  return sendEmailViaPhpMailer({ to: toEmail, subject, html, text });
};

const sendNewTenantAlertToAdmin = async ({ tenantName, tenantEmail, unitNumber, createdBy }) => {
  const recipient = adminAlertEmail();
  const actor = createdBy || 'Self Registration';
  const subject = `${appName}: New Tenant Registration Alert`;
  const text = [
    'New tenant registration detected.',
    `Name: ${tenantName || 'N/A'}`,
    `Email: ${tenantEmail || 'N/A'}`,
    `Unit: ${unitNumber || 'N/A'}`,
    `Created By: ${actor}`
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">New Tenant Registration Alert</h2>
      <p><strong>Name:</strong> ${tenantName || 'N/A'}</p>
      <p><strong>Email:</strong> ${tenantEmail || 'N/A'}</p>
      <p><strong>Unit:</strong> ${unitNumber || 'N/A'}</p>
      <p><strong>Created By:</strong> ${actor}</p>
    </div>
  `;

  return sendEmailViaPhpMailer({ to: recipient, subject, html, text });
};

const sendAdminPasswordResetNotice = async ({ toEmail, fullName, newPassword, roleLabel }) => {
  const subject = `${appName}: Password Reset Notice`;
  const text = [
    `Hello ${fullName || 'User'},`,
    '',
    `Your ${roleLabel || 'account'} password has been reset by an administrator.`,
    `Temporary Password: ${newPassword}`,
    '',
    'Please sign in and change your password immediately.'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">Password Reset Notice</h2>
      <p>Hello ${fullName || 'User'},</p>
      <p>Your ${roleLabel || 'account'} password has been reset by an administrator.</p>
      <p><strong>Temporary Password:</strong> ${newPassword}</p>
      <p>Please sign in and change your password immediately.</p>
    </div>
  `;

  return sendEmailViaPhpMailer({ to: toEmail, subject, html, text });
};

const sendAppointmentRequestEmails = async ({ fullName, email, preferredDate, building }) => {
  const adminSubject = `${appName}: New Appointment Request`;
  const adminText = [
    'A new appointment request has been submitted from the landing page.',
    `Name: ${fullName}`,
    `Email: ${email}`,
    `Preferred Date: ${preferredDate}`,
    `Building: ${building}`
  ].join('\n');

  const adminHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">New Appointment Request</h2>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Preferred Date:</strong> ${preferredDate}</p>
      <p><strong>Building:</strong> ${building}</p>
    </div>
  `;

  const userSubject = `${appName}: Appointment Request Received`;
  const userText = [
    `Hello ${fullName},`,
    '',
    'We received your appointment request.',
    `Preferred Date: ${preferredDate}`,
    `Building: ${building}`,
    '',
    'Our team will contact you shortly to confirm your schedule.'
  ].join('\n');

  const userHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">Appointment Request Received</h2>
      <p>Hello ${fullName},</p>
      <p>We received your appointment request.</p>
      <p><strong>Preferred Date:</strong> ${preferredDate}</p>
      <p><strong>Building:</strong> ${building}</p>
      <p>Our team will contact you shortly to confirm your schedule.</p>
    </div>
  `;

  const results = await Promise.allSettled([
    sendEmailViaPhpMailer({ to: adminAlertEmail(), subject: adminSubject, html: adminHtml, text: adminText }),
    sendEmailViaPhpMailer({ to: email, subject: userSubject, html: userHtml, text: userText })
  ]);

  return {
    adminSent: results[0].status === 'fulfilled',
    userSent: results[1].status === 'fulfilled'
  };
};

module.exports = {
  sendPasswordResetEmail,
  sendTenantWelcomeEmail,
  sendTenantActivationEmail,
  sendNewTenantAlertToAdmin,
  sendAdminPasswordResetNotice,
  sendAppointmentRequestEmails
};
