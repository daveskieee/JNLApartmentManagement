import React, { useRef, useState, useEffect } from 'react';

const ImageSelector = ({ imageUrl, onSelection, onCancel, mode = 'recognize' }) => {
  const canvasRef = useRef(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setImage(img);
        drawImage(img);
      };
      img.src = imageUrl;
    }
  }, [imageUrl]);

  const drawImage = (img) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const maxWidth = 600;
    const maxHeight = 400;
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
    const displayWidth = img.width * scale;
    const displayHeight = img.height * scale;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

    // Draw selection rectangle if exists
    if (startPoint && endPoint) {
      const x = Math.min(startPoint.x, endPoint.x);
      const y = Math.min(startPoint.y, endPoint.y);
      const width = Math.abs(endPoint.x - startPoint.x);
      const height = Math.abs(endPoint.y - startPoint.y);

      // Semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 123, 255, 0.3)';
      ctx.fillRect(x, y, width, height);

      // Border
      ctx.strokeStyle = '#007bff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);

      // Label
      ctx.fillStyle = '#007bff';
      ctx.font = '14px Arial';
      ctx.fillText('Selected Area', x + 5, y + 20);
    }
  };

  useEffect(() => {
    if (image) {
      drawImage(image);
    }
  }, [startPoint, endPoint, image]);

  const getMousePos = (canvas, e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const pos = getMousePos(canvas, e);
    setIsSelecting(true);
    setStartPoint(pos);
    setEndPoint(pos);
  };

  const handleMouseMove = (e) => {
    if (!isSelecting) return;
    const canvas = canvasRef.current;
    const pos = getMousePos(canvas, e);
    setEndPoint(pos);
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const handleConfirmSelection = () => {
    if (!startPoint || !endPoint || !image) return;

    const canvas = canvasRef.current;
    const scaleX = image.width / canvas.width;
    const scaleY = image.height / canvas.height;

    const x = Math.min(startPoint.x, endPoint.x) * scaleX;
    const y = Math.min(startPoint.y, endPoint.y) * scaleY;
    const width = Math.abs(endPoint.x - startPoint.x) * scaleX;
    const height = Math.abs(endPoint.y - startPoint.y) * scaleY;

    if (width < 8 || height < 8) return;

    // Create cropped canvas
    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d');
    croppedCanvas.width = width;
    croppedCanvas.height = height;

    croppedCtx.drawImage(image, x, y, width, height, 0, 0, width, height);

    // Convert to blob URL
    croppedCanvas.toBlob((blob) => {
      if (!blob) return;
      const croppedUrl = URL.createObjectURL(blob);
      onSelection(croppedUrl, { x, y, width, height }, blob);
    }, 'image/png');
  };

  const handleCancel = () => {
    setStartPoint(null);
    setEndPoint(null);
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Select Part to Analyze</h3>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          <p>📍 Click and drag to select the specific part you want to identify</p>
          <p>🎯 Make sure the part is clearly visible in your selection</p>
        </div>

        <div className="flex justify-center mb-4">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="border border-gray-300 cursor-crosshair max-w-full"
            style={{ maxWidth: '600px', maxHeight: '400px' }}
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSelection}
            disabled={!startPoint || !endPoint}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mode === 'lens' ? 'Use Selection for Google Lens' : 'Analyze Selected Area'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageSelector;