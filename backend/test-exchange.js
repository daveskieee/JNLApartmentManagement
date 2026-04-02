const exchange = require('./services/exchange');

(async () => {
  try {
    const rate = await exchange.getRate('PHP', 'USD');
    console.log('PHP -> USD rate:', rate);

    const rate2 = await exchange.getRate('USD', 'PHP');
    console.log('USD -> PHP rate:', rate2);

    process.exit(0);
  } catch (err) {
    console.error('Exchange test failed:', err);
    process.exit(1);
  }
})();