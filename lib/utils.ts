/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFriendlyErrorMessage(error: unknown, context: string): string {
    let rawMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
        rawMessage = error.message;
    } else if (typeof error === 'string') {
        rawMessage = error;
    } else if (error) {
        rawMessage = String(error);
    }

    // Check for specific unsupported MIME type error from Gemini API
    if (rawMessage.includes("Unsupported MIME type")) {
        try {
            // It might be a JSON string like '{"error":{"message":"..."}}'
            const errorJson = JSON.parse(rawMessage);
            const nestedMessage = errorJson?.error?.message;
            if (nestedMessage && nestedMessage.includes("Unsupported MIME type")) {
                const mimeType = nestedMessage.split(': ')[1] || 'unsupported';
                return `File type '${mimeType}' is not supported. Please use a format like PNG, JPEG, or WEBP.`;
            }
        } catch (e) {
            // Not a JSON string, but contains the text. Fallthrough to generic message.
        }
        // Generic fallback for any "Unsupported MIME type" error
        return `Unsupported file format. Please upload an image format like PNG, JPEG, or WEBP.`;
    }
    
    return `${context}. ${rawMessage}`;
}

// Helper to convert image URL to a File object using a canvas to bypass potential CORS issues.
export const urlToFile = (url: string, filename: string): Promise<File> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.setAttribute('crossOrigin', 'anonymous');

        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context.'));
            }
            ctx.drawImage(image, 0, 0);

            canvas.toBlob((blob) => {
                if (!blob) {
                    return reject(new Error('Canvas toBlob failed.'));
                }
                const mimeType = blob.type || 'image/png';
                const file = new File([blob], filename, { type: mimeType });
                resolve(file);
            }, 'image/png');
        };

        image.onerror = () => {
            reject(new Error(
                `Could not load image from URL: ${url}. This is likely a Cross-Origin (CORS) issue. ` +
                `The server hosting the image must respond with an 'Access-Control-Allow-Origin' header.`
            ));
        };

        image.src = url;
    });
};

/**
 * Convertit une URL distante en objet File en utilisant l'API Fetch.
 * C'est la méthode recommandée pour éviter les problèmes CORS liés à Canvas/Image.
 * @param {string} url - L'URL de la ressource.
 * @param {string} filename - Le nom de fichier.
 * @returns {Promise<File>} L'objet File.
 */
export const urlToFileFetch = async (url, filename) => {
    // 1. Récupération de la ressource
    const response = await fetch(url);
    
    // Vérifier si la requête a réussi
    if (!response.ok) {
        throw new Error(`Failed to fetch the resource: ${response.statusText}`);
    }

    // 2. Conversion en Blob
    const blob = await response.blob();
    
    // 3. Extraction du MIME type (du header Content-Type)
    const mimeType = blob.type; 

    // 4. Création de l'objet File
    const file = new File([blob], filename, { type: mimeType });

    return file;
};