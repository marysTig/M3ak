/**
 * cloudinary.ts
 *
 * Utilitaires Cloudinary pour l'upload d'images côté client.
 * Utilise l'API REST d'upload non-signé (unsigned preset "m3akm3ak").
 * Le CLOUDINARY_API_SECRET n'est JAMAIS utilisé ici — il reste côté serveur.
 *
 * Docs : https://cloudinary.com/documentation/upload_images#unsigned_upload
 */

// ─── Configuration (variables VITE_ uniquement — sûres côté client) ──────────

const CLOUD_NAME = import.meta.env["VITE_CLOUDINARY_CLOUD_NAME"] as string;
const API_KEY = import.meta.env["VITE_CLOUDINARY_API_KEY"] as string;
const UPLOAD_PRESET = import.meta.env["VITE_CLOUDINARY_UPLOAD_PRESET"] as string;

if (!CLOUD_NAME || !UPLOAD_PRESET) {
  console.warn(
    "[Cloudinary] Variables d'environnement manquantes. " +
      "Vérifiez VITE_CLOUDINARY_CLOUD_NAME et VITE_CLOUDINARY_UPLOAD_PRESET dans .env",
  );
}

// ─── URL de base ──────────────────────────────────────────────────────────────

export const CLOUDINARY_BASE_URL = `https://res.cloudinary.com/${CLOUD_NAME}`;
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  original_filename: string;
  created_at: string;
  asset_id: string;
}

export interface UploadOptions {
  /** Dossier cible dans Cloudinary (ex: "m3ak/logos") */
  folder?: string;
  /** Transformations appliquées à l'upload (ex: "w_400,h_400,c_fill") */
  transformation?: string;
  /** Tags associés à l'image */
  tags?: string[];
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

// ─── Fonctions d'upload ───────────────────────────────────────────────────────

/**
 * Upload non-signé d'un fichier image vers Cloudinary.
 * Utilise le preset "m3akm3ak" configuré en mode "unsigned".
 *
 * @param file      Fichier image à uploader
 * @param options   Options optionnelles (dossier, tags...)
 * @param onProgress Callback de progression (0-100%)
 * @returns         Résultat de l'upload avec l'URL sécurisée
 */
export async function uploadImage(
  file: File,
  options: UploadOptions = {},
  onProgress?: (progress: UploadProgress) => void,
): Promise<CloudinaryUploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "Configuration Cloudinary manquante. " +
        "Vérifiez VITE_CLOUDINARY_CLOUD_NAME et VITE_CLOUDINARY_UPLOAD_PRESET dans .env",
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("api_key", API_KEY);

  if (options.folder) formData.append("folder", options.folder);
  if (options.tags?.length) formData.append("tags", options.tags.join(","));
  if (options.transformation) formData.append("transformation", options.transformation);

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress({
            loaded: e.loaded,
            total: e.total,
            percent: Math.round((e.loaded / e.total) * 100),
          });
        }
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText) as CloudinaryUploadResult;
          resolve(result);
        } catch {
          reject(new Error("Réponse Cloudinary invalide."));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText) as { error?: { message: string } };
          reject(new Error(err.error?.message ?? `Erreur HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`Erreur HTTP ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Erreur réseau lors de l'upload.")));
    xhr.addEventListener("abort", () => reject(new Error("Upload annulé.")));

    xhr.open("POST", UPLOAD_URL);
    xhr.send(formData);
  });
}

/**
 * Upload d'une image depuis une URL distante ou une Data URL (base64).
 */
export async function uploadImageFromUrl(
  url: string,
  options: UploadOptions = {},
): Promise<CloudinaryUploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Configuration Cloudinary manquante.");
  }

  const formData = new FormData();
  formData.append("file", url);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("api_key", API_KEY);

  if (options.folder) formData.append("folder", options.folder);
  if (options.tags?.length) formData.append("tags", options.tags.join(","));

  const res = await fetch(UPLOAD_URL, { method: "POST", body: formData });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message: string } };
    throw new Error(err.error?.message ?? `Erreur HTTP ${res.status}`);
  }
  return res.json() as Promise<CloudinaryUploadResult>;
}

// ─── Helpers d'URL de transformation ─────────────────────────────────────────

/**
 * Génère une URL Cloudinary avec transformations.
 *
 * @example
 * getImageUrl("m3ak/logos/abc123", "w_200,h_200,c_fill,f_auto,q_auto")
 */
export function getImageUrl(publicId: string, transformation = "f_auto,q_auto"): string {
  return `${CLOUDINARY_BASE_URL}/image/upload/${transformation}/${publicId}`;
}

/**
 * URL d'une image de logo commerçant (200x200, cadré, auto-format).
 */
export function getMerchantLogoUrl(publicId: string): string {
  return getImageUrl(publicId, "w_200,h_200,c_fill,f_auto,q_auto,r_max");
}

/**
 * URL d'une image de fond de carte fidélité (800x500, cadré, auto-format).
 */
export function getCardBgUrl(publicId: string): string {
  return getImageUrl(publicId, "w_800,h_500,c_fill,f_auto,q_auto");
}

/**
 * Valide qu'un fichier est une image et respecte la taille maximale.
 */
export function validateImageFile(
  file: File,
  maxSizeMb = 10,
): { valid: boolean; error?: string } {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "Format non supporté. Utilisez JPEG, PNG, GIF, WebP ou SVG." };
  }
  if (file.size > maxSizeMb * 1024 * 1024) {
    return { valid: false, error: `L'image ne doit pas dépasser ${maxSizeMb} Mo.` };
  }
  return { valid: true };
}
