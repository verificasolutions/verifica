import "server-only";
import { requireOwnerOrManager } from "@/backend/auth/guards";
import { ensureAttendanceMediaBucket, uploadAttendanceMediaFileUpsert } from "@/backend/repos/attendance-media-repo";
import { upsertTenantLandingPage } from "@/backend/repos/tenant-landing-repo";
import { slugify } from "@/backend/shared/slug";
import { readCheckboxValue } from "@/backend/shared/tenant-whatsapp-messages";

function text(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  return value || null;
}

function readBackgroundStyle(formData: FormData) {
  const value = String(formData.get("background_style") ?? "dark").trim();
  if (["dark", "white", "gray", "black", "lilac", "theme", "water", "pet", "bodyshop", "mechanic", "fashion", "furniture"].includes(value)) {
    return value as "dark" | "white" | "gray" | "black" | "lilac" | "theme" | "water" | "pet" | "bodyshop" | "mechanic" | "fashion" | "furniture";
  }
  return "dark";
}

function extensionFromMime(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function uploadLandingImage(tenantId: string, kind: "cover" | "profile", file: File | null) {
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Use JPG, PNG ou WebP na imagem da landing.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("A imagem da landing ultrapassa 8 MB.");
  }

  const ensureError = await ensureAttendanceMediaBucket();
  if (ensureError) {
    throw new Error(ensureError.message);
  }

  const extension = extensionFromMime(file.type);
  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `tenant/${tenantId}/landing/${kind}-${slugify(file.name || kind)}.${extension}`;

  const uploadError = await uploadAttendanceMediaFileUpsert({
    path,
    contentType: file.type,
    bytes,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  return path;
}

export async function saveLandingPageUseCase(formData: FormData) {
  const context = await requireOwnerOrManager();
  const currentCoverPath = text(formData, "current_cover_image_url");
  const currentProfilePath = text(formData, "current_profile_image_url");
  const coverFile = formData.get("cover_image_file");
  const profileFile = formData.get("profile_image_file");

  const [uploadedCoverPath, uploadedProfilePath] = await Promise.all([
    uploadLandingImage(context.tenantId, "cover", coverFile instanceof File ? coverFile : null),
    uploadLandingImage(context.tenantId, "profile", profileFile instanceof File ? profileFile : null),
  ]);

  const error = await upsertTenantLandingPage({
    tenantId: context.tenantId,
    category: text(formData, "category"),
    bio: text(formData, "bio"),
    backgroundStyle: readBackgroundStyle(formData),
    coverImageUrl: uploadedCoverPath ?? currentCoverPath,
    profileImageUrl: uploadedProfilePath ?? currentProfilePath,
    instagramUrl: text(formData, "instagram_url"),
    facebookUrl: text(formData, "facebook_url"),
    openingHours: text(formData, "opening_hours"),
    ctaWhatsappMessage: text(formData, "cta_whatsapp_message"),
    isPublished: readCheckboxValue(formData, "is_published"),
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    tenantSlug: context.tenant.slug ?? null,
  };
}
