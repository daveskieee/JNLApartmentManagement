import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiArrowLeft } from 'react-icons/fi';
import toast from 'react-hot-toast';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [billId, setBillId] = useState(null);
  const [paymentId, setPaymentId] = useState(null);

  useEffect(() => {
    // Simply extract the query parameters - no API calls needed
    const bill = searchParams.get('billId');
    const payId = searchParams.get('paymentId');
    const status = searchParams.get('status');

    if (status === 'success' && bill && payId) {
      setBillId(bill);
      setPaymentId(payId);
      toast.success('Payment completed successfully!');
    } else if (status === 'submitted' && bill) {
      setBillId(bill);
      toast.success('Payment submitted. Awaiting confirmation.');
    } else {
      toast.error('Payment status unknown');
    }
  }, [searchParams]);

  const handleBackToPayments = () => {
    navigate('/tenant/payments');
  };

  const handleDashboard = () => {
    navigate('/tenant');
  };

  return (
    <div className="min-h-screen page-wrapper p-8">
      <div className="max-w-md mx-auto">
        <div className="card-base p-8 text-center">
          <FiCheckCircle className="text-green-600 mx-auto mb-4" size={64} />
          
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Payment Successful!
          </h1>
          
          <p className="text-gray-600 mb-6">
            Your PayPal payment has been processed and confirmed.
          </p>

          {billId && paymentId && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <div className="mb-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Bill ID</p>
                <p className="text-lg font-semibold text-gray-800">{billId}</p>
              </div>
              <div className="mb-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Transaction ID</p>
                <p className="text-sm font-mono text-gray-800 break-all">{paymentId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                <p className="text-lg font-semibold text-green-600 uppercase">Completed</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleBackToPayments}
              className="w-full brand-button text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 hover:opacity-95"
            >
              <FiArrowLeft size={20} />
              Back to Payments
            </button>
            
            <button
              onClick={handleDashboard}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg transition"
            >
              Go to Dashboard
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-6">
            A confirmation email will be sent to your registered email address.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
