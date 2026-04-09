<?php
// Minimal JSON-in/JSON-out mail sender using bundled PHPMailer-FE class.
header('Content-Type: application/json');

function respond($statusCode, $payload) {
  http_response_code($statusCode);
  echo json_encode($payload);
  exit;
}

$rawInput = stream_get_contents(STDIN);
if ($rawInput === false || trim($rawInput) === '') {
  respond(400, array('success' => false, 'message' => 'Missing payload'));
}

$payload = json_decode($rawInput, true);
if (!is_array($payload)) {
  respond(400, array('success' => false, 'message' => 'Invalid JSON payload'));
}

$to = isset($payload['to']) ? trim($payload['to']) : '';
$subject = isset($payload['subject']) ? trim($payload['subject']) : '';
$html = isset($payload['html']) ? (string) $payload['html'] : '';
$text = isset($payload['text']) ? (string) $payload['text'] : '';

if ($to === '' || $subject === '' || ($html === '' && $text === '')) {
  respond(400, array('success' => false, 'message' => 'to, subject and html/text are required'));
}

$mailerPath = __DIR__ . '/../PHPMailer-FE_v4.11/_lib/class.phpmailer.php';
if (!file_exists($mailerPath)) {
  respond(500, array('success' => false, 'message' => 'PHPMailer class not found', 'path' => $mailerPath));
}

require_once $mailerPath;

$mail = new PHPMailer();
$mail->CharSet = 'UTF-8';
$mail->WordWrap = 78;
$mail->PluginDir = __DIR__ . '/../PHPMailer-FE_v4.11/_lib/';

$smtpHost = getenv('EMAIL_HOST');
$smtpPort = getenv('EMAIL_PORT');
$smtpUser = getenv('EMAIL_USER');
$smtpPass = getenv('EMAIL_PASSWORD');
$smtpSecure = getenv('EMAIL_SECURE');
$smtpDebug = getenv('EMAIL_SMTP_DEBUG');

if ($smtpDebug !== false && $smtpDebug !== '') {
  $mail->SMTPDebug = (int)$smtpDebug;
}

$fromEmail = getenv('EMAIL_FROM');
$fromName = getenv('EMAIL_FROM_NAME');
$replyTo = getenv('EMAIL_REPLY_TO');

if ($fromEmail === false || $fromEmail === '') {
  $fromEmail = $smtpUser;
}
if ($fromName === false || $fromName === '') {
  $fromName = 'JNL Apartment Management';
}

if ($smtpHost !== false && $smtpHost !== '') {
  $mail->IsSMTP();
  $mail->Host = $smtpHost;
  $mail->Port = ($smtpPort !== false && $smtpPort !== '') ? (int)$smtpPort : 587;
  if ($smtpSecure !== false && $smtpSecure !== '') {
    $mail->SMTPSecure = $smtpSecure;
  }

  if ($smtpUser !== false && $smtpUser !== '' && $smtpPass !== false && $smtpPass !== '') {
    $mail->SMTPAuth = true;
    $mail->Username = $smtpUser;
    $mail->Password = $smtpPass;
  }
}

$mail->From = $fromEmail;
$mail->FromName = $fromName;
$mail->Sender = $fromEmail;
if ($replyTo !== false && $replyTo !== '') {
  $mail->AddReplyTo($replyTo, $fromName);
} else {
  $mail->AddReplyTo($fromEmail, $fromName);
}

$mail->AddAddress($to);
$mail->Subject = $subject;

if ($html !== '') {
  $mail->IsHTML(true);
  $mail->Body = $html;
  $mail->AltBody = ($text !== '') ? $text : strip_tags($html);
} else {
  $mail->IsHTML(false);
  $mail->Body = $text;
}

if (!$mail->Send()) {
  respond(500, array('success' => false, 'message' => $mail->ErrorInfo));
}

respond(200, array('success' => true, 'message' => 'Mail sent'));
