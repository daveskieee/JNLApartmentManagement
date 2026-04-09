<?php
$tests = array(
  array('label' => 'PLAIN587', 'target' => 'smtp.gmail.com', 'port' => 587),
  array('label' => 'SSL465', 'target' => 'ssl://smtp.gmail.com', 'port' => 465),
  array('label' => 'TLS587', 'target' => 'tls://smtp.gmail.com', 'port' => 587),
);

foreach ($tests as $test) {
  $errno = 0;
  $errstr = '';
  $fp = @fsockopen($test['target'], $test['port'], $errno, $errstr, 10);
  echo $test['label'] . ' errno=' . $errno . ' err=' . $errstr . PHP_EOL;
  if ($fp) {
    fclose($fp);
  }
}
