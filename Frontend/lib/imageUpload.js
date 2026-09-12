function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

function estimateDataUrlSizeBytes(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  return Math.floor((base64.length * 3) / 4);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to process image file."));
    };
    image.src = objectUrl;
  });
}

export async function compressImageFileToDataUrl(
  file,
  { maxDimension = 960, maxBytes = 900 * 1024, quality = 0.82 } = {}
) {
  if (!(file instanceof File) || file.size <= 0) {
    return "";
  }

  if (!String(file.type || "").startsWith("image/")) {
    return readFileAsDataUrl(file);
  }

  const image = await loadImage(file);
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  let width = Math.max(1, Math.round(image.width * scale));
  let height = Math.max(1, Math.round(image.height * scale));
  let currentQuality = quality;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to process image file.");
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", currentQuality);

    if (estimateDataUrlSizeBytes(dataUrl) <= maxBytes) {
      return dataUrl;
    }

    if (currentQuality > 0.55) {
      currentQuality = Math.max(0.55, currentQuality - 0.08);
      continue;
    }

    width = Math.max(1, Math.round(width * 0.85));
    height = Math.max(1, Math.round(height * 0.85));
  }

  return canvas.toDataURL("image/jpeg", 0.55);
}
