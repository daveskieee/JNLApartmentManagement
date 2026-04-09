/**
 * Image Recognition Utility
 * Stable model: TensorFlow.js COCO-SSD (browser-side, free)
 * Helps maintenance staff identify replacement parts
 */

// Global declarations for ESLint (loaded from CDN)
/* global window */

let model = null;

/**
 * Load the COCO-SSD model (runs locally, no API key needed)
 */
export const loadCocoModel = async () => {
  try {
    if (model) {
      console.log('Model already loaded');
      return model;
    }

    console.log('Loading COCO-SSD model...');
    await loadScripts();
    if (!window.cocoSsd || typeof window.cocoSsd.load !== 'function') {
      throw new Error('COCO-SSD did not load correctly');
    }

    model = await window.cocoSsd.load();
    console.log('Model loaded successfully');
    return model;
  } catch (error) {
    console.error('Error loading image recognition model:', error);
    throw error;
  }
};

/**
 * Load required TensorFlow.js and COCO-SSD scripts
 */
const loadScripts = async () => {
  if (window.tf && window.cocoSsd) {
    return;
  }

  const loadExternalScript = (src, id) => {
    return new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
          return;
        }

        const onLoad = () => {
          existing.dataset.loaded = 'true';
          existing.removeEventListener('load', onLoad);
          existing.removeEventListener('error', onError);
          resolve();
        };
        const onError = () => {
          existing.removeEventListener('load', onLoad);
          existing.removeEventListener('error', onError);
          reject(new Error(`Failed to load script: ${src}`));
        };

        existing.addEventListener('load', onLoad);
        existing.addEventListener('error', onError);
        return;
      }

      const scriptElement = document.createElement('script');
      scriptElement.src = src;
      scriptElement.id = id;
      scriptElement.async = true;
      scriptElement.onload = () => {
        scriptElement.dataset.loaded = 'true';
        resolve();
      };
      scriptElement.onerror = () => {
        reject(new Error(`Failed to load script: ${src}`));
      };
      document.head.appendChild(scriptElement);
    });
  };

  // tfjs must load before coco-ssd
  await loadExternalScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4', 'tf-script');
  await loadExternalScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2', 'coco-script');
};

/**
 * Detect objects in an image
 * @param {HTMLImageElement | HTMLCanvasElement} imageElement - The image to analyze
 * @returns {Promise<Array>} - Array of detected objects with labels and confidence
 */
export const detectObjects = async (imageElement) => {
  try {
    // 1) Preferred: backend API model (Hugging Face DETR)
    try {
      const blob = await imageElementToBlob(imageElement);
      const form = new FormData();
      form.append('image', blob, 'selection.png');

      const token = localStorage.getItem('token');
      const apiResponse = await fetch('/api/complaint/ai/recognize', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });

      if (apiResponse.ok) {
        const payload = await apiResponse.json();
        if (payload?.success && Array.isArray(payload.detections)) {
          return payload.detections;
        }
      } else {
        const text = await apiResponse.text();
        console.warn('Backend AI recognition failed, using local fallback:', text);
      }
    } catch (apiError) {
      console.warn('Backend AI recognition unavailable, using local fallback:', apiError.message);
    }

    // 2) Fallback: local COCO-SSD
    if (!model) {
      model = await loadCocoModel();
    }

    const infer =
      typeof model.detect === 'function'
        ? model.detect.bind(model)
        : typeof model.estimateObjects === 'function'
          ? model.estimateObjects.bind(model)
          : null;

    if (!infer) {
      throw new Error('Loaded model has no supported detection method');
    }

    const predictions = await infer(imageElement);

    const detections = predictions
      .map(pred => ({
        label: pred.class,
        confidence: Math.round(pred.score * 100),
        score: pred.score,
        model: 'coco-ssd',
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    console.log('Detected objects:', detections);
    return detections;
  } catch (error) {
    console.error('Error detecting objects:', error);
    throw error;
  }
};

const imageElementToBlob = async (imageElement) => {
  const canvas = document.createElement('canvas');
  const width = imageElement.naturalWidth || imageElement.videoWidth || imageElement.width;
  const height = imageElement.naturalHeight || imageElement.videoHeight || imageElement.height;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageElement, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to convert image for AI request'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
};

/**
 * Generate Google Lens search URL for an image
 * @param {string} imageUrl - URL of the image to search
 * @returns {string} - Google Lens search URL
 */
export const generateGoogleLensUrl = (imageUrl) => {
  const encodedUrl = encodeURIComponent(imageUrl);
  return `https://lens.google.com/uploadbyurl?url=${encodedUrl}`;
};

/**
 * Generate Google Images search URL for a query
 * @param {string} query - Search query
 * @returns {string} - Google Images search URL
 */
export const generateGoogleImagesSearchUrl = (query) => {
  const encodedQuery = encodeURIComponent(query);
  return `https://www.google.com/search?q=${encodedQuery}&tbm=isch`;
};

/**
 * Generate shopping search URL (useful for replacement parts)
 * @param {string} query - Product/part name
 * @returns {string} - Google Shopping search URL
 */
export const generateShoppingSearchUrl = (query) => {
  const encodedQuery = encodeURIComponent(query);
  return `https://www.google.com/search?q=${encodedQuery}&tbm=shop`;
};

/**
 * Open Google Lens in a new window
 * @param {string} imageUrl - URL of the image to search
 */
export const openGoogleLens = (imageUrl) => {
  const isPublicHttpImage = typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl);

  // Google Lens upload-by-url cannot fetch blob/data URLs from local/private app sessions.
  if (isPublicHttpImage) {
    const url = generateGoogleLensUrl(imageUrl);
    window.open(url, '_blank', 'width=1000,height=800');
    return;
  }

  window.open('https://lens.google.com/', '_blank', 'width=1000,height=800');
};

/**
 * Open Google Images search in a new window
 * @param {string} query - Search query
 */
export const openGoogleImagesSearch = (query) => {
  const url = generateGoogleImagesSearchUrl(query);
  window.open(url, '_blank', 'width=800,height=600');
};

/**
 * Open shopping search in a new window
 * @param {string} query - Product/part name
 */
export const openShoppingSearch = (query) => {
  const url = generateShoppingSearchUrl(query);
  window.open(url, '_blank', 'width=800,height=600');
};

/**
 * Analyze image and return detections with search options
 * @param {HTMLImageElement | HTMLCanvasElement} imageElement
 * @param {string} imageUrl - URL for Google search functionality
 * @returns {Promise<Object>} - Analysis results with detections and URLs
 */
export const analyzeImage = async (imageElement, imageUrl) => {
  try {
    const detections = await detectObjects(imageElement);
    
    const results = {
      detections,
      googleLensUrl: generateGoogleLensUrl(imageUrl),
      primaryObject: detections.length > 0 ? detections[0].label : null,
      primaryObjectSearchUrls: detections.length > 0 ? {
        googleImages: generateGoogleImagesSearchUrl(detections[0].label),
        shopping: generateShoppingSearchUrl(detections[0].label)
      } : {}
    };

    return results;
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
};
