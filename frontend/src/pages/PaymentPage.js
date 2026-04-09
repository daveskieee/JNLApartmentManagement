import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertCircle, CreditCard, FileText, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { formatAppDate } from '../utils/dateTime';

// PayPal SDK loader: implementation moved inside component so it can access component state.
// (See the in-component implementation of loadPayPalScript near the top of PaymentPage.)

const PaymentPage = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const defaultCurrency = user?.preferred_currency || user?.currency || 'PHP';
  const [pendingBills, setPendingBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalError, setPaypalError] = useState(null);
  const [paypalButtonsRendered, setPaypalButtonsRendered] = useState(false);
  const [paypalScriptCurrency, setPaypalScriptCurrency] = useState(null);
  const [conversionInfo, setConversionInfo] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: 'bank_transfer',
    referenceNumber: '',
    notes: '',
  });

  // PayPal SDK loader (moved here so we can access state)
  const loadPayPalScript = (currency = 'PHP') => {
    return new Promise((resolve, reject) => {
      const clientId = process.env.REACT_APP_PAYPAL_CLIENT_ID;
      if (!clientId) {
        console.error('❌ Missing REACT_APP_PAYPAL_CLIENT_ID environment variable');
        setPaypalError('PayPal is not configured. Please contact support.');
        reject(new Error('PayPal Client ID is not configured. Please contact support.'));
        return;
      }
      const currencyCode = (currency === 'USD') ? 'USD' : 'PHP';
      const src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currencyCode}`;

      console.log('Loading PayPal SDK with URL:', src.replace(clientId, '[CLIENT_ID]'));

      // If paypal is already loaded and matches desired currency, resolve
      if (window.paypal && paypalScriptCurrency === currencyCode) {
        console.log('✅ PayPal SDK already loaded');
        setPaypalError(null);
        resolve();
        return;
      }

      // Remove any existing PayPal SDK script (to reload with different currency)
      const existing = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (existing) {
        console.log('Removing existing PayPal SDK script');
        existing.remove();
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      
      script.onload = () => {
        console.log('✅ PayPal SDK loaded successfully');
        setPaypalScriptCurrency(currencyCode);
        setPaypalError(null);
        resolve();
      };
      
      script.onerror = (err) => {
        console.error('❌ PayPal SDK failed to load:', {
          url: src.replace(clientId, '[CLIENT_ID]'),
          error: err,
          message: 'Check if Client ID is valid or if there are network/CORS issues'
        });
        setPaypalError('Failed to load PayPal SDK. You can use another payment method or refresh to retry.');
        reject(new Error('Failed to load PayPal SDK. Please refresh the page or try again later.'));
      };
      
      document.body.appendChild(script);
    });
  };

  const formatCurrency = (amount = 0, currency = defaultCurrency) => {
    const code = currency === 'USD' ? 'USD' : 'PHP';
    const locale = code === 'USD' ? 'en-US' : 'en-PH';
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(Number(amount || 0));
    } catch (e) {
      return (code === 'USD' ? '$' : '₱') + (Number(amount || 0).toLocaleString());
    }
  };

  useEffect(() => {
    fetchPendingBills();
    // SDK will be loaded when a bill is selected (see next effect)
  }, []);

  // Load or reload PayPal SDK when a selected bill changes. We always load SDK in USD (we convert non-USD bills on server)
  useEffect(() => {
    if (!process.env.REACT_APP_PAYPAL_CLIENT_ID) return;
    const currencyToLoad = 'USD';
    loadPayPalScript(currencyToLoad)
      .then(() => setPaypalReady(true))
      .catch(err => {
        console.error('Failed to load PayPal SDK:', err);
        setPaypalError('PayPal failed to load. You can use another payment method or refresh to retry.');
        setPaypalReady(false);
      });
  }, [selectedBill]);

  const fetchPendingBills = async () => {
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      const parsedUser = userStr ? JSON.parse(userStr) : null;
      const userId = parsedUser?.id;

      if (!token || !userId) {
        toast.error('Please login first');
        setPendingBills([]);
        setLoading(false);
        return;
      }
      const response = await axios.get(`/api/rent/status/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allBills = response.data?.data || response.data || [];
      const bills = (allBills.filter(b => b.status === 'pending') || []).slice().sort((a,b) => {
        const aDate = new Date(a.due_date || a.created_at || 0).getTime();
        const bDate = new Date(b.due_date || b.created_at || 0).getTime();
        return bDate - aDate;
      });
      setPendingBills(bills);
      if (bills.length > 0) {
        setSelectedBill(bills[0]);
        setFormData(prev => ({
          ...prev,
          amount: bills[0].amount.toString(),
        }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBillSelect = (bill) => {
    setSelectedBill(bill);
    setFormData(prev => ({
      ...prev,
      amount: bill.amount.toString(),
    }));
  };

  // Fetch conversion preview for PayPal (USD) when a bill is selected and it's not USD
  useEffect(() => {
    if (!selectedBill) {
      setConversionInfo(null);
      return;
    }

    console.log('[PAYMENT] Selected bill:', { 
      id: selectedBill.id, 
      amount: selectedBill.amount, 
      currency: selectedBill.currency,
      defaultCurrency 
    });

    const billCurrency = selectedBill.currency || defaultCurrency;
    
    if (billCurrency && billCurrency !== 'USD') {
      console.log('[PAYMENT] Fetching conversion for', billCurrency, 'to USD');
      
      const fetchConv = async () => {
        try {
          const token = localStorage.getItem('token');
          const convertUrl = `/api/payment/convert?amount=${encodeURIComponent(selectedBill.amount)}&from=${encodeURIComponent(billCurrency)}&to=USD`;
          console.log('[PAYMENT] Conversion request:', convertUrl);
          
          const resp = await axios.get(convertUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          console.log('[PAYMENT] Conversion response:', resp.data);
          setConversionInfo(resp.data?.data || null);
        } catch (err) {
          console.error('[PAYMENT] Conversion fetch failed:', {
            message: err.message,
            status: err.response?.status,
            data: err.response?.data
          });
          setConversionInfo(null);
        }
      };
      fetchConv();
    } else {
      console.log('[PAYMENT] Bill is already USD or no currency info, skipping conversion');
      setConversionInfo(null);
    }
  }, [selectedBill, defaultCurrency]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBill) {
      toast.error('Please select a bill');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (amount <= 0 || amount > selectedBill.amount) {
      toast.error('Invalid payment amount');
      return;
    }

    if (!formData.referenceNumber.trim()) {
      toast.error('Reference number is required');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/payment/submit', {
        billId: selectedBill.id,
        amount,
        paymentMethod: formData.paymentMethod,
        referenceNumber: formData.referenceNumber,
        notes: formData.notes,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setShowSuccess(true);
      setTimeout(() => {
        navigate(`/payment/success?billId=${selectedBill.id}&status=submitted`);
      }, 2000);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Payment failed');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayPalPayment = () => {
    if (!selectedBill) {
      toast.error('Please select a bill');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (amount <= 0 || amount > selectedBill.amount) {
      toast.error('Invalid payment amount');
      return;
    }

    // We always use USD for PayPal (server will convert if needed)
    const currencyCode = 'USD';

    // If SDK was loaded with a different currency, reload it and ask user to retry
    if (paypalScriptCurrency && paypalScriptCurrency !== currencyCode) {
      setPaypalButtonsRendered(false);
      setPaypalReady(false);
      setPaypalScriptCurrency(null);
      loadPayPalScript(currencyCode)
        .then(() => {
          setPaypalReady(true);
          toast.success(`PayPal loaded for ${currencyCode}. Please click Pay with PayPal again.`);
        })
        .catch((err) => {
          console.error('Failed to reload PayPal SDK:', err);
          setPaypalError('Failed to load PayPal for this currency. You can use another payment method or refresh to retry.');
          setPaypalReady(false);
        });
      return;
    }

    if (!window.paypal) {
      setPaypalError('PayPal SDK not loaded. Please try again or refresh the page.');
      return;
    }

    const container = document.getElementById('paypal-button-container');
    if (!container) {
      toast.error('PayPal container not found. Please reload the page.');
      return;
    }

    // If buttons already rendered, just scroll into view and inform the user
    if (paypalButtonsRendered) {
      container.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('PayPal button already initialized. Use the PayPal button below.', { icon: 'ℹ️' });
      return;
    }

    // Clear any previous content and mark as rendered
    container.innerHTML = '';
    setPaypalButtonsRendered(true);
    setSubmitting(true);

    try {
      window.paypal.Buttons({
        createOrder: (data, actions) => {
          const paypalAmount = (conversionInfo && conversionInfo.converted) ? conversionInfo.converted : parseFloat(amount).toFixed(2);
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: paypalAmount.toString(),
                currency_code: currencyCode
              },
              description: `Payment for Bill #${selectedBill.id}`
            }]
          });
        },
        onApprove: async (data, actions) => {
          setSubmitting(true);
          try {
            const order = await actions.order.capture();
            const token = localStorage.getItem('token');
            
            await axios.post('/api/payment/submit', {
              billId: selectedBill.id,
              amount,
              paymentMethod: 'paypal',
              referenceNumber: order.id,
              notes: `PayPal transaction: ${order.id}`
            }, {
              headers: { Authorization: `Bearer ${token}` },
            });

            setShowSuccess(true);
            setTimeout(() => {
              navigate(`/payment/success?billId=${selectedBill.id}&paymentId=${order.id}&status=success`);
            }, 2000);
          } catch (error) {
            toast.error(error.response?.data?.message || 'Payment processing failed');
            console.error(error);
          } finally {
            setSubmitting(false);
          }
        },
        onError: (err) => {
          console.error(err);
          setPaypalButtonsRendered(false);
          setSubmitting(false);
          toast.error('PayPal payment failed. Please try again.');
        }
      }).render('#paypal-button-container');
    } catch (err) {
      console.error('PayPal render error:', err);
      setPaypalButtonsRendered(false);
      setSubmitting(false);
      toast.error('Failed to initialize PayPal buttons. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your bills...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-wrapper">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-gradient-to-b from-[#fff6f2] to-[#f8ede8] shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
          <button
            onClick={() => navigate('/tenant')}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--accent-dark)] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
          >
            <ArrowLeft size={18} />
            <span>Back to Dashboard</span>
          </button>
          <div className="mt-5">
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">Make a Payment</h1>
            <p className="mt-2 text-[var(--text-muted)]">Pay your pending bills securely</p>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card-base p-8 text-center max-w-md">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Submitted!</h2>
            <p className="text-gray-600">Your payment has been recorded successfully. Redirecting...</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Pending Bills */}
          <div className="md:col-span-1">
            <div className="sticky top-24 rounded-2xl border border-[var(--border)] bg-white/95 p-6 shadow-[0_14px_32px_rgba(47,31,29,0.08)] backdrop-blur-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
                <FileText size={20} className="text-blue-600" />
                <span>Pending Bills</span>
              </h2>
              
              {pendingBills.length === 0 ? (
                <div className="rounded-xl border border-green-200 bg-green-50/80 p-4 text-center">
                  <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
                  <p className="text-green-800 font-medium">No pending bills</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingBills.map((bill) => (
                    <button
                      key={bill.id}
                      onClick={() => handleBillSelect(bill)}
                      className={`w-full p-4 rounded-lg border-2 transition text-left font-medium ${
                        selectedBill?.id === bill.id
                          ? 'border-blue-500 bg-surface-soft shadow-md'
                          : 'border-gray-200 hover:border-blue-100 hover:bg-surface-soft'
                      }`}
                    >
                      <p className="font-bold text-gray-900">{formatCurrency(bill.amount, bill.currency || defaultCurrency)}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Due: {formatAppDate(bill.due_date)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Payment Form */}
          <div className="md:col-span-2">
            <div className="rounded-2xl border border-[var(--border)] bg-white/95 p-8 shadow-[0_14px_32px_rgba(47,31,29,0.08)] backdrop-blur-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <CreditCard size={20} className="text-blue-600" />
                <span>Payment Details</span>
              </h2>

              {!selectedBill ? (
                <div className="rounded-xl border border-[var(--border)] bg-[#fff7f4] p-6 text-center">
                  <AlertCircle className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                  <p className="text-gray-700 font-medium">Please select a bill to proceed</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Amount ({defaultCurrency === 'USD' ? 'USD' : 'PHP'})
                    </label>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleChange}
                      max={selectedBill.amount}
                      step="0.01"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      required
                    />
                    <p className="text-sm text-gray-600 mt-1">
                      Max amount: {formatCurrency(selectedBill.amount, selectedBill.currency || defaultCurrency)}
                    </p>

                    {conversionInfo && (
                      <p className="text-sm text-gray-700 mt-2">
                        PayPal will charge <span className="font-semibold">{formatCurrency(conversionInfo.converted, 'USD')}</span> (converted from {formatCurrency(selectedBill.amount, selectedBill.currency || defaultCurrency)} at rate <span className="font-semibold">1 {selectedBill.currency} = {conversionInfo.rate}</span>)
                      </p>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Payment Method
                    </label>
                    <select
                      name="paymentMethod"
                      value={formData.paymentMethod}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    >
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="check">Check</option>
                      <option value="cash">Cash</option>
                      <option value="card">Credit/Debit Card</option>
                      <option value="online">Online Payment</option>
                      <option value="paypal">PayPal</option>
                    </select>
                  </div>

                  {/* Reference Number - Only show for non-PayPal methods */}
                  {formData.paymentMethod !== 'paypal' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Reference Number *
                      </label>
                      <input
                        type="text"
                        name="referenceNumber"
                        value={formData.referenceNumber}
                        onChange={handleChange}
                        placeholder="Transaction ID, check number, receipt number..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        required={formData.paymentMethod !== 'paypal'}
                      />
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      placeholder="Add any additional information about this payment..."
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                    />
                  </div>

                  {/* Payment Action Buttons */}
                  {formData.paymentMethod === 'paypal' ? (
                    <>
                      {/* PayPal Info */}
                      <div className="p-4 card-soft border border-blue-200 rounded-lg">
                        <p className="text-sm text-slate-700">
                          <strong>PayPal Payment:</strong> You'll be securely redirected to PayPal to complete your payment. Your transaction will be processed immediately.
                        </p>
                      </div>

                      {/* PayPal Error Message */}
                      {paypalError && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start space-x-3">
                            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-900">{paypalError}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setPaypalError(null);
                                  setFormData(prev => ({ ...prev, paymentMethod: 'bank_transfer' }));
                                }}
                                className="text-xs text-red-600 hover:text-red-700 underline mt-1"
                              >
                                Use another payment method
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* PayPal Button */}
                      {paypalReady && process.env.REACT_APP_PAYPAL_CLIENT_ID && !paypalError ? (
                        <button
                          type="button"
                          onClick={handlePayPalPayment}
                          disabled={submitting || paypalButtonsRendered}
                          className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9.12 11.46h2.73c.33 0 .61.27.61.6 0 .33-.28.6-.61.6H9.12v-1.2zm7.18 0h3.07c.33 0 .61.27.61.6 0 .33-.28.6-.61.6h-3.07v-1.2z" />
                          </svg>
                          <span>{paypalButtonsRendered ? 'PayPal Ready — Use buttons below' : 'Pay with PayPal'}</span>
                        </button>
                      ) : !paypalError && (
                        <div className="p-4 card-soft border border-slate-200 rounded-lg text-center bg-slate-100">
                          <p className="text-sm text-slate-900">Loading PayPal... Please wait.</p>
                        </div>
                      )}

                      {/* Container where PayPal SDK will render buttons */}
                      {paypalReady && !paypalError && <div id="paypal-button-container" className="mt-4" />}
                    </>
                  ) : (
                    <>
                      {/* Submit Button for other payment methods */}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                      >
                        {submitting ? (
                          <>
                            <Loader size={20} className="animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <CreditCard size={20} />
                            <span>Submit Payment</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
