const path = require('path');
const { spawn } = require('child_process');
const nodemailer = require('nodemailer');

const phpScriptPath = path.join(__dirname, '..', 'php', 'send_mail.php');

const runPhpMailScript = (payload) => {
  return new Promise((resolve, reject) => {
    const phpProcess = spawn('php', [phpScriptPath], {
      cwd: path.join(__dirname, '..'),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    phpProcess.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    phpProcess.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    phpProcess.on('error', (error) => {
      reject(error);
    });

    phpProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`PHP mailer failed with code ${code}: ${stderr || stdout || 'Unknown error'}`));
      }

      try {
        const parsed = JSON.parse(stdout || '{}');
        if (!parsed.success) {
          return reject(new Error(parsed.message || 'PHPMailer returned unsuccessful response'));
        }
        return resolve(parsed);
      } catch (parseError) {
        return reject(new Error(`Invalid PHPMailer response: ${stdout}`));
      }
    });

    phpProcess.stdin.write(JSON.stringify(payload));
    phpProcess.stdin.end();
  });
};

const sendWithNodeMailer = async ({ to, subject, html, text }) => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(process.env.EMAIL_PORT || 587);
  const secure = String(process.env.EMAIL_SECURE || '').toLowerCase() === 'ssl' || port === 465;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!user || !pass) {
    throw new Error('Nodemailer fallback missing EMAIL_USER/EMAIL_PASSWORD');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  const from = process.env.EMAIL_FROM || user;
  const fromName = process.env.EMAIL_FROM_NAME || 'JNL Apartment Management';
  const replyTo = process.env.EMAIL_REPLY_TO || from;

  await transporter.sendMail({
    from: `${fromName} <${from}>`,
    to,
    replyTo,
    subject,
    html,
    text
  });

  return { success: true, message: 'Mail sent via nodemailer fallback' };
};

const sendEmailViaPhpMailer = async ({ to, subject, html, text }) => {
  if (!to || !subject || (!html && !text)) {
    throw new Error('Invalid mail payload. Required: to, subject, html/text');
  }

  try {
    return await runPhpMailScript({ to, subject, html, text });
  } catch (phpError) {
    console.warn('PHPMailer bridge failed, using nodemailer fallback:', phpError.message);
    return sendWithNodeMailer({ to, subject, html, text });
  }
};

module.exports = {
  sendEmailViaPhpMailer
};
